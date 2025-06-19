
'use client';

import PartnerAuthForm from '@/components/auth/PartnerAuthForm'; 
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';

const FreelaOSPartnerLoginLogo = () => (
  <svg width="48" height="48" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-2">
    <rect width="100" height="100" rx="15" fill="hsl(var(--primary))"/>
    <path d="M25 75V25L50 50L25 75Z" fill="hsl(var(--primary-foreground))"/>
    <path d="M75 25V75L50 50L75 25Z" fill="hsl(var(--primary-foreground))"/>
    <rect x="45" y="15" width="10" height="70" fill="hsl(var(--primary))"/>
  </svg>
);

export default function PartnerLoginPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const statusQuery = searchParams?.status;
  let initialMessage = '';
  let messageType : 'success' | 'error' | undefined = undefined;

  if (statusQuery === 'logged_out') {
    initialMessage = 'Você foi desconectado com sucesso.';
    messageType = 'success';
  } else if (statusQuery === 'not_approved') {
    initialMessage = 'Sua conta de parceiro ainda não foi aprovada. Por favor, aguarde a aprovação de um administrador.';
    messageType = 'error';
  }

  return (
    <div className="d-flex align-items-center justify-content-center min-vh-100 bg-light">
      <div className="card shadow-lg" style={{ width: '100%', maxWidth: '400px' }}>
        <div className="card-body p-4 p-md-5">
          <div className="text-center mb-4">
            <FreelaOSPartnerLoginLogo />
            <h1 className="h3 fw-bold mb-0" style={{ color: 'hsl(var(--primary))' }}>FreelaOS</h1>
            <p className="text-muted">Login Parceiro</p>
          </div>

          <PartnerAuthForm initialMessage={initialMessage} initialMessageType={messageType} />

          <div className="text-center mt-4">
             <p className="mb-1 small text-muted">Outras opções:</p>
            <Link href="/login" className="fw-medium text-decoration-none mx-2 small">
              Login Admin
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
