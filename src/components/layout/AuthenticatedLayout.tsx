
'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
// import { usePathname } from 'next/navigation'; // Removido para mock único
import type { SessionPayload } from '@/lib/types';
import { SessionContext } from '@/contexts/SessionContext';

interface AuthenticatedLayoutProps {
  children: ReactNode;
}

export default function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const [session, setSession] = useState<SessionPayload | null>(null);

  console.log(`[AuthenticatedLayout RENDER] Current internal session state (value of 'session' state):`, JSON.stringify(session));
  console.log('[AuthenticatedLayout RENDER] SessionContext object instance:', SessionContext);


  useEffect(() => {
    console.log(`[AuthenticatedLayout] Main useEffect (ONE-TIME MOCK) triggered.`);
    // SIMULATE MOCK PARTNER SESSION
    const mockPartnerSession: SessionPayload = {
      sessionType: 'partner',
      id: 'mock-partner-id-007-AGGRESSIVE-ONETIME-V2',
      username: 'mock_partner_user_AGGRESSIVE_ONETIME_V2',
      partnerName: 'Mock Partner AGGRESSIVE ONETIME V2 Inc.',
      email: 'mock.aggressive.onetime.v2@partner.com',
      isApproved: true,
    };
    console.log('[AuthenticatedLayout MOCK] About to call setSession with MOCK data:', JSON.stringify(mockPartnerSession));
    setSession(mockPartnerSession); 
    console.log('[AuthenticatedLayout MOCK] setSession called.');
    
  }, []); // Array de dependências VAZIO: executa apenas uma vez após a montagem

  if (!session) {
    console.log('[AuthenticatedLayout RENDER] Showing AuthenticatedLayout loading spinner (internal "session" state is still null).');
    return (
      <div className="d-flex flex-column justify-content-center align-items-center text-center bg-light" style={{ minHeight: '100vh' }}>
        <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
          <span className="visually-hidden">Carregando Layout (session null)...</span>
        </div>
        <p className="text-muted">Carregando Layout (session null)...</p>
      </div>
    );
  }
  
  // Se chegamos aqui, 'session' não é mais null e deve ser o objeto mockado.
  console.log('[AuthenticatedLayout RENDER] PROVIDING SESSION TO CONTEXT (value should be non-null here):', JSON.stringify(session));
  return (
    <SessionContext.Provider value={session}>
      <div className="d-flex flex-column min-vh-100">
        {/* Header/Footer ainda removidos para simplificar a depuração deste problema específico */}
        <main className="container flex-grow-1 py-4 py-lg-5">
          {children}
        </main>
      </div>
    </SessionContext.Provider>
  );
}
