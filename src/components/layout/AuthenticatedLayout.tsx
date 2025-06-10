
'use client';

import type { ReactNode } from 'react';
import { useEffect, useState, createContext, useMemo } from 'react';
import Header from './Header';
import type { SessionPayload } from '@/lib/types';
import FooterContent from './FooterContent';
import { useOSStore } from '@/store/os-store';
import { useRouter, usePathname } from 'next/navigation'; // Import useRouter and usePathname

// SessionContext export is KEPT so that useSession.ts doesn't break.
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
  const isStoreInitialized = useOSStore((state) => state.isStoreInitialized);

  useEffect(() => {
    console.log('[AuthenticatedLayout] useEffect for session check triggered.');
    let isMounted = true;

    async function checkSession() {
      try {
        const res = await fetch('/api/session');
        if (!isMounted) return;

        if (res.ok) {
          const sessionData: SessionPayload | null = await res.json();
          console.log('[AuthenticatedLayout] Session data from API:', sessionData);
          setSession(sessionData);

          if (!sessionData) { // No active session
            // Redirect based on current path if not already on a public/login path
            const publicPaths = ['/login', '/register', '/partner-login', '/health'];
            if (!publicPaths.includes(pathname)) {
                console.log('[AuthenticatedLayout] No session, redirecting to /login from protected path:', pathname);
                router.push('/login'); // Default to admin login
            }
          } else {
            // Session exists, check for approval
            if (!sessionData.isApproved) {
                console.log(`[AuthenticatedLayout] Session for ${sessionData.username} exists but is NOT approved. Redirecting.`);
                const targetLogin = sessionData.sessionType === 'admin' ? '/login' : '/partner-login';
                router.push(`${targetLogin}?status=not_approved`);
            } else {
                // Session is valid and approved. Initialize store if needed.
                 if ((sessionData.sessionType === 'admin' || sessionData.sessionType === 'partner') && !isStoreInitialized) {
                    console.log(`[AuthenticatedLayout] Session type ${sessionData.sessionType}, store not initialized, calling initializeStore.`);
                    await initializeStore();
                 } else {
                    console.log(`[AuthenticatedLayout] Session type ${sessionData.sessionType}, store already initialized or no init needed.`);
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
  }, [pathname, router, initializeStore, isStoreInitialized]);


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

  // If auth check is complete AND there's no session AND we are not on a public path,
  // this state might be briefly visible before middleware or router.push takes effect.
  // Or, if router.push fails or is slow, this helps prevent rendering children without session.
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
