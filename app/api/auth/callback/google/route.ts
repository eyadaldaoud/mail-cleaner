import { NextRequest, NextResponse } from 'next/server';
import { getOAuth2Client, setSessionCookie } from '@/lib/gmail/oauth';
import { google } from 'googleapis';
import { getSupabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  const origin = request.nextUrl.origin;

  if (error || !code) {
    return NextResponse.redirect(
      `${origin}/?auth_error=${encodeURIComponent(error || 'No authorization code provided')}`
    );
  }

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Fetch user profile info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfoRes = await oauth2.userinfo.get();
    const email = userInfoRes.data.email || 'user@gmail.com';
    const name = userInfoRes.data.name || 'Gmail User';
    const picture = userInfoRes.data.picture || undefined;

    // Optional: Persist tokens to Supabase if configured
    const supabase = getSupabase();
    if (supabase && tokens.access_token) {
      try {
        await supabase.from('oauth_tokens').upsert(
          {
            user_email: email,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token || null,
            expiry_date: tokens.expiry_date || null,
            scope: tokens.scope || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_email' }
        );
      } catch (dbErr) {
        console.warn('Failed to save oauth tokens to Supabase:', dbErr);
      }
    }

    // Set secure cookie session
    if (tokens.access_token) {
      await setSessionCookie({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || undefined,
        expiryDate: tokens.expiry_date || undefined,
        email,
        name,
        picture,
        isDemo: false,
      });
    }

    return NextResponse.redirect(`${origin}/?auth=connected`);
  } catch (err: unknown) {
    console.error('Google OAuth callback exchange failed:', err);
    const message = err instanceof Error ? err.message : 'Authentication exchange failed';
    return NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(message)}`);
  }
}
