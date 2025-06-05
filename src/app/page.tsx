
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getSessionFromToken, encryptPayload } from '@/lib/auth-edge';
import { AUTH_COOKIE_NAME, SESSION_MAX_AGE } from '@/lib/constants';
import type { SessionPayload } from '@/lib/types';
import { env } from '@/env.mjs'; // Import env

export default async function HomePage() {
  const devLoginEnabled = env.DEV_LOGIN_ENABLED; // Use from env.mjs
  const nextPublicDevMode = env.NEXT_PUBLIC_DEV_MODE; // Use from env.mjs

  const cookieStore = cookies();
  const tokenValue = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const currentSession = await getSessionFromToken(tokenValue);

  if (devLoginEnabled && nextPublicDevMode && !currentSession) {
    console.log('[HomePage] DEV_LOGIN_ENABLED and NEXT_PUBLIC_DEV_MODE are true, and no session. Auto-logging in as dev admin.');

    const devAdminSession: SessionPayload = {
      sessionType: 'admin',
      id: 'dev-admin-001',
      username: 'Dev Admin',
      isAdmin: true,
      isApproved: true,
    };
    const expires = new Date(Date.now() + SESSION_MAX_AGE * 1000);
    const sessionPayloadToEncrypt = { ...devAdminSession, expires: expires.toISOString() };

    try {
      const token = await encryptPayload(sessionPayloadToEncrypt as SessionPayload);
      const cookieOptions = {
        name: AUTH_COOKIE_NAME,
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // Standard process.env is fine here (Server Component)
        expires,
        path: '/',
        sameSite: 'lax' as 'lax' | 'strict' | 'none' | undefined,
      };
      cookieStore.set(cookieOptions);
      console.log(`[HomePage] Dev admin session cookie created for ${devAdminSession.username}. Redirecting to /dashboard.`);
      redirect('/dashboard');
    } catch (error) {
      console.error('[HomePage] Failed to create dev admin session cookie:', error);
      redirect('/login');
    }
  }

  if (currentSession) {
    if (currentSession.sessionType === 'admin') {
      console.log('[HomePage] Admin session found, redirecting to /dashboard.');
      redirect('/dashboard');
    } else if (currentSession.sessionType === 'partner') {
      console.log('[HomePage] Partner session found, redirecting to /partner/dashboard.');
      redirect('/partner/dashboard');
    } else {
      console.warn('[HomePage] Unknown session type found, redirecting to /login.');
      redirect('/login');
    }
  } else {
    console.log('[HomePage] No session found, redirecting to /login.');
    redirect('/login');
  }
  return null;
}
