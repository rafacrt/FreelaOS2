
'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { SessionPayload } from '@/lib/types';
// import { useOSStore } from '@/store/os-store'; // Temporarily removed store logic
import { SessionContext } from '@/contexts/SessionContext'; // Import from new location

interface AuthenticatedLayoutProps {
  children: ReactNode;
}

export default function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authCheckCompleted, setAuthCheckCompleted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  // const { initializeStore, isStoreInitialized: isStoreInitializedState } = useOSStore(); // Temporarily removed

  // Effect to log internal session state changes in AuthenticatedLayout
  useEffect(() => {
    console.log('[AuthenticatedLayout] Internal session state CHANGED to:', JSON.stringify(session));
  }, [session]);

  useEffect(() => {
    let isMounted = true;
    console.log(`[AuthenticatedLayout] Main useEffect triggered. Pathname: ${pathname}.`);

    async function mockAndCheckSession() {
      console.log('[AuthenticatedLayout mockAndCheckSession] Initiated with MOCK.');
      setIsLoading(true);
      setAuthCheckCompleted(false);

      const mockPartnerSession: SessionPayload = {
        sessionType: 'partner',
        id: 'mock-partner-id-007-isolated',
        username: 'mock_partner_user_debug_isolated',
        partnerName: 'Mock Partner Debug Inc. Isolated',
        email: 'mock.debug.isolated@partner.com',
        isApproved: true,
      };
      console.log('[AuthenticatedLayout mockAndCheckSession] USING MOCK PARTNER SESSION:', JSON.stringify(mockPartnerSession));

      // Simulate a small delay, like an API call
      await new Promise(resolve => setTimeout(resolve, 50)); // Small delay

      if (isMounted) {
        console.log('[AuthenticatedLayout mockAndCheckSession MOCK] About to call setSession with MOCK data.');
        setSession(mockPartnerSession);
        // console.log('[AuthenticatedLayout mockAndCheckSession MOCK] Store initialization logic TEMPORARILY SKIPPED.');
      }
    }

    mockAndCheckSession().finally(() => {
      if (isMounted) {
        const finalSessionStateForLog = session; // Capture current value of session for logging in finally
        console.log(`[AuthenticatedLayout mockAndCheckSession MOCK] Finalized. Current internal session state for 'finally' block:`, JSON.stringify(finalSessionStateForLog));
        setIsLoading(false);
        setAuthCheckCompleted(true);
        console.log(`[AuthenticatedLayout mockAndCheckSession MOCK] setIsLoading: false, authCheckCompleted: true. Session (post-finally log):`, JSON.stringify(session));
      }
    });

    return () => {
      isMounted = false;
      console.log('[AuthenticatedLayout] Main useEffect cleanup. Pathname was:', pathname);
    };
  }, [pathname]); // Depend on pathname to re-run if route changes.

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

  // Fallback if auth check is complete but session is still null (should not happen with mock)
  const publicPaths = ['/login', '/register', '/partner-login', '/health'];
  if (authCheckCompleted && !session && !publicPaths.includes(pathname)) {
     console.warn("[AuthenticatedLayout RENDER] Auth check complete, NO SESSION, on protected path. This should ideally not be reached with mock. Redirecting for safety (simulated).");
     // In a real scenario, you might redirect:
     // if (typeof window !== 'undefined') { router.push('/login'); }
     return (
        <div className="d-flex flex-column justify-content-center align-items-center text-center bg-light" style={{ minHeight: '100vh' }}>
            <div className="spinner-border text-danger mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
                <span className="visually-hidden">Erro de Sessão / Redirecionando...</span>
            </div>
            <p className="text-danger">Erro de Sessão. Necessário redirecionamento.</p>
        </div>
     );
  }
  
  console.log('[AuthenticatedLayout RENDER] PROVIDING SESSION TO CONTEXT:', JSON.stringify(session));
  return (
    <SessionContext.Provider value={session}>
      <div className="d-flex flex-column min-vh-100">
        {/* Header and Footer remain commented out for this test */}
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
