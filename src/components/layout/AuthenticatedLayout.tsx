
'use client';

import type { ReactNode } from 'react';
import { useEffect, useState, createContext } from 'react';
// import Header from './Header'; // Ainda comentado conforme depuração anterior
import type { SessionPayload } from '@/lib/types';
// import FooterContent from './FooterContent'; // Ainda comentado
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

  useEffect(() => {
    console.log('[AuthenticatedLayout] Internal session state CHANGED to:', session);
  }, [session]);

  useEffect(() => {
    let isMounted = true;
    console.log(`[AuthenticatedLayout] Main useEffect triggered. Pathname: ${pathname}. Initial isLoading: ${isLoading}, Initial authCheckCompleted: ${authCheckCompleted}`);

    async function checkSession() {
      console.log('[AuthenticatedLayout checkSession] Initiated.');
      setIsLoading(true);
      setAuthCheckCompleted(false);

      // TEMPORARY DEBUGGING: Force mock partner session
      const mockPartnerSession: SessionPayload = {
        sessionType: 'partner',
        id: 'mock-partner-id-007',
        username: 'mock_partner_user_debug',
        partnerName: 'Mock Partner Debug Inc.',
        email: 'mock.debug@partner.com',
        isApproved: true,
      };
      console.log('[AuthenticatedLayout checkSession] USING MOCK PARTNER SESSION:', JSON.stringify(mockPartnerSession));
      
      // Simulate a small delay like an API call might have
      await new Promise(resolve => setTimeout(resolve, 50)); 

      if (isMounted) {
        setSession(mockPartnerSession); // Set the mock session

        // Simulate store initialization after setting mock session
        const currentStoreInitialized = useOSStore.getState().isStoreInitialized;
        console.log(`[AuthenticatedLayout checkSession MOCK] Current isStoreInitialized (via getState()): ${currentStoreInitialized}`);
        if (!currentStoreInitialized) {
          console.log(`[AuthenticatedLayout checkSession MOCK] Store not yet initialized. Calling initializeStore.`);
          await initializeStore();
          console.log(`[AuthenticatedLayout checkSession MOCK] initializeStore call completed. isStoreInitialized NOW (via getState()): ${useOSStore.getState().isStoreInitialized}`);
        } else {
          console.log(`[AuthenticatedLayout checkSession MOCK] Store already initialized.`);
        }
        
        setIsLoading(false);
        setAuthCheckCompleted(true);
        // Log the session state *after* all async operations related to it are done within this scope
        console.log(`[AuthenticatedLayout checkSession MOCK] Finalized. isLoading: false, authCheckCompleted: true. Current internal session state:`, JSON.stringify(get().session)); // Use get().session for the most up-to-date value if setSession is batched
      }
      return; // End checkSession early, skipping actual API call
    }

    checkSession();

    return () => {
      isMounted = false;
      console.log('[AuthenticatedLayout] Main useEffect cleanup. Pathname was:', pathname);
    };
  }, [pathname, router, initializeStore]); // initializeStore is stable, pathname/router for route changes

  // Helper function to access the current session state for logging,
  // as direct access to `session` variable inside `checkSession` after `setSession` call
  // might not reflect the updated value immediately due to batching.
  const get = () => ({ session });


  console.log(`[AuthenticatedLayout RENDER] isLoading: ${isLoading}, authCheckCompleted: ${authCheckCompleted}, Current session state (before context provider):`, JSON.stringify(session));

  if (isLoading || !authCheckCompleted) {
    console.log('[AuthenticatedLayout RENDER] Showing initial loading spinner (isLoading or !authCheckCompleted).');
    return (
      <div className="d-flex flex-column justify-content-center align-items-center text-center bg-light" style={{ minHeight: '100vh' }}>
        <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
          <span className="visually-hidden">Verificando sessão (mock)...</span>
        </div>
        <p className="text-muted">Verificando sessão (mock)...</p>
      </div>
    );
  }

  // With mock session, this redirect logic for !session on protected path shouldn't trigger
  // if the mock session is correctly set and propagated.
  const publicPaths = ['/login', '/register', '/partner-login', '/health'];
  if (authCheckCompleted && !session && !publicPaths.includes(pathname)) {
     console.log("[AuthenticatedLayout RENDER] Auth check complete, NO SESSION, on protected path. This should not happen with mock. Redirecting for safety.");
     router.push('/login'); // Fallback redirect
     return (
        <div className="d-flex flex-column justify-content-center align-items-center text-center bg-light" style={{ minHeight: '100vh' }}>
            <div className="spinner-border text-danger mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
                <span className="visually-hidden">Erro de Sessão / Redirecionando...</span>
            </div>
            <p className="text-danger">Erro de Sessão. Redirecionando...</p>
        </div>
     );
  }

  return (
    <SessionContext.Provider value={session}>
      <div className="d-flex flex-column min-vh-100">
        {/* <Header session={session} /> */}
        <main className="container flex-grow-1 py-4 py-lg-5">
          {children}
        </main>
        {/* <footer className="py-3 mt-auto text-center text-body-secondary border-top bg-light">
          <FooterContent />
        </footer> */}
      </div>
    </SessionContext.Provider>
  );
}
