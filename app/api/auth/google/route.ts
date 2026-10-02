import { NextResponse } from 'next/server';
import { generateAuthUrl, isGoogleOAuthConfigured } from '@/lib/gmail/oauth';

export async function GET() {
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json(
      {
        error: 'Google OAuth is not configured in .env.local',
        instruction:
          'Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI in .env.local to enable real Gmail sync. You can also explore via Demo Mode directly from the dashboard.',
      },
      { status: 400 }
    );
  }

  try {
    const url = generateAuthUrl();
    return NextResponse.redirect(url);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate auth URL';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
