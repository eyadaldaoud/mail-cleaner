import { NextRequest, NextResponse } from 'next/server';
import { executeUnsubscribe } from '@/lib/gmail/client';
import { UnsubscribeOptions } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const options = body.options as UnsubscribeOptions;

    if (!options || (!options.httpUrl && !options.mailto)) {
      return NextResponse.json(
        { error: 'No valid unsubscribe URL or mailto target provided' },
        { status: 400 }
      );
    }

    const result = await executeUnsubscribe(options);
    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error('Unsubscribe error:', err);
    const message = err instanceof Error ? err.message : 'Failed to execute unsubscribe';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
