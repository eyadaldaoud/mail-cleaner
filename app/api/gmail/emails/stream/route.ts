import { NextRequest } from 'next/server';
import { fetchEmailsMetadata } from '@/lib/gmail/client';

// Force dynamic to ensure we get fresh data on every request
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const maxResults = parseInt(searchParams.get('maxResults') || '100', 10);
  const query = searchParams.get('q') || '';

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Client disconnected
        }
      };

      try {
        // Kick off the fetch with a live progress callback
        const result = await fetchEmailsMetadata({
          maxResults,
          query,
          onProgress: (progress) => {
            send('progress', progress);
          },
        });

        // Send the final 'done' event with all emails as payload
        send('done', {
          phase: 'done',
          fetched: result.emails.length,
          target: maxResults,
          message: `Loaded ${result.emails.length} emails`,
          emails: result.emails,
          isDemo: result.isDemo,
          nextPageToken: result.nextPageToken,
          isApiDisabled: result.isApiDisabled,
          apiError: result.apiError,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        send('error', { phase: 'error', fetched: 0, target: maxResults, message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
