
import RegisterForm from '@/components/auth/RegisterForm';
import Link from 'next/link';

// New Abstract Logo SVG (Orange)
const FreelaOSRegisterLogo = () => (
  <svg width="48" height="48" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-2">
    <rect width="100" height="100" rx="15" fill="hsl(var(--primary))"/> {/* Orange background */}
    <path d="M25 75V25L50 50L25 75Z" fill="hsl(var(--primary-foreground))"/> {/* White/Light foreground element */}
    <path d="M75 25V75L50 50L75 25Z" fill="hsl(var(--primary-foreground))"/>
    {/* Elemento que era azul, agora laranja ou removido/ajustado */}
    <rect x="45" y="15" width="10" height="70" fill="hsl(var(--primary))"/> {/* Orange accent or same as primary */}
  </svg>
);

export default function RegisterPage() {
  return (
    <div className="d-flex align-items-center justify-content-center min-vh-100 bg-light">
      <div className="card shadow-lg" style={{ width: '100%', maxWidth: '450px' }}>
        <div className="card-body p-4 p-md-5">
          <div className="text-center mb-4">
           <FreelaOSRegisterLogo />
            <h1 className="h3 fw-bold mb-0" style={{ color: 'hsl(var(--primary))' }}>Criar Conta</h1>
            <p className="text-muted">Primeiro usuário será administrador.</p>
          </div>
          <RegisterForm />
          <div className="text-center mt-4">
            <p className="mb-0">Já tem uma conta?</p>
            <Link href="/login" className="fw-medium text-primary text-decoration-none">
              Faça login aqui
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
