
import { redirect } from 'next/navigation';
<<<<<<< HEAD
import { getSession } from '@/lib/auth';

export default async function HomePage() {
  const session = await getSession();

  if (session) {
    redirect('/dashboard');
  } else {
    redirect('/login');
  }
=======

export default async function HomePage() {
  // Always redirect to the dashboard as login is removed
  redirect('/dashboard');
>>>>>>> 8e19822 (remova a parte do login que fizemos alguns passos atrás)
  // Return null as redirect will handle it.
  return null;
}
