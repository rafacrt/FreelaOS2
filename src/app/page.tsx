
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getSessionFromToken } from '@/lib/auth-edge';
import { AUTH_COOKIE_NAME } from '@/lib/constants';
import type { SessionPayload } from '@/lib/types';

export default async function HomePage() {
  const cookieStore = cookies();
  const tokenValue = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const currentSession = await getSessionFromToken(tokenValue);

  if (currentSession) {
    if (currentSession.sessionType === 'admin') {
      redirect('/dashboard');
    } else if (currentSession.sessionType === 'partner') {
      redirect('/partner/dashboard');
    } else {
      // Fallback if sessionType is unknown, though should not happen
      redirect('/login');
    }
  } else {
    // Default to admin login if no session
    redirect('/login');
  }
  return null; // This page will always redirect
}
