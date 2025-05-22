
import { redirect } from 'next/navigation';
<<<<<<< HEAD
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
=======
import { getSession } from '@/lib/auth';

export default async function HomePage() {
  const session = await getSession();

  if (session) {
    redirect('/dashboard');
  } else {
    redirect('/login');
  }
>>>>>>> 988ed2c (vc não pode colocar tudo isso já no projeto? (essa questão do bcrypt) onde meu trabalho seja unicamente criar as tabelas via sql lá no banco? vc cria uma área para cadastro de usuário, e o primeiro usuário registrado, já vira super admin, e do segundo em diante precisa de aprovação)
  // Return null as redirect will handle it.
  return null;
}
