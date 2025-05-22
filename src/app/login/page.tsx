
import AuthForm from '@/components/auth/AuthForm';
import Link from 'next/link';

<<<<<<< HEAD
// New Abstract Logo SVG (Orange and Blue) to match Header
const FreelaOSLoginLogo = () => (
  <svg width="48" height="48" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-2">
    <rect width="100" height="100" rx="15" fill="hsl(var(--primary))"/>
    <path d="M25 75V25L50 50L25 75Z" fill="hsl(var(--primary-foreground))"/>
    <path d="M75 25V75L50 50L75 25Z" fill="hsl(var(--primary-foreground))"/>
    <rect x="45" y="15" width="10" height="70" fill="hsl(var(--secondary))"/>
  </svg>
);

=======
>>>>>>> 988ed2c (vc não pode colocar tudo isso já no projeto? (essa questão do bcrypt) onde meu trabalho seja unicamente criar as tabelas via sql lá no banco? vc cria uma área para cadastro de usuário, e o primeiro usuário registrado, já vira super admin, e do segundo em diante precisa de aprovação)
export default function LoginPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const status = searchParams?.status;
  let initialMessage = '';
  let messageType : 'success' | 'error' | undefined = undefined;

  if (status === 'pending_approval') {
    initialMessage = 'Registro bem-sucedido! Sua conta aguarda aprovação de um administrador.';
    messageType = 'success';
  } else if (status === 'logged_out') {
    initialMessage = 'Você foi desconectado com sucesso.';
    messageType = 'success';
  }


  return (
    <div className="d-flex align-items-center justify-content-center min-vh-100 bg-light">
      <div className="card shadow-lg" style={{ width: '100%', maxWidth: '400px' }}>
        <div className="card-body p-4 p-md-5">
          <div className="text-center mb-4">
<<<<<<< HEAD
            <FreelaOSLoginLogo />
            <h1 className="h3 fw-bold mb-0" style={{ color: 'hsl(var(--primary))' }}>FreelaOS</h1> {/* Removed "Minimal" */}
=======
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary mb-2"><path d="M9.75 2.75H4.75C3.64543 2.75 2.75 3.64543 2.75 4.75V9.75C2.75 10.8546 3.64543 11.75 4.75 11.75H9.75C10.8546 11.75 11.75 10.8546 11.75 9.75V4.75C11.75 3.64543 10.8546 2.75 9.75 2.75Z"></path><path d="M19.25 2.75H14.25C13.1454 2.75 12.25 3.64543 12.25 4.75V9.75C12.25 10.8546 13.1454 11.75 14.25 11.75H19.25C20.3546 11.75 21.25 10.8546 21.25 9.75V4.75C21.25 3.64543 20.3546 2.75 19.25 2.75Z"></path><path d="M9.75 12.25H4.75C3.64543 12.25 2.75 13.1454 2.75 14.25V19.25C2.75 20.3546 3.64543 21.25 4.75 21.25H9.75C10.8546 21.25 11.75 20.3546 11.75 19.25V14.25C11.75 13.1454 10.8546 12.25 9.75 12.25Z"></path><path d="M15.75 18.25H12.75V15.25H15.75V18.25Z"></path><path d="M18.25 15.75H15.75V12.75H18.25V15.75Z"></path><path d="M21.25 15.75H18.25V12.75H21.25V15.75Z"></path><path d="M21.25 18.25H18.25V15.25H21.25V18.25Z"></path><path d="M15.75 21.25H12.75V18.25H15.75V21.25Z"></path><path d="M18.25 21.25H15.75V18.25H18.25V21.25Z"></path><path d="M21.25 21.25H18.25V18.25H21.25V21.25Z"></path></svg>
            <h1 className="h3 fw-bold mb-0">FreelaOS</h1>
>>>>>>> 988ed2c (vc não pode colocar tudo isso já no projeto? (essa questão do bcrypt) onde meu trabalho seja unicamente criar as tabelas via sql lá no banco? vc cria uma área para cadastro de usuário, e o primeiro usuário registrado, já vira super admin, e do segundo em diante precisa de aprovação)
            <p className="text-muted">Acesse sua conta</p>
          </div>
          <AuthForm initialMessage={initialMessage} initialMessageType={messageType} />
          <div className="text-center mt-4">
            <p className="mb-0">Não tem uma conta?</p>
            <Link href="/register" className="fw-medium text-primary text-decoration-none">
              Registre-se aqui
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
