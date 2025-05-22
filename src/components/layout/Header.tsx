
'use client';

import Link from 'next/link';
import type { User } from '@/lib/types'; // Still using User type for potential display
import { Moon, Sun, UserCircle } from 'lucide-react'; // Removed LogOut
import { useTheme } from '@/hooks/useTheme';
// Removed logout action import

interface HeaderProps {
  user: User | null; // User can be null if no mock user is passed
}

// New Abstract Logo SVG (Orange and Blue)
const FreelaOSLogo = () => (
  <svg width="28" height="28" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="15" fill="hsl(var(--primary))"/> {/* Orange background */}
    <path d="M25 75V25L50 50L25 75Z" fill="hsl(var(--primary-foreground))"/> {/* White/Light foreground element */}
    <path d="M75 25V75L50 50L75 25Z" fill="hsl(var(--primary-foreground))"/>
    <rect x="45" y="15" width="10" height="70" fill="hsl(var(--secondary))"/> {/* Blue accent */}
  </svg>
);


export default function Header({ user }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();

  // Logout handler removed

  const showAuthButtons = !user && pathname !== '/login' && pathname !== '/register';

  return (
    <header className={`navbar navbar-expand-sm border-bottom sticky-top shadow-sm ${theme === 'dark' ? 'navbar-dark bg-dark' : 'navbar-light bg-light'}`} data-bs-theme={theme}>
      <div className="container">
        <Link href="/dashboard" className="navbar-brand d-flex align-items-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary me-2"><path d="M9.75 2.75H4.75C3.64543 2.75 2.75 3.64543 2.75 4.75V9.75C2.75 10.8546 3.64543 11.75 4.75 11.75H9.75C10.8546 11.75 11.75 10.8546 11.75 9.75V4.75C11.75 3.64543 10.8546 2.75 9.75 2.75Z"></path><path d="M19.25 2.75H14.25C13.1454 2.75 12.25 3.64543 12.25 4.75V9.75C12.25 10.8546 13.1454 11.75 14.25 11.75H19.25C20.3546 11.75 21.25 10.8546 21.25 9.75V4.75C21.25 3.64543 20.3546 2.75 19.25 2.75Z"></path><path d="M9.75 12.25H4.75C3.64543 12.25 2.75 13.1454 2.75 14.25V19.25C2.75 20.3546 3.64543 21.25 4.75 21.25H9.75C10.8546 21.25 11.75 20.3546 11.75 19.25V14.25C11.75 13.1454 10.8546 12.25 9.75 12.25Z"></path><path d="M15.75 18.25H12.75V15.25H15.75V18.25Z"></path><path d="M18.25 15.75H15.75V12.75H18.25V15.75Z"></path><path d="M21.25 15.75H18.25V12.75H21.25V15.75Z"></path><path d="M21.25 18.25H18.25V15.25H21.25V18.25Z"></path><path d="M15.75 21.25H12.75V18.25H15.75V21.25Z"></path><path d="M18.25 21.25H15.75V18.25H18.25V21.25Z"></path><path d="M21.25 21.25H18.25V18.25H21.25V21.25Z"></path></svg>
          <span className="fs-5 fw-bold text-primary">FreelaOS Minimal</span>
        </Link>

        <div className="d-flex align-items-center ms-auto">
          <button
            className={`btn btn-sm me-3 ${theme === 'dark' ? 'btn-outline-light' : 'btn-outline-secondary'}`}
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

            {user ? ( // If a mock user is passed, display it
                <div className="d-flex align-items-center">
                    <UserCircle className="text-secondary me-2" size={24} aria-label={`Usuário: ${user.username}`} />
                    <span className="navbar-text me-3 d-none d-sm-inline">{user.username}</span>
                    {/* Logout button removed */}
                </div>
            ) : (
                 <UserCircle className="text-secondary" size={24} aria-label="Usuário Anônimo" />
                 // Or nothing if no user display is desired without login
            )}
        </div>
      </div>
    </header>
  );
}
