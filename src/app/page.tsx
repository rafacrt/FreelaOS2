
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getSessionFromToken, encryptPayload } from '@/lib/auth-edge'; // encryptPayload for dev session
import { AUTH_COOKIE_NAME, SESSION_MAX_AGE } from '@/lib/constants';
import type { User } from '@/lib/types';

export default async function HomePage() {
  const devLoginEnabled = process.env.DEV_LOGIN_ENABLED === "true";
  const nextPublicDevMode = process.env.NEXT_PUBLIC_DEV_MODE === "true"; // To ensure this is a conscious dev choice

  const cookieStore = cookies();
  const tokenValue = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (devLoginEnabled && nextPublicDevMode && !tokenValue) {
    // Auto-login as dev user if in dev mode and no session exists
    console.log('[HomePage] DEV_LOGIN_ENABLED and NEXT_PUBLIC_DEV_MODE are true, and no session token. Auto-logging in as dev admin.');
    const devUser: User = {
      id: 'dev-admin-001', // Consistent ID for dev admin
      username: 'Dev Admin',
      isAdmin: true,
      isApproved: true,
    };
    const expires = new Date(Date.now() + SESSION_MAX_AGE * 1000);
    const sessionPayload = { ...devUser, expires: expires.toISOString() };

    try {
      const token = await encryptPayload(sessionPayload);
      const cookieOptions = {
        name: AUTH_COOKIE_NAME,
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // Will be false in dev, true in prod if served via HTTPS
        expires,
        path: '/',
        sameSite: 'lax' as 'lax' | 'strict' | 'none' | undefined,
      };
      cookieStore.set(cookieOptions);
      console.log(`[HomePage] Dev session cookie created for ${devUser.username}. Redirecting to /dashboard.`);
      redirect('/dashboard');
    } catch (error) {
      console.error('[HomePage] Failed to create dev session cookie:', error);
      // Fallback to login page if dev session creation fails
      redirect('/login');
    }
  }

  const session = await getSessionFromToken(tokenValue);

  if (session) {
    console.log('[HomePage] Session found, redirecting to /dashboard.');
    redirect('/dashboard');
  } else {
    console.log('[HomePage] No session found, redirecting to /login.');
    redirect('/login');
  }
  // This part should not be reached if redirects work.
  return null;
}
