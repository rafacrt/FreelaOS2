
import RegisterForm from '@/components/auth/RegisterForm';
import Link from 'next/link';

export default function RegisterPage() {
  return (
    <div className="d-flex align-items-center justify-content-center min-vh-100 bg-light">
      <div className="card shadow-lg" style={{ width: '100%', maxWidth: '450px' }}>
        <div className="card-body p-4 p-md-5">
          <div className="text-center mb-4">
           <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary mb-2"><path d="M9.75 2.75H4.75C3.64543 2.75 2.75 3.64543 2.75 4.75V9.75C2.75 10.8546 3.64543 11.75 4.75 11.75H9.75C10.8546 11.75 11.75 10.8546 11.75 9.75V4.75C11.75 3.64543 10.8546 2.75 9.75 2.75Z"></path><path d="M19.25 2.75H14.25C13.1454 2.75 12.25 3.64543 12.25 4.75V9.75C12.25 10.8546 13.1454 11.75 14.25 11.75H19.25C20.3546 11.75 21.25 10.8546 21.25 9.75V4.75C21.25 3.64543 20.3546 2.75 19.25 2.75Z"></path><path d="M9.75 12.25H4.75C3.64543 12.25 2.75 13.1454 2.75 14.25V19.25C2.75 20.3546 3.64543 21.25 4.75 21.25H9.75C10.8546 21.25 11.75 20.3546 11.75 19.25V14.25C11.75 13.1454 10.8546 12.25 9.75 12.25Z"></path><path d="M15.75 18.25H12.75V15.25H15.75V18.25Z"></path><path d="M18.25 15.75H15.75V12.75H18.25V15.75Z"></path><path d="M21.25 15.75H18.25V12.75H21.25V15.75Z"></path><path d="M21.25 18.25H18.25V15.25H21.25V18.25Z"></path><path d="M15.75 21.25H12.75V18.25H15.75V21.25Z"></path><path d="M18.25 21.25H15.75V18.25H18.25V21.25Z"></path><path d="M21.25 21.25H18.25V18.25H21.25V21.25Z"></path></svg>
            <h1 className="h3 fw-bold mb-0">Criar Conta</h1>
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
