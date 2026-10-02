import { NextRequest, NextResponse } from 'next/server';
import { fetchEmailsMetadata } from '@/lib/gmail/client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const maxResultsParam = searchParams.get('maxResults');
    const query = searchParams.get('q') || '';
    const pageToken = searchParams.get('pageToken') || undefined;

    const maxResults = maxResultsParam ? parseInt(maxResultsParam, 10) : 100;

    const result = await fetchEmailsMetadata({
      maxResults,
      query,
      pageToken,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error('Failed to fetch emails:', err);
    const message = err instanceof Error ? err.message : 'Failed to retrieve emails';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
