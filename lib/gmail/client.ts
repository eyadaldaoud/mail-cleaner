import { google } from 'googleapis';
import { getAuthenticatedGmailClient, getSessionCookie } from './oauth';
import { transformGmailMessage, RawGmailMessage } from './parser';
import { EmailMetadata, UnsubscribeOptions } from '../types';
import { MOCK_EMAILS } from './mock-data';

// In-memory deleted IDs set for demo mode
const demoDeletedIds = new Set<string>();

// In-memory persistent cache for fetched real emails per user
const userEmailCache = new Map<string, { emails: EmailMetadata[]; nextPageToken?: string; lastFetched: number }>();

export type FetchProgress = {
  phase: 'listing' | 'metadata' | 'done' | 'error' | 'demo';
  fetched: number;
  target: number;
  message: string;
};

/**
 * Fetches only metadata for up to maxResults (up to 1,000) emails from Gmail.
 * Optionally calls onProgress with live progress updates for SSE streaming.
 */
export async function fetchEmailsMetadata({
  maxResults = 250,
  query = '',
  pageToken,
  onProgress,
}: {
  maxResults?: number;
  query?: string;
  pageToken?: string;
  onProgress?: (progress: FetchProgress) => void;
} = {}): Promise<{
  emails: EmailMetadata[];
  isDemo: boolean;
  totalFetched: number;
  nextPageToken?: string;
  apiError?: string;
  isApiDisabled?: boolean;
  enableApiUrl?: string;
}> {
  const session = await getSessionCookie();
  const gmail = await getAuthenticatedGmailClient();

  if (!gmail || !session || session.isDemo) {
    // Simulate demo progress
    const filteredMock = MOCK_EMAILS.filter((e) => !demoDeletedIds.has(e.id));
    onProgress?.({ phase: 'demo', fetched: filteredMock.length, target: filteredMock.length, message: 'Loaded demo data' });
    return {
      emails: filteredMock,
      isDemo: true,
      totalFetched: filteredMock.length,
    };
  }

  const emails: EmailMetadata[] = [];
  try {
    let currentPageToken: string | undefined = pageToken;
    let lastNextPageToken: string | undefined = undefined;
    const targetCount = Math.min(Math.max(maxResults, 20), 1000);

    // Helper: fetch one message metadata with retry on rate limit
    const fetchWithRetry = async (msgId: string, maxRetries = 3): Promise<EmailMetadata | null> => {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const item = await gmail.users.messages.get({
            userId: 'me',
            id: msgId,
            format: 'metadata',
            metadataHeaders: ['From', 'Subject', 'Date', 'To', 'List-Unsubscribe', 'List-Unsubscribe-Post', 'Message-ID'],
          });
          return transformGmailMessage(item.data as RawGmailMessage);
        } catch (err: any) {
          const errMsg = err?.message || '';
          const isRateLimit = errMsg.includes('rateLimitExceeded') || errMsg.includes('Quota exceeded') || errMsg.includes('userRateLimitExceeded');
          if (isRateLimit && attempt < maxRetries) {
            // Exponential backoff: 800ms, 1.6s, 3.2s
            await new Promise((r) => setTimeout(r, 800 * Math.pow(2, attempt)));
            continue;
          }
          if (!isRateLimit) {
            console.warn(`Failed to fetch metadata for msg ${msgId}:`, errMsg);
          }
          return null;
        }
      }
      return null;
    };

    while (emails.length < targetCount) {
      // Gmail API supports up to 500 IDs per list call — use large batches to minimize round trips
      const listBatchSize = Math.min(500, targetCount - emails.length);

      onProgress?.({
        phase: 'listing',
        fetched: emails.length,
        target: targetCount,
        message: `Listing message IDs from Gmail...`,
      });

      const listRes: any = await gmail.users.messages.list({
        userId: 'me',
        maxResults: listBatchSize,
        q: query || undefined,
        pageToken: currentPageToken,
      });

      const messageList: any[] = listRes.data.messages || [];
      if (messageList.length === 0) break;

      // Fetch metadata in chunks of 10 (conservative to stay within per-second quota)
      // Each messages.get costs 5 quota units; Google allows 250 units/sec → ~50 req/sec
      // 10 parallel = safe headroom, retries cover the rest
      const CHUNK_SIZE = 10;
      for (let i = 0; i < messageList.length; i += CHUNK_SIZE) {
        const chunk = messageList.slice(i, i + CHUNK_SIZE);
        const chunkResults = await Promise.all(
          chunk.map((msg: any) => msg.id ? fetchWithRetry(msg.id) : Promise.resolve(null))
        );

        for (const meta of chunkResults) {
          if (meta) emails.push(meta);
        }

        // Fire progress after each chunk
        onProgress?.({
          phase: 'metadata',
          fetched: emails.length,
          target: targetCount,
          message: `Reading email metadata... ${emails.length} of ${targetCount}`,
        });

        // 80ms inter-chunk breathing room (10 req × 5 units = 50 units, well within 250/sec)
        await new Promise((resolve) => setTimeout(resolve, 80));
      }

      lastNextPageToken = listRes.data.nextPageToken || undefined;
      currentPageToken = lastNextPageToken;
      if (!currentPageToken || emails.length >= targetCount) break;
    }



    // Update cache with freshly fetched emails
    if (emails.length > 0 && session?.email) {
      const existing = userEmailCache.get(session.email)?.emails || [];
      const idSet = new Set(emails.map((e) => e.id));
      const merged = [...emails, ...existing.filter((e) => !idSet.has(e.id))];
      userEmailCache.set(session.email, {
        emails: merged,
        nextPageToken: lastNextPageToken,
        lastFetched: Date.now(),
      });
    }

    return {
      emails,
      isDemo: false,
      totalFetched: emails.length,
      nextPageToken: lastNextPageToken,
    };
  } catch (error: any) {
    console.error('Error fetching emails from Gmail API:', error);
    const errorMsg = error?.message || String(error);
    const isApiDisabled = errorMsg.includes('Gmail API has not been used') || errorMsg.includes('is disabled');
    
    // Check if we have cached real emails for this user to prevent blank screen on temporary rate limit
    if (session?.email && userEmailCache.has(session.email)) {
      const cached = userEmailCache.get(session.email)!;
      return {
        emails: cached.emails,
        isDemo: false,
        totalFetched: cached.emails.length,
        nextPageToken: cached.nextPageToken,
        apiError: errorMsg.includes('Quota exceeded')
          ? 'Google API rate limit reached (Quota resets in 60s). Showing your cached emails.'
          : errorMsg,
      };
    }

    // If we already fetched some real emails in this execution, return them!
    if (emails.length > 0) {
      return {
        emails,
        isDemo: false,
        totalFetched: emails.length,
        apiError: errorMsg,
      };
    }

    // Only if 0 emails were fetched and session is real, return empty real array (not fake mock data)
    if (session && !session.isDemo && !isApiDisabled) {
      return {
        emails: [],
        isDemo: false,
        totalFetched: 0,
        apiError: errorMsg,
      };
    }

    // Fallback to mock data only for pure demo or disabled API
    const filteredMock = MOCK_EMAILS.filter((e) => !demoDeletedIds.has(e.id));
    return {
      emails: filteredMock,
      isDemo: true,
      totalFetched: filteredMock.length,
      apiError: errorMsg,
      isApiDisabled,
      enableApiUrl: 'https://console.developers.google.com/apis/api/gmail.googleapis.com/overview',
    };
  }
}

/**
 * Bulk trash emails by message IDs.
 * Uses Gmail API batchModify to immediately move messages to TRASH and remove from INBOX.
 */
export async function batchTrashEmails(messageIds: string[]): Promise<{
  success: boolean;
  count: number;
  isDemo: boolean;
}> {
  if (!messageIds || messageIds.length === 0) {
    return { success: true, count: 0, isDemo: false };
  }

  const session = await getSessionCookie();
  const gmail = await getAuthenticatedGmailClient();

  if (session?.email && userEmailCache.has(session.email)) {
    const cached = userEmailCache.get(session.email)!;
    const trashSet = new Set(messageIds);
    cached.emails = cached.emails.filter((e) => !trashSet.has(e.id));
    userEmailCache.set(session.email, cached);
  }

  if (!gmail || !session || session.isDemo) {
    for (const id of messageIds) {
      demoDeletedIds.add(id);
    }
    return { success: true, count: messageIds.length, isDemo: true };
  }

  try {
    // Gmail batchModify supports up to 1000 IDs per call
    await gmail.users.messages.batchModify({
      userId: 'me',
      requestBody: {
        ids: messageIds,
        addLabelIds: ['TRASH'],
        removeLabelIds: ['INBOX'],
      },
    });

    return { success: true, count: messageIds.length, isDemo: false };
  } catch (error) {
    console.error('Failed to batch trash messages via Gmail API:', error);
    throw error;
  }
}

/**
 * Triggers automated Unsubscribe:
 * 1. If options.httpUrl exists -> executes server-side HTTP fetch
 * 2. If options.mailto exists -> sends silent RFC 2822 email via Gmail API
 */
export async function executeUnsubscribe(options: UnsubscribeOptions): Promise<{
  success: boolean;
  methodUsed: 'http_post' | 'http_get' | 'mailto';
  target: string;
  message: string;
}> {
  // Try HTTP URL first (especially RFC 8058 One-Click)
  if (options.httpUrl) {
    try {
      const isOneClick = Boolean(options.hasOneClickPost);
      const url = options.httpUrl;

      if (isOneClick) {
        // RFC 8058 standard POST
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'MailCleaner-Agent/1.0 (+https://github.com/eyad/mail-cleaner)',
          },
          body: 'List-Unsubscribe=One-Click',
        });

        if (res.ok || res.status === 302 || res.status === 200) {
          return {
            success: true,
            methodUsed: 'http_post',
            target: url,
            message: `One-Click unsubscribe POST successfully acknowledged by sender (HTTP ${res.status}).`,
          };
        }
      }

      // Standard GET request
      const getRes = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        },
      });

      return {
        success: true,
        methodUsed: 'http_get',
        target: url,
        message: `Unsubscribe link visited server-side (HTTP ${getRes.status}).`,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn('HTTP unsubscribe attempt failed, trying mailto if available:', errMsg);
      // Fall through to mailto if available
    }
  }

  // Fallback to Mailto
  if (options.mailto) {
    const session = await getSessionCookie();
    const gmail = await getAuthenticatedGmailClient();

    if (!gmail || !session || session.isDemo) {
      // In demo mode, simulate sending silent email
      return {
        success: true,
        methodUsed: 'mailto',
        target: options.mailto.address,
        message: `Simulated silent unsubscribe email sent to ${options.mailto.address} (Demo Mode).`,
      };
    }

    try {
      // Construct raw RFC 2822 email message
      const subject = options.mailto.subject || 'Unsubscribe';
      const body = options.mailto.body || 'Please unsubscribe me from this mailing list.';
      const rawEmail = [
        `To: ${options.mailto.address}`,
        `Subject: ${subject}`,
        'Content-Type: text/plain; charset=utf-8',
        'MIME-Version: 1.0',
        '',
        body,
      ].join('\r\n');

      const encoded = Buffer.from(rawEmail)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encoded,
        },
      });

      return {
        success: true,
        methodUsed: 'mailto',
        target: options.mailto.address,
        message: `Silent unsubscribe email successfully sent to ${options.mailto.address} via Gmail API.`,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('Failed to send mailto unsubscribe email:', errMsg);
      throw new Error(`Mailto unsubscribe failed: ${errMsg}`);
    }
  }

  throw new Error('No valid unsubscribe URL or mailto address found in headers.');
}
