import { NextRequest, NextResponse } from 'next/server';
import {
  getSessionCookie,
  setSessionCookie,
  clearSessionCookie,
  isGoogleOAuthConfigured,
} from '@/lib/gmail/oauth';
import { isSupabaseConfigured } from '@/lib/supabase';

export async function GET() {
  const session = await getSessionCookie();
  const oauthConfigured = isGoogleOAuthConfigured();
  const dbConfigured = isSupabaseConfigured;
  const hibpConfigured = Boolean(
    process.env.HIBP_API_KEY && !process.env.HIBP_API_KEY.includes('your-')
  );

  const isAuthenticated = Boolean(session && !session.isDemo);
  const isDemoMode = Boolean(session?.isDemo);

  return NextResponse.json({
    isAuthenticated,
    isDemoMode,
    userEmail: session?.email || (isDemoMode ? 'demo@mailcleaner.app' : ''),
    userName: session?.name || (isDemoMode ? 'Demo Mode User' : ''),
    userPicture: session?.picture || null,
    oauthConfigured,
    dbConfigured,
    hibpConfigured,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action;

    if (action === 'enable_demo') {
      await setSessionCookie({
        accessToken: 'demo_token',
        email: 'demo@mailcleaner.app',
        name: 'Alex Mercer (Demo)',
        isDemo: true,
      });
      return NextResponse.json({ success: true, isDemo: true });
    }

    if (action === 'disable_demo' || action === 'exit_demo') {
      await clearSessionCookie();
      return NextResponse.json({ success: true, isDemo: false });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Session action failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
