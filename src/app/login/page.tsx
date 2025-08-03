'use client'; 

import AuthForm from '@/components/auth/AuthForm'; 
import Link from 'next/link';
import { AlertCircle } from 'lucide-react'; 
import DevLoginButton from '@/components/auth/DevLoginButton';

const FreelaOSLoginLogo = () => (
  <svg width="48" height="48" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-2">
    <rect width="100" height="100" rx="15" fill="hsl(var(--primary))"/>
    <path d="M25 75V25L50 50L25 75Z" fill="hsl(var(--primary-foreground))"/>
    <path d="M75 25V75L50 50L75 25Z" fill="hsl(var(--primary-foreground))"/>
    <rect x="45" y="15" width="10" height="70" fill="hsl(var(--primary))"/>
  </svg>
);

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const statusQuery = searchParams?.status;
  let initialMessage = '';
  let messageType : 'success' | 'error' | undefined = undefined;

  const isDevMode = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

  if (statusQuery === 'pending_approval') {
    initialMessage = 'Registro bem-sucedido! Sua conta aguarda aprovação de um administrador.';
    messageType = 'success';
  } else if (statusQuery === 'logged_out') {
    initialMessage = 'Você foi desconectado com sucesso.';
    messageType = 'success';
  } else if (statusQuery === 'not_approved') {
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
            <p className="text-muted">Login Administrador</p>
          </div>
          
          <AuthForm initialMessage={initialMessage} initialMessageType={messageType} />

          {isDevMode && (
            <div className="mt-2">
                <DevLoginButton />
            </div>
          )}

          <div className="text-center mt-4">
            <p className="mb-1 small text-muted">Outras opções:</p>
            <Link href="/partner-login" className="fw-medium text-decoration-none mx-2 small">
              Login Parceiro
            </Link>
             | 
            <Link href="/register" className="fw-medium text-decoration-none mx-2 small">
              Registrar Nova Conta
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
