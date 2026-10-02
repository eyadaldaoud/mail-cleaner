import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/gmail/oauth';

export async function GET(request: NextRequest) {
  await clearSessionCookie();
  const origin = request.nextUrl.origin;
  return NextResponse.redirect(`${origin}/`);
}

export async function POST() {
  await clearSessionCookie();
  return NextResponse.json({ success: true });
}
