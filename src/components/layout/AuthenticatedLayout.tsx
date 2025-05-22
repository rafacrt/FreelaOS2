
'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import Header from './Header';
import type { User } from '@/lib/types';
import FooterContent from './FooterContent';
import { useOSStore } from '@/store/os-store';
<<<<<<< HEAD
import { getSessionFromToken } from '@/lib/auth-edge'; // Use from auth-edge
import { useRouter } from 'next/navigation';
import { AUTH_COOKIE_NAME } from '@/lib/constants';

// Helper to get cookie client-side
function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined; // Guard for SSR
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
=======
import { getSession } from '@/lib/auth'; // To fetch session on client if needed, though middleware handles redirection
import { useRouter }_from 'next/navigation'; // Corrected import

interface AuthenticatedLayoutProps {
  children: ReactNode;
>>>>>>> 988ed2c (vc não pode colocar tudo isso já no projeto? (essa questão do bcrypt) onde meu trabalho seja unicamente criar as tabelas via sql lá no banco? vc cria uma área para cadastro de usuário, e o primeiro usuário registrado, já vira super admin, e do segundo em diante precisa de aprovação)
}


export default function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authCheckCompleted, setAuthCheckCompleted] = useState(false);

  const initializeStore = useOSStore((state) => state.initializeStore);
  const isStoreInitialized = useOSStore((state) => state.isStoreInitialized);
  const router = useRouter();

  useEffect(() => {
    async function checkAuthAndInit() {
      try {
        const sessionUser = await getSession(); // This will run client-side
        if (!sessionUser) {
          console.log('[AuthenticatedLayout] No session client-side, redirecting to /login.');
          router.push('/login'); // Should be caught by middleware, but as a fallback
          return; // Stop further execution
        }
        setUser(sessionUser);

        if (!isStoreInitialized) {
          console.log('[AuthenticatedLayout] Store not initialized, calling initializeStore.');
          await initializeStore();
        } else {
          console.log('[AuthenticatedLayout] Store already initialized.');
        }
      } catch (e) {
        console.error("[AuthenticatedLayout] Error during auth check or store init:", e);
        router.push('/login'); // Fallback redirect on error
      } finally {
        setIsLoading(false);
        setAuthCheckCompleted(true);
      }
    }
    checkAuthAndInit();
  }, [isStoreInitialized, initializeStore, router]);

  if (isLoading || !authCheckCompleted) {
    return (
      <div className="d-flex flex-column justify-content-center align-items-center text-center bg-light" style={{ minHeight: '100vh' }}>
        <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
          <span className="visually-hidden">Carregando aplicação...</span>
        </div>
        <p className="text-muted">Carregando aplicação...</p>
      </div>
    );
  }
  
<<<<<<< HEAD
  if (!user && authCheckCompleted) { // Only show "Verificando" if auth check is done and still no user
      console.warn("[AuthenticatedLayout] Rendered without user after auth check completed. This implies redirection should occur or has occurred via middleware.");
      return (
         <div className="d-flex flex-column justify-content-center align-items-center text-center bg-light" style={{ minHeight: '100vh' }}>
            <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
              <span className="visually-hidden">Verificando autenticação...</span>
            </div>
            <p className="text-muted">Verificando autenticação...</p>
=======
  // If auth check completed and still no user (should have been redirected by now, but for safety)
  if (!user) {
      // This state should ideally not be reached if middleware and above checks work
      console.warn("[AuthenticatedLayout] Rendered without user after auth check. This indicates a potential issue.");
      return (
         <div className="d-flex flex-column justify-content-center align-items-center text-center bg-light" style={{ minHeight: '100vh' }}>
            <p className="text-danger">Erro de autenticação. Redirecionando...</p>
>>>>>>> 988ed2c (vc não pode colocar tudo isso já no projeto? (essa questão do bcrypt) onde meu trabalho seja unicamente criar as tabelas via sql lá no banco? vc cria uma área para cadastro de usuário, e o primeiro usuário registrado, já vira super admin, e do segundo em diante precisa de aprovação)
         </div>
      );
  }

  return (
    <div className="d-flex flex-column min-vh-100">
      <Header user={user} />
      <main className="container flex-grow-1 py-4 py-lg-5">
        {children}
      </main>
      <footer className="py-3 mt-auto text-center text-body-secondary border-top bg-light">
        <FooterContent />
      </footer>
    </div>
  );
}
