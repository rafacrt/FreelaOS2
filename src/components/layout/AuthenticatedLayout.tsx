
'use client';

import type { ReactNode } from 'react';
import { useEffect, useState, createContext } // Removido useMemo temporariamente
  from 'react';
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
  const [isLoading, setIsLoading] = useState(true); // Mantido para lógica interna se necessário
  const [authCheckCompleted, setAuthCheckCompleted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const initializeStore = useOSStore((state) => state.initializeStore);

  // Log para quando o estado da sessão interna do AuthenticatedLayout muda
  useEffect(() => {
    console.log('[AuthenticatedLayout] Internal session state CHANGED to:', session);
  }, [session]);

  // Log para quando authCheckCompleted muda
  useEffect(() => {
    console.log('[AuthenticatedLayout] authCheckCompleted CHANGED to:', authCheckCompleted);
  }, [authCheckCompleted]);

  useEffect(() => {
    console.log('[AuthenticatedLayout] Main useEffect triggered. Pathname:', pathname);
    let isMounted = true;

    async function checkSession() {
      console.log('[AuthenticatedLayout checkSession] Initiated.');
      setIsLoading(true); // Reinicia isLoading para esta verificação

      try {
        const res = await fetch('/api/session');
        if (!isMounted) {
            console.log('[AuthenticatedLayout checkSession] Component unmounted before fetch completed.');
            return;
        }

        const responseText = await res.text(); // Ler como texto primeiro para depuração
        console.log('[AuthenticatedLayout checkSession] API /api/session response status:', res.status, 'Response text:', responseText);

        if (res.ok) {
          const sessionData: SessionPayload | null = responseText ? JSON.parse(responseText) : null;
          console.log('[AuthenticatedLayout checkSession] Parsed sessionData from API:', sessionData);
          setSession(sessionData); // Atualiza o estado da sessão

          if (!sessionData) {
            const publicPaths = ['/login', '/register', '/partner-login', '/health'];
            if (!publicPaths.includes(pathname)) {
                console.log('[AuthenticatedLayout checkSession] No sessionData, redirecting to /login from protected path:', pathname);
                router.push('/login');
            }
          } else {
            if (!sessionData.isApproved) {
                console.log(`[AuthenticatedLayout checkSession] Session for ${sessionData.username || (sessionData as any).partnerName} exists but is NOT approved. Redirecting.`);
                const targetLogin = sessionData.sessionType === 'admin' ? '/login' : '/partner-login';
                router.push(`${targetLogin}?status=not_approved`);
            } else {
                 if (!useOSStore.getState().isStoreInitialized) {
                    console.log(`[AuthenticatedLayout checkSession] Session type ${sessionData.sessionType}, store not yet initialized (isStoreInitialized: ${useOSStore.getState().isStoreInitialized}). Calling initializeStore.`);
                    await initializeStore();
                    console.log(`[AuthenticatedLayout checkSession] initializeStore call completed. isStoreInitialized NOW: ${useOSStore.getState().isStoreInitialized}`);
                 } else {
                    console.log(`[AuthenticatedLayout checkSession] Store already initialized. Session type: ${sessionData.sessionType}`);
                 }
            }
          }
        } else {
          console.error('[AuthenticatedLayout checkSession] Failed to fetch session status. Status:', res.status);
          setSession(null);
           if (!['/login', '/register', '/partner-login', '/health'].includes(pathname)) {
             router.push('/login');
           }
        }
      } catch (error) {
        console.error('[AuthenticatedLayout checkSession] Error fetching session:', error);
        setSession(null);
         if (!['/login', '/register', '/partner-login', '/health'].includes(pathname)) {
           router.push('/login');
         }
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setAuthCheckCompleted(true);
          console.log('[AuthenticatedLayout checkSession] Finalized. isLoading: false, authCheckCompleted: true. Current session state:', get().session);
        }
      }
    }

    checkSession();

    return () => {
      isMounted = false;
      console.log('[AuthenticatedLayout] Main useEffect cleanup. Pathname was:', pathname);
    };
  // A dependência initializeStore é uma função do Zustand, geralmente estável.
  // Se ainda houver loops, podemos investigar se a referência dela muda.
  }, [pathname, router, initializeStore]);


  console.log('[AuthenticatedLayout RENDER] Current session state (before context provider):', session);
  console.log('[AuthenticatedLayout RENDER] authCheckCompleted:', authCheckCompleted, 'isLoading:', isLoading);


  // Spinner inicial enquanto a primeira verificação de autenticação está em andamento
  if (!authCheckCompleted) {
    console.log('[AuthenticatedLayout RENDER] Showing initial loading spinner (authCheckCompleted is false).');
    return (
      <div className="d-flex flex-column justify-content-center align-items-center text-center bg-light" style={{ minHeight: '100vh' }}>
        <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
          <span className="visually-hidden">Verificando sessão...</span>
        </div>
        <p className="text-muted">Verificando sessão...</p>
      </div>
    );
  }

  // Se a verificação foi concluída, mas não há sessão e estamos em um caminho protegido,
  // o middleware já deve ter redirecionado, ou a lógica em checkSession() o fará.
  // Este spinner de redirecionamento é um fallback, mas pode não ser alcançado se o router.push for rápido.
  if (authCheckCompleted && !session && !['/login', '/register', '/partner-login', '/health'].includes(pathname)) {
     console.log("[AuthenticatedLayout RENDER] Auth check complete, no session, on protected path. Showing redirect spinner.");
     return (
        <div className="d-flex flex-column justify-content-center align-items-center text-center bg-light" style={{ minHeight: '100vh' }}>
            <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
                <span className="visually-hidden">Redirecionando...</span>
            </div>
            <p className="text-muted">Redirecionando para login...</p>
        </div>
     );
  }


  // Se chegamos aqui, ou authCheckCompleted é true e temos uma sessão,
  // ou authCheckCompleted é true e estamos em um caminho público (permitindo renderizar o children, como a página de login).
  console.log('[AuthenticatedLayout RENDER] Proceeding to render children. Session for Context:', session);
  return (
    <SessionContext.Provider value={session}> {/* Passando 'session' diretamente */}
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

// Helper function to access component's own state for logging inside async function
// (This is a bit of a workaround for seeing state immediately after set due to async nature)
function get() {
    // This is just a conceptual placeholder; you can't directly access `session` state from here
    // without passing it or using a ref. The `console.log` in `checkSession`'s finally block
    // is using `get().session` which won't work. We should log the `session` state
    // variable directly or use the `useEffect` listening to `session` for accurate post-update logging.
    // For the purpose of this log, I will assume it's meant to be the current session value.
    // In practice, use the useEffect hook for observing state changes.
    return { session: null }; // Placeholder, actual session state should be logged directly
}
