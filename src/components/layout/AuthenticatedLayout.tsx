
'use client';

import type { ReactNode } from 'react';
import { useEffect, useState, createContext } from 'react';
// Header e Footer ainda comentados para simplificar
// import Header from './Header';
// import type { SessionPayload } from '@/lib/types'; // SessionPayload já importado em types
import type { SessionPayload } from '@/lib/types';
// import FooterContent from './FooterContent';
// import { useOSStore } from '@/store/os-store'; // Temporarily remove store logic from layout
import { useRouter, usePathname } from 'next/navigation';

export const SessionContext = createContext<SessionPayload | null>(null);

interface AuthenticatedLayoutProps {
  children: ReactNode;
}

export default function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Começa true
  const [authCheckCompleted, setAuthCheckCompleted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // useEffect para logar mudanças no estado 'session' interno do AuthenticatedLayout
  useEffect(() => {
    console.log('[AuthenticatedLayout] Internal session state CHANGED to:', JSON.stringify(session));
  }, [session]);

  useEffect(() => {
    let isMounted = true;
    console.log(`[AuthenticatedLayout] Main useEffect triggered. Pathname: ${pathname}. Initial isLoading: ${isLoading}, Initial authCheckCompleted: ${authCheckCompleted}`);

    async function mockAndCheckSession() {
      console.log('[AuthenticatedLayout mockAndCheckSession] Initiated.');
      setIsLoading(true); // Sempre começa o processo de carregamento
      setAuthCheckCompleted(false);

      const mockPartnerSession: SessionPayload = {
        sessionType: 'partner',
        id: 'mock-partner-id-007',
        username: 'mock_partner_user_debug',
        partnerName: 'Mock Partner Debug Inc.',
        email: 'mock.debug@partner.com',
        isApproved: true,
      };
      console.log('[AuthenticatedLayout mockAndCheckSession] USING MOCK PARTNER SESSION:', JSON.stringify(mockPartnerSession));

      // Simula um pequeno atraso, como uma chamada de API
      await new Promise(resolve => setTimeout(resolve, 100)); // Pequeno delay

      if (isMounted) {
        console.log('[AuthenticatedLayout mockAndCheckSession MOCK] About to call setSession with MOCK data.');
        setSession(mockPartnerSession); // Define a sessão mockada
        console.log('[AuthenticatedLayout mockAndCheckSession MOCK] Store initialization logic temporarily skipped for this test.');
      }
    }

    mockAndCheckSession().finally(() => {
      if (isMounted) {
        const finalSessionStateForLog = session; // Capture current value of session for logging
        console.log(`[AuthenticatedLayout mockAndCheckSession finally] Setting isLoading: false, authCheckCompleted: true. Current internal session state:`, JSON.stringify(finalSessionStateForLog));
        setIsLoading(false);
        setAuthCheckCompleted(true);
      }
    });

    return () => {
      isMounted = false;
      console.log('[AuthenticatedLayout] Main useEffect cleanup. Pathname was:', pathname);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]); // Depender apenas de pathname para re-executar em mudança de rota.

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

  // Fallback de segurança (não deve ser atingido com mock)
  const publicPaths = ['/login', '/register', '/partner-login', '/health'];
  if (authCheckCompleted && !session && !publicPaths.includes(pathname)) {
     console.warn("[AuthenticatedLayout RENDER] Auth check complete, NO SESSION, on protected path. This should not happen with mock. Redirecting for safety.");
     if (typeof window !== 'undefined') {
        // router.push('/login'); // Avoid direct push in render
     }
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
    
