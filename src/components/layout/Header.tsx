
'use client';

import Link from 'next/link';
import type { SessionPayload, AuthActionState } from '@/lib/types';
import { Moon, Sun, UserCircle, LogOut, Briefcase, Settings, KeyRound } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { logoutAction } from '@/lib/actions/auth-actions';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';
import NotificationBell from '@/components/notifications/NotificationBell';

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
  const router = useRouter();
  const [logoutState, logoutFormAction] = useActionState(logoutAction, initialLogoutState);

  useEffect(() => {
    if (logoutState?.type === 'success' && logoutState?.redirect) {
      router.push(logoutState.redirect);
    }
  }, [logoutState, router]);

  let greeting = "Olá!";
  let homeLink = "/login";
  let userIcon = <UserCircle className="text-secondary" size={24} />;

  if (session) {
    if (session.sessionType === 'admin') {
      greeting = session.username;
      homeLink = "/dashboard";
      userIcon = <UserCircle className="text-secondary" size={24} aria-label={`Usuário: ${session.username}`} />;
    } else if (session.sessionType === 'partner') {
      greeting = session.partnerName;
      homeLink = "/partner/dashboard";
      userIcon = <Briefcase className="text-secondary" size={24} aria-label={`Parceiro: ${session.partnerName}`} />;
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
            className={`btn btn-sm me-2 ${theme === 'dark' ? 'btn-outline-light' : 'btn-outline-secondary'}`}
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          
          {session && <NotificationBell />} 

          {session ? (
            <div className="dropdown ms-2">
              <button className="btn btn-sm btn-light dropdown-toggle d-flex align-items-center border" type="button" id="userDropdown" data-bs-toggle="dropdown" aria-expanded="false">
                 {userIcon}
                 <span className="navbar-text ms-2 d-none d-sm-inline text-truncate" style={{maxWidth: '150px'}}>{greeting}</span>
              </button>
              <ul className="dropdown-menu dropdown-menu-end" aria-labelledby="userDropdown">
                <li>
                    <h6 className="dropdown-header small text-muted">
                        {session.sessionType === 'admin' ? `Admin: ${session.username}` : `Parceiro: ${session.partnerName}`}
                    </h6>
                </li>
                <li>
                    <Link href="/settings" className="dropdown-item d-flex align-items-center">
                        <Settings size={16} className="me-2" />
                        Configurações
                    </Link>
                </li>
                <li><hr className="dropdown-divider" /></li>
                <li>
                    <form action={logoutFormAction} className="dropdown-item p-0">
                        <button type="submit" className="btn btn-link text-danger text-decoration-none dropdown-item d-flex align-items-center">
                            <LogOut size={16} className="me-2" /> Sair
                        </button>
                    </form>
                </li>
              </ul>
            </div>
          ) : (
            // Fallback for non-logged in users on pages with a header (if any)
            <div className="d-flex gap-2">
                <Link href="/login" className="btn btn-sm btn-outline-primary">Admin Login</Link>
                <Link href="/partner-login" className="btn btn-sm btn-outline-info">Parceiro Login</Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
