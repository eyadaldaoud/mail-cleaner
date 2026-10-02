import { NextRequest, NextResponse } from 'next/server';
import { batchTrashEmails } from '@/lib/gmail/client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'Invalid or empty message IDs array provided' },
        { status: 400 }
      );
    }

    const result = await batchTrashEmails(ids);
    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error('Batch trash error:', err);
    const message = err instanceof Error ? err.message : 'Failed to trash emails';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
