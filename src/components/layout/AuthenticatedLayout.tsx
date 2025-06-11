
'use client';

import type { ReactNode } from 'react';
import { useEffect, useState, createContext, useMemo } from 'react';
import Header from './Header';
import type { SessionPayload } from '@/lib/types';
import FooterContent from './FooterContent';
import { useOSStore } from '@/store/os-store';
import { useRouter, usePathname } from 'next/navigation';

export const SessionContext = createContext<SessionPayload | null>(null);

interface AuthenticatedLayoutProps {
  children: ReactNode;
}

export default function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authCheckCompleted, setAuthCheckCompleted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const initializeStore = useOSStore((state) => state.initializeStore);
  // Não precisamos mais de isStoreInitialized como um estado local ou prop aqui,
  // vamos verificar diretamente o estado do store.

  useEffect(() => {
    console.log('[AuthenticatedLayout] useEffect for session check triggered. Pathname:', pathname);
    let isMounted = true;

    async function checkSession() {
      try {
        const res = await fetch('/api/session');
        if (!isMounted) return;

        if (res.ok) {
          const sessionData: SessionPayload | null = await res.json();
          console.log('[AuthenticatedLayout] Session data from API:', sessionData);
          setSession(sessionData); // Atualiza o estado da sessão

          if (!sessionData) {
            const publicPaths = ['/login', '/register', '/partner-login', '/health'];
            if (!publicPaths.includes(pathname)) {
                console.log('[AuthenticatedLayout] No session, redirecting to /login from protected path:', pathname);
                router.push('/login');
            }
          } else {
            if (!sessionData.isApproved) {
                console.log(`[AuthenticatedLayout] Session for ${sessionData.username || (sessionData as any).partnerName} exists but is NOT approved. Redirecting.`);
                const targetLogin = sessionData.sessionType === 'admin' ? '/login' : '/partner-login';
                router.push(`${targetLogin}?status=not_approved`);
            } else {
                 // Verifica o estado do store DIRETAMENTE antes de inicializar.
                 // Isso evita depender de `isStoreInitialized` na lista de dependências do useEffect.
                 if (!useOSStore.getState().isStoreInitialized) {
                    if (sessionData.sessionType === 'admin' || sessionData.sessionType === 'partner') {
                        console.log(`[AuthenticatedLayout] Session type ${sessionData.sessionType}, store not yet initialized. Calling initializeStore.`);
                        await initializeStore(); // initializeStore é do hook useOSStore
                    }
                 } else {
                    console.log(`[AuthenticatedLayout] Store already initialized. Session type: ${sessionData.sessionType}`);
                 }
            }
          }
        } else {
          console.error('[AuthenticatedLayout] Failed to fetch session status:', res.status, await res.text());
          setSession(null);
           if (!['/login', '/register', '/partner-login', '/health'].includes(pathname)) {
             router.push('/login');
           }
        }
      } catch (error) {
        console.error('[AuthenticatedLayout] Error fetching session:', error);
        setSession(null);
         if (!['/login', '/register', '/partner-login', '/health'].includes(pathname)) {
           router.push('/login');
         }
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setAuthCheckCompleted(true);
          console.log('[AuthenticatedLayout] Initial auth check and data init attempt complete.');
        }
      }
    }

    checkSession();

    return () => {
      isMounted = false;
      console.log('[AuthenticatedLayout] Unmounting or re-running effect.');
    };
  }, [pathname, router, initializeStore]); // Removido isStoreInitialized das dependências


  const sessionContextValue = useMemo(() => session, [session]);

  if (isLoading || !authCheckCompleted) {
    return (
      <div className="d-flex flex-column justify-content-center align-items-center text-center bg-light" style={{ minHeight: '100vh' }}>
        <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
          <span className="visually-hidden">Verificando sessão...</span>
        </div>
        <p className="text-muted">Verificando sessão...</p>
      </div>
    );
  }

  if (authCheckCompleted && !session && !['/login', '/register', '/partner-login', '/health'].includes(pathname)) {
     console.warn("[AuthenticatedLayout] Auth check complete, no session, but on a protected path. Spinner shown while redirect occurs.");
     return (
        <div className="d-flex flex-column justify-content-center align-items-center text-center bg-light" style={{ minHeight: '100vh' }}>
            <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
                <span className="visually-hidden">Redirecionando...</span>
            </div>
            <p className="text-muted">Redirecionando para login...</p>
        </div>
     );
  }


  return (
    <SessionContext.Provider value={sessionContextValue}>
      <div className="d-flex flex-column min-vh-100">
        <Header session={session} />
        <main className="container flex-grow-1 py-4 py-lg-5">
          {children}
        </main>
        <footer className="py-3 mt-auto text-center text-body-secondary border-top bg-light">
          <FooterContent />
        </footer>
      </div>
    </SessionContext.Provider>
  );
}
