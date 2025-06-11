
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
  const [isLoading, setIsLoading] = useState(true); 
  const [authCheckCompleted, setAuthCheckCompleted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const initializeStore = useOSStore((state) => state.initializeStore);
  const isStoreInitializedHook = useOSStore((state) => state.isStoreInitialized); // Renomeado para evitar conflito de escopo

  // Log para quando o estado da sessão interna do AuthenticatedLayout muda
  useEffect(() => {
    console.log('[AuthenticatedLayout] Internal session state CHANGED to:', session);
  }, [session]);

  // Log para quando authCheckCompleted muda
  useEffect(() => {
    console.log('[AuthenticatedLayout] authCheckCompleted CHANGED to:', authCheckCompleted);
  }, [authCheckCompleted]);

  useEffect(() => {
    console.log(`[AuthenticatedLayout] Main useEffect triggered. Pathname: ${pathname}, Current internal session:`, session, `isStoreInitialized (from store hook): ${isStoreInitializedHook}`);
    let isMounted = true;

    async function checkSession() {
      console.log('[AuthenticatedLayout checkSession] Initiated.');
      setIsLoading(true); 

      try {
        const res = await fetch('/api/session');
        if (!isMounted) {
            console.log('[AuthenticatedLayout checkSession] Component unmounted before fetch completed.');
            return;
        }

        const responseText = await res.text(); 
        console.log('[AuthenticatedLayout checkSession] API /api/session response status:', res.status, 'Response text:', responseText);

        if (res.ok) {
          const sessionData: SessionPayload | null = responseText ? JSON.parse(responseText) : null;
          console.log('[AuthenticatedLayout checkSession] Parsed sessionData from API:', sessionData);
          
          if (isMounted) {
            setSession(sessionData); // Atualiza o estado da sessão
            console.log('[AuthenticatedLayout checkSession] setSession called with:', sessionData);
          }


          if (!sessionData) {
            const publicPaths = ['/login', '/register', '/partner-login', '/health'];
            if (!publicPaths.includes(pathname)) {
                console.log('[AuthenticatedLayout checkSession] No sessionData, redirecting to login page from protected path:', pathname);
                router.push('/login');
            }
          } else {
            if (!sessionData.isApproved) {
                console.log(`[AuthenticatedLayout checkSession] Session for ${sessionData.username || (sessionData as any).partnerName} exists but is NOT approved. Redirecting.`);
                const targetLogin = sessionData.sessionType === 'admin' ? '/login' : '/partner-login';
                router.push(`${targetLogin}?status=not_approved`);
            } else {
                 // Usar getState() para obter o valor mais recente do store aqui é crucial
                 const currentStoreInitialized = useOSStore.getState().isStoreInitialized;
                 console.log(`[AuthenticatedLayout checkSession] Session type ${sessionData.sessionType}. Current isStoreInitialized (via getState()): ${currentStoreInitialized}`);
                 if (!currentStoreInitialized) {
                    console.log(`[AuthenticatedLayout checkSession] Store not yet initialized. Calling initializeStore.`);
                    await initializeStore(); // initializeStore deve ter sua própria guarda interna
                    console.log(`[AuthenticatedLayout checkSession] initializeStore call completed. isStoreInitialized NOW (via getState()): ${useOSStore.getState().isStoreInitialized}`);
                 } else {
                    console.log(`[AuthenticatedLayout checkSession] Store already initialized.`);
                 }
            }
          }
        } else {
          console.error('[AuthenticatedLayout checkSession] Failed to fetch session status. Status:', res.status);
          if (isMounted) setSession(null);
           if (!['/login', '/register', '/partner-login', '/health'].includes(pathname)) {
             router.push('/login');
           }
        }
      } catch (error) {
        console.error('[AuthenticatedLayout checkSession] Error fetching session:', error);
        if (isMounted) setSession(null);
         if (!['/login', '/register', '/partner-login', '/health'].includes(pathname)) {
           router.push('/login');
         }
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setAuthCheckCompleted(true);
          console.log(`[AuthenticatedLayout checkSession] Finalized. isLoading: false, authCheckCompleted: true.`);
        }
      }
    }

    checkSession();

    return () => {
      isMounted = false;
      console.log('[AuthenticatedLayout] Main useEffect cleanup. Pathname was:', pathname);
    };
  // A dependência initializeStore é uma função do Zustand, geralmente estável.
  // A remoção de isStoreInitializedHook da lista de dependências é intencional
  // para evitar loops, pois a verificação é feita com getState() dentro do checkSession.
  }, [pathname, router, initializeStore]);


  console.log('[AuthenticatedLayout RENDER] Current internal session (before context provider):', session, `authCheckCompleted: ${authCheckCompleted}`, `isLoading: ${isLoading}`);


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

  console.log('[AuthenticatedLayout RENDER] Passing to SessionContext.Provider, value:', session);
  return (
    <SessionContext.Provider value={session}> 
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
    