import { NextRequest, NextResponse } from 'next/server';
import { getBlockedSenders, addBlockedSender, removeBlockedSender } from '@/lib/supabase';
import { getSessionCookie } from '@/lib/gmail/oauth';

export async function GET() {
  const session = await getSessionCookie();
  const userEmail = session?.email || 'demo@mailcleaner.app';
  const list = await getBlockedSenders(userEmail);
  return NextResponse.json({ blockedSenders: list });
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionCookie();
    const userEmail = session?.email || 'demo@mailcleaner.app';
    const body = await request.json();

    const { domain, senderEmail, reason, autoTrash } = body;
    if (!domain) {
      return NextResponse.json({ error: 'Domain is required' }, { status: 400 });
    }

    const record = await addBlockedSender(
      userEmail,
      domain,
      senderEmail,
      reason,
      autoTrash ?? true
    );

    return NextResponse.json({ success: true, record });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to block sender';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Record ID is required' }, { status: 400 });
    }

    const success = await removeBlockedSender(id);
    return NextResponse.json({ success });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete blocked sender';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
