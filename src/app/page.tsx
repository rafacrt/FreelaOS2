import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getSessionFromToken } from '@/lib/auth'; // Will use getSessionFromToken from auth-edge via auth.ts
import { AUTH_COOKIE_NAME } from '@/lib/constants';

export default async function HomePage() {
  const tokenValue = cookies().get(AUTH_COOKIE_NAME)?.value;
  const session = await getSessionFromToken(tokenValue);

  if (session) {
    redirect('/dashboard');
  } else {
    redirect('/login');
  }
  // Return null as redirect will handle it.
  // This part of the code should not be reached if redirects work.
  return null;
}
