// src/components/layout/AuthenticatedLayout.tsx
'use client';

import type { ReactNode } from 'react';
import { useLayoutEffect, useState } from 'react'; // Mudado para useLayoutEffect
import type { SessionPayload } from '@/lib/types';
import { SessionContext } from '@/contexts/SessionContext';

// MOCK SESSION - Versão AGGRESSIVE V4
const mockPartnerSession: SessionPayload = {
  sessionType: 'partner',
  id: 'mock-partner-id-007-AGGRESSIVE-V4',
  username: 'mock_partner_user_AGGRESSIVE_V4',
  partnerName: 'Mock Partner AGGRESSIVE V4 Inc.',
  email: 'mock.aggressive.v4@partner.com',
  isApproved: true,
};

export default function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const [session, setSession] = useState<SessionPayload | null>(null);

  console.log(`[AuthenticatedLayout RENDER ENTRY] Current internal session state (before useLayoutEffect):`, JSON.stringify(session));
  console.log('[AuthenticatedLayout RENDER ENTRY] SessionContext object instance:', SessionContext);

  // Alterado para useLayoutEffect
  useLayoutEffect(() => {
    console.log(`[AuthenticatedLayout] Main useLayoutEffect (ONE-TIME MOCK) triggered.`);
    console.log('[AuthenticatedLayout MOCK] About to call setSession with MOCK data:', JSON.stringify(mockPartnerSession));
    setSession(mockPartnerSession);
    console.log('[AuthenticatedLayout MOCK] setSession called.');
  }, []); // Array de dependências VAZIO

  // Este useEffect continua como useEffect normal para observar mudanças
  useState(() => {
    console.log(`[AuthenticatedLayout] Internal 'session' state CHANGED to (via state observer):`, JSON.stringify(session));
  });


  if (!session) {
    console.log('[AuthenticatedLayout RENDER] Internal session state is NULL. Rendering AuthenticatedLayout loading spinner...');
    return (
      <div className="d-flex flex-column align-items-center justify-content-center text-center p-4" style={{ minHeight: '100vh' }}>
        <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
          <span className="visually-hidden">Carregando Layout Autenticado (Sessão Interna)...</span>
        </div>
        <p className="text-muted fs-5">Carregando Layout Autenticado (Sessão Interna)...</p>
      </div>
    );
  }

  console.log('[AuthenticatedLayout RENDER] Internal session state IS POPULATED. PROVIDING SESSION TO CONTEXT:', JSON.stringify(session));
  return (
    <SessionContext.Provider value={session}>
      <div className="d-flex flex-column min-vh-100">
        <main className="container flex-grow-1 py-4 py-lg-5">
          {children}
        </main>
      </div>
    </SessionContext.Provider>
  );
}
