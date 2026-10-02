import { NextRequest, NextResponse } from 'next/server';
import { checkEmailBreaches } from '@/lib/osint/hibp';
import { getSessionCookie } from '@/lib/gmail/oauth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const session = await getSessionCookie();
    const emailParam = searchParams.get('email');
    const targetEmail = emailParam || session?.email || 'user@example.com';

    const result = await checkEmailBreaches(targetEmail);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to query breaches';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
