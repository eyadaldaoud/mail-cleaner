import { NextRequest, NextResponse } from 'next/server';
import {
  getUserAccounts,
  saveUserAccountsBatch,
  updateUserAccountStatus,
} from '@/lib/supabase';
import { getSessionCookie } from '@/lib/gmail/oauth';
import { UserAccountRecord } from '@/lib/types';

export async function GET() {
  const session = await getSessionCookie();
  const userEmail = session?.email || 'demo@mailcleaner.app';
  const accounts = await getUserAccounts(userEmail);
  return NextResponse.json({ accounts });
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionCookie();
    const userEmail = session?.email || 'demo@mailcleaner.app';
    const body = await request.json();

    const { accounts } = body;
    if (!Array.isArray(accounts)) {
      return NextResponse.json(
        { error: 'Expected accounts array in request body' },
        { status: 400 }
      );
    }

    const prepared = accounts.map((acc: Partial<UserAccountRecord>) => ({
      user_email: userEmail,
      domain: acc.domain || 'unknown.com',
      username: acc.username || undefined,
      source: acc.source || 'chrome_csv',
      delete_url: acc.delete_url || undefined,
      delete_difficulty: acc.delete_difficulty || 'unknown',
      breach_count: acc.breach_count || 0,
      status: acc.status || 'active',
      notes: acc.notes || undefined,
    }));

    const saved = await saveUserAccountsBatch(prepared);
    return NextResponse.json({ success: true, count: saved.length, accounts: saved });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save accounts';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'id and status are required' }, { status: 400 });
    }

    const success = await updateUserAccountStatus(id, status);
    return NextResponse.json({ success });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update account';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
