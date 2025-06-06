
'use client';

import Link from 'next/link';
import type { SessionPayload, AuthActionState } from '@/lib/types'; // Use SessionPayload, import AuthActionState
import { Moon, Sun, UserCircle, LogOut, LogIn, UserPlus, Briefcase } from 'lucide-react'; // Added Briefcase for Partner
import { useTheme } from '@/hooks/useTheme';
import { logoutAction } from '@/lib/actions/auth-actions';
import { usePathname, useRouter } from 'next/navigation'; // Import useRouter
import { useActionState, useEffect } from 'react'; // Import useEffect

const FreelaOSLogo = () => (
  <svg width="28" height="28" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="15" fill="hsl(var(--primary))"/>
    <path d="M25 75V25L50 50L25 75Z" fill="hsl(var(--primary-foreground))"/>
    <path d="M75 25V75L50 50L75 25Z" fill="hsl(var(--primary-foreground))"/>
    <rect x="45" y="15" width="10" height="70" fill="hsl(var(--primary-foreground))"/>
  </svg>
);

interface HeaderProps {
  session: SessionPayload | null;
}

const initialLogoutState: AuthActionState = {
  message: null,
  type: undefined,
  redirect: undefined,
};

export default function Header({ session }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter(); // Initialize router
  const [logoutState, logoutFormAction] = useActionState(logoutAction, initialLogoutState);

  useEffect(() => {
    if (logoutState?.type === 'success' && logoutState?.redirect) {
      console.log(`[Header] Logout success. Redirecting to: ${logoutState.redirect}`);
      router.push(logoutState.redirect);
    } else if (logoutState?.type === 'error') {
      console.error(`[Header] Logout error: ${logoutState.message}`);
      // Você pode adicionar um toast de erro aqui, se desejar.
    }
  }, [logoutState, router]);

  const isLoginPage = pathname === '/login';
  const isRegisterPage = pathname === '/register';
  const isPartnerLoginPage = pathname === '/partner-login';
  const showAuthButtons = !session && !isLoginPage && !isRegisterPage && !isPartnerLoginPage;

  let greeting = "Olá!";
  let isAdminBadge = false;
  let isPartnerBadge = false;
  let homeLink = "/login";

  if (session) {
    if (session.sessionType === 'admin') {
      greeting = `Olá, ${session.username}`;
      isAdminBadge = session.isAdmin;
      homeLink = "/dashboard";
    } else if (session.sessionType === 'partner') {
      greeting = `Olá, ${session.partnerName}`;
      isPartnerBadge = true;
      homeLink = "/partner/dashboard";
    }
  }

  return (
    <header className="navbar navbar-expand-sm navbar-light bg-light border-bottom sticky-top shadow-sm" data-bs-theme={theme === 'dark' ? 'dark' : 'light'}>
      <div className="container">
        <Link href={homeLink} className="navbar-brand d-flex align-items-center">
          <FreelaOSLogo />
          <span className="fs-5 fw-bold ms-2" style={{ color: 'hsl(var(--primary))' }}>FreelaOS</span>
        </Link>

        <div className="d-flex align-items-center ms-auto">
          <button
            className={`btn btn-sm me-3 ${theme === 'dark' ? 'btn-outline-light' : 'btn-outline-secondary'}`}
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {session ? (
            <div className="d-flex align-items-center">
              {session.sessionType === 'admin' ? 
                <UserCircle className="text-secondary me-2" size={24} aria-label={`Usuário: ${session.username}`} />
                : <Briefcase className="text-secondary me-2" size={24} aria-label={`Parceiro: ${session.partnerName}`} />
              }
              <span className="navbar-text me-3 d-none d-sm-inline">
                {greeting}
                {isAdminBadge && <span className="badge bg-primary ms-1 small">Admin</span>}
                {isPartnerBadge && <span className="badge bg-info ms-1 small">Parceiro</span>}
              </span>
              <form action={logoutFormAction}>
                <button type="submit" className="btn btn-sm btn-outline-danger d-flex align-items-center">
                  <LogOut size={16} className="me-1" /> Sair
                </button>
              </form>
            </div>
          ) : (
            showAuthButtons && (
                <div className="d-flex gap-2">
                    <Link href="/login" className="btn btn-sm btn-outline-primary d-flex align-items-center">
                        <LogIn size={16} className="me-1" /> Admin Login
                    </Link>
                    <Link href="/partner-login" className="btn btn-sm btn-outline-info d-flex align-items-center">
                        <LogIn size={16} className="me-1" /> Parceiro Login 
                    </Link>
                </div>
            )
          )}
        </div>
      </div>
    </header>
  );
}
