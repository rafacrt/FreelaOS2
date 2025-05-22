
import AuthForm from '@/components/auth/AuthForm';
import Link from 'next/link';

// New Abstract Logo SVG (Orange)
const FreelaOSLoginLogo = () => (
  <svg width="48" height="48" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-2">
    <rect width="100" height="100" rx="15" fill="hsl(var(--primary))"/> {/* Orange background */}
    <path d="M25 75V25L50 50L25 75Z" fill="hsl(var(--primary-foreground))"/> {/* White/Light foreground element */}
    <path d="M75 25V75L50 50L75 25Z" fill="hsl(var(--primary-foreground))"/>
    {/* Elemento que era azul, agora laranja ou removido/ajustado */}
    <rect x="45" y="15" width="10" height="70" fill="hsl(var(--primary))"/> {/* Orange accent or same as primary */}
  </svg>
);

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
  } else if (status === 'not_approved') {
    initialMessage = 'Sua conta ainda não foi aprovada. Por favor, aguarde a aprovação de um administrador.';
    messageType = 'error';
  }


  return (
    <div className="d-flex align-items-center justify-content-center min-vh-100 bg-light">
      <div className="card shadow-lg" style={{ width: '100%', maxWidth: '400px' }}>
        <div className="card-body p-4 p-md-5">
          <div className="text-center mb-4">
            <FreelaOSLoginLogo />
            <h1 className="h3 fw-bold mb-0" style={{ color: 'hsl(var(--primary))' }}>FreelaOS</h1>
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
