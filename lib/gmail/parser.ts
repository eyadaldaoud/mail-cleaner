import { EmailMetadata, UnsubscribeOptions } from '../types';

export interface RawGmailHeader {
  name?: string | null;
  value?: string | null;
}

export interface RawGmailMessage {
  id?: string | null;
  threadId?: string | null;
  snippet?: string | null;
  sizeEstimate?: number | null;
  internalDate?: string | null;
  labelIds?: string[] | null;
  payload?: {
    headers?: RawGmailHeader[] | null;
  } | null;
}

/**
 * Parses raw RFC 2822 email address string like:
 * "John Doe <john.doe@example.com>" or "support@company.co.uk"
 */
export function parseFromHeader(rawFrom: string): {
  name: string;
  email: string;
  domain: string;
} {
  if (!rawFrom) {
    return { name: 'Unknown Sender', email: '', domain: 'unknown' };
  }

  const match = rawFrom.match(/^(?:["']?([^"']*)["']?\s*)?<([^>]+)>/);
  if (match) {
    const name = match[1]?.trim() || '';
    const email = match[2]?.trim().toLowerCase() || '';
    const domain = email.split('@')[1] || 'unknown';
    return {
      name: name || email.split('@')[0],
      email,
      domain,
    };
  }

  // Fallback for plain email without brackets
  const cleanEmail = rawFrom.replace(/["'<>]/g, '').trim().toLowerCase();
  const domain = cleanEmail.includes('@') ? cleanEmail.split('@')[1] : 'unknown';
  return {
    name: cleanEmail.split('@')[0] || cleanEmail,
    email: cleanEmail,
    domain,
  };
}

/**
 * Parses List-Unsubscribe header (RFC 2369 & RFC 8058)
 * e.g. <https://domain.com/unsub?id=123>, <mailto:unsub@domain.com?subject=unsub>
 */
export function parseListUnsubscribeHeader(
  listUnsubHeader?: string | null,
  listUnsubPostHeader?: string | null
): UnsubscribeOptions | undefined {
  if (!listUnsubHeader) return undefined;

  const result: UnsubscribeOptions = {
    rawHeader: listUnsubHeader,
    hasOneClickPost: Boolean(
      listUnsubPostHeader &&
      listUnsubPostHeader.toLowerCase().includes('list-unsubscribe=one-click')
    ),
  };

  // Find all items enclosed in <...>
  const angleBracketMatches = listUnsubHeader.match(/<([^>]+)>/g);
  const targets = angleBracketMatches
    ? angleBracketMatches.map((t) => t.slice(1, -1).trim())
    : listUnsubHeader.split(',').map((t) => t.trim());

  for (const target of targets) {
    if (target.startsWith('http://') || target.startsWith('https://')) {
      if (!result.httpUrl) {
        result.httpUrl = target;
      }
    } else if (target.startsWith('mailto:')) {
      if (!result.mailto) {
        try {
          const mailtoStr = target.slice(7); // strip 'mailto:'
          const [addressPart, queryPart] = mailtoStr.split('?');
          const address = addressPart.trim();

          let subject = 'Unsubscribe';
          let body = 'Please unsubscribe me from this mailing list.';

          if (queryPart) {
            const params = new URLSearchParams(queryPart);
            if (params.get('subject')) subject = params.get('subject')!;
            if (params.get('body')) body = params.get('body')!;
          }

          result.mailto = {
            address,
            subject,
            body,
          };
        } catch {
          result.mailto = {
            address: target.replace(/^mailto:/i, '').split('?')[0].trim(),
            subject: 'Unsubscribe',
          };
        }
      }
    }
  }

  if (!result.httpUrl && !result.mailto) {
    return undefined;
  }

  return result;
}

/**
 * Formats byte size into human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Transforms a raw Gmail message response with metadata into our structured EmailMetadata
 */
export function transformGmailMessage(message: RawGmailMessage): EmailMetadata {
  const headers = message.payload?.headers || [];
  const getHeader = (name: string): string => {
    const found = headers.find(
      (h) => h.name?.toLowerCase() === name.toLowerCase()
    );
    return found?.value || '';
  };

  const rawFrom = getHeader('From');
  const subject = getHeader('Subject') || '(No Subject)';
  const dateStr = getHeader('Date');
  const to = getHeader('To');
  const listUnsub = getHeader('List-Unsubscribe');
  const listUnsubPost = getHeader('List-Unsubscribe-Post');

  const { name: senderName, email: senderEmail, domain: senderDomain } =
    parseFromHeader(rawFrom);

  const internalDateMs = message.internalDate
    ? parseInt(message.internalDate, 10)
    : dateStr
    ? new Date(dateStr).getTime()
    : Date.now();

  const validDate = isNaN(internalDateMs) ? Date.now() : internalDateMs;
  const now = Date.now();
  const ageDays = Math.max(0, Math.floor((now - validDate) / (1000 * 60 * 60 * 24)));

  const sizeBytes = message.sizeEstimate || 0;
  const sizeFormatted = formatBytes(sizeBytes);

  // Filters logic:
  // Heavy Files: > 5MB (5,242,880 bytes) or > 10MB (10,485,760 bytes)
  const isHeavy5MB = sizeBytes >= 5 * 1024 * 1024;
  const isHeavy10MB = sizeBytes >= 10 * 1024 * 1024;

  // Mass notifications: words like noreply, no-reply, donotreply, alert, notification, updates
  const massNotificationKeywords = [
    'noreply',
    'no-reply',
    'donotreply',
    'do-not-reply',
    'notification',
    'notifications',
    'alert',
    'alerts',
    'newsletter',
    'marketing',
    'updates',
    'info@',
    'mailer-daemon',
  ];

  const searchTarget = `${senderEmail} ${senderName} ${subject}`.toLowerCase();
  const isMassNotification = massNotificationKeywords.some((kw) =>
    searchTarget.includes(kw)
  );

  // Ancient history: older than 1 year (365 days) or 2 years (730 days)
  const isAncient1Year = ageDays >= 365;
  const isAncient2Years = ageDays >= 730;

  const unsubscribeOptions = parseListUnsubscribeHeader(listUnsub, listUnsubPost);
  const hasUnsubscribe = Boolean(unsubscribeOptions);

  return {
    id: message.id || '',
    threadId: message.threadId || '',
    from: rawFrom,
    senderName,
    senderEmail,
    senderDomain,
    to,
    subject,
    date: new Date(validDate).toISOString(),
    internalDate: validDate,
    ageDays,
    sizeBytes,
    sizeFormatted,
    isHeavy5MB,
    isHeavy10MB,
    isMassNotification,
    isAncient1Year,
    isAncient2Years,
    hasUnsubscribe,
    unsubscribeOptions,
    snippet: message.snippet || '',
    labels: message.labelIds || [],
  };
}
