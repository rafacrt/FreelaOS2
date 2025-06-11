
'use client'; // Necessário para useActionState e useEffect

// import PartnerAuthForm from '@/components/auth/PartnerAuthForm'; // Removido
import Link from 'next/link';
import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { devLoginAction, simulatePartnerLoginAction } from '@/lib/actions/auth-actions';
import type { AuthActionState } from '@/lib/types';
import { SimulatedLoginButton } from '@/components/auth/SimulatedLoginButton';
import { AlertCircle, ShieldCheck, Briefcase } from 'lucide-react'; // Ícones para os botões // UserShield substituído por ShieldCheck

// Logo SVG (Orange Theme)
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
  const router = useRouter();
  const initialActionState: AuthActionState = { message: null, type: undefined, redirect: undefined };

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

  // Ações e estados para cada botão de login simulado
  const [adminLoginState, adminLoginSubmitAction] = useActionState(devLoginAction, initialActionState);
  const [partnerLoginState, partnerLoginSubmitAction] = useActionState(simulatePartnerLoginAction, initialActionState);

  // Efeitos para redirecionamento e tratamento de mensagens de erro/sucesso
  useEffect(() => {
    if (adminLoginState?.type === 'success' && adminLoginState?.redirect) {
      router.push(adminLoginState.redirect);
    }
  }, [adminLoginState, router]);

  useEffect(() => {
    if (partnerLoginState?.type === 'success' && partnerLoginState?.redirect) {
      router.push(partnerLoginState.redirect);
    }
  }, [partnerLoginState, router]);


  return (
    <div className="d-flex align-items-center justify-content-center min-vh-100 bg-light">
      <div className="card shadow-lg" style={{ width: '100%', maxWidth: '400px' }}>
        <div className="card-body p-4 p-md-5">
          <div className="text-center mb-4">
            <FreelaOSPartnerLoginLogo />
            <h1 className="h3 fw-bold mb-0" style={{ color: 'hsl(var(--primary))' }}>FreelaOS</h1>
            <p className="text-muted">Acesso Rápido Parceiro (Temporário)</p>
          </div>

           {/* Mensagem inicial da URL */}
          {initialMessage && (
            <div className={`alert ${messageType === 'error' ? 'alert-danger' : 'alert-success'} d-flex align-items-center p-2`} role="alert">
              {messageType === 'error' && <AlertCircle size={18} className="me-2 flex-shrink-0" />}
              <small>{initialMessage}</small>
            </div>
          )}

          {/* Mensagem de erro do login de Parceiro Simulado */}
          {partnerLoginState?.type === 'error' && partnerLoginState.message && (
            <div className="alert alert-danger d-flex align-items-center p-2" role="alert">
              <AlertCircle size={18} className="me-2 flex-shrink-0" />
              <small>{partnerLoginState.message}</small>
            </div>
          )}
          <form action={partnerLoginSubmitAction} className="mb-3">
            <SimulatedLoginButton
              buttonText="Entrar como Parceiro"
              className="btn-info"
              icon={<Briefcase size={16} className="me-2" />}
            />
          </form>

          {/* Mensagem de erro do login de Admin Simulado */}
          {adminLoginState?.type === 'error' && adminLoginState.message && (
            <div className="alert alert-danger d-flex align-items-center p-2" role="alert">
              <AlertCircle size={18} className="me-2 flex-shrink-0" />
              <small>{adminLoginState.message}</small>
            </div>
          )}
          <form action={adminLoginSubmitAction}>
            <SimulatedLoginButton
              buttonText="Entrar como Admin"
              icon={<ShieldCheck size={16} className="me-2" />}
            />
          </form>

          <div className="text-center mt-4">
             <p className="mb-1 small text-muted">Acesso normal:</p>
            <Link href="/login" className="fw-medium text-decoration-none mx-2 small" onClick={(e) => {
                e.preventDefault();
                alert("O formulário de login normal está temporariamente desabilitado. Use os botões acima.");
              }}
            >
              Login Admin
            </Link>
             | 
            <Link href="/partner-login" className="fw-medium text-decoration-none mx-2 small" onClick={(e) => {
                e.preventDefault();
                alert("O formulário de login de parceiro está temporariamente desabilitado. Use os botões acima.");
              }}
            >
              Login Parceiro
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
