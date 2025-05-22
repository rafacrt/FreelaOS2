
'use client';

import Link from 'next/link';
import type { User } from '@/lib/types';
import { Moon, Sun, UserCircle, LogOut, LogIn, UserPlus } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { logoutAction } from '@/lib/actions/auth-actions';
import { usePathname } from 'next/navigation';

// Updated Abstract Logo SVG (Orange Theme)
const FreelaOSLogo = () => (
  <svg width="28" height="28" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="15" fill="hsl(var(--primary))"/> {/* Main Orange background */}
    <path d="M25 75V25L50 50L25 75Z" fill="hsl(var(--primary-foreground))"/> {/* White/Light foreground element */}
    <path d="M75 25V75L50 50L75 25Z" fill="hsl(var(--primary-foreground))"/>
    {/* Changed blue accent to a slightly different orange or primary-foreground for simplicity */}
    <rect x="45" y="15" width="10" height="70" fill="hsl(var(--primary-foreground))"/>
  </svg>
);


export default function Header({ user }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();

  const handleLogout = async () => {
    await logoutAction();
  };

  const showAuthButtons = !user && pathname !== '/login' && pathname !== '/register';

  const showAuthButtons = !user && pathname !== '/login' && pathname !== '/register';

  return (
    <header className="navbar navbar-expand-sm navbar-light bg-light border-bottom sticky-top shadow-sm" data-bs-theme={theme === 'dark' ? 'dark' : 'light'}>
      <div className="container">
        <Link href={user ? "/dashboard" : "/login"} className="navbar-brand d-flex align-items-center">
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

          {user ? (
            <div className="d-flex align-items-center">
              <UserCircle className="text-secondary me-2" size={24} aria-label={`Usuário: ${user.username}`} />
              <span className="navbar-text me-3 d-none d-sm-inline">{user.username} {user.isAdmin && <span className="badge bg-primary ms-1 small">Admin</span>}</span>
              <form action={handleLogout}>
                <button type="submit" className="btn btn-sm btn-outline-danger d-flex align-items-center">
                  <LogOut size={16} className="me-1" /> Sair
                </button>
              </form>
            </div>
          ) : (
            showAuthButtons && (
                <div className="d-flex gap-2">
                    <Link href="/login" className="btn btn-sm btn-outline-primary d-flex align-items-center">
                        <LogIn size={16} className="me-1" /> Entrar
                    </Link>
                    <Link href="/register" className="btn btn-sm btn-primary d-flex align-items-center">
                         <UserPlus size={16} className="me-1" /> Registrar
                    </Link>
                </div>
            )
          )}
        </div>
      </div>
    </header>
  );
}

    