
import { type NextRequest, NextResponse } from 'next/server';
import { getSessionFromToken } from '@/lib/auth-edge';
import { AUTH_COOKIE_NAME } from '@/lib/constants';
import type { SessionPayload } from '@/lib/types';

export const runtime = 'edge'; // API route rodando no Edge

export async function GET(request: NextRequest) {
  const tokenValue = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!tokenValue) {
    return NextResponse.json(null, { status: 200 }); // No session, return null
  }

  try {
    const session: SessionPayload | null = await getSessionFromToken(tokenValue);
    if (session) {
      return NextResponse.json(session, { status: 200 });
    } else {
      // Clear the invalid cookie if decryption failed or session is malformed
      const response = NextResponse.json(null, { status: 200 });
      response.cookies.delete(AUTH_COOKIE_NAME);
      return response;
    }
  } catch (error) {
    // Clear the potentially problematic cookie
    const response = NextResponse.json({ error: 'Internal server error during session processing' }, { status: 500 });
    response.cookies.delete(AUTH_COOKIE_NAME);
    return response;
  }
}
