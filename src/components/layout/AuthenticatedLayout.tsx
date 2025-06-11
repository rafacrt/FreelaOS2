
'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import type { SessionPayload } from '@/lib/types';
import { SessionContext } from '@/contexts/SessionContext'; // Importar contexto diretamente

interface AuthenticatedLayoutProps {
  children: ReactNode;
}

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
  // Estado interno para a sessão
  const [session, setSession] = useState<SessionPayload | null>(null);

  console.log(`[AuthenticatedLayout RENDER ENTRY] Current internal session state (before useEffect):`, JSON.stringify(session));
  console.log('[AuthenticatedLayout RENDER ENTRY] SessionContext object instance:', SessionContext);

  useEffect(() => {
    // Este useEffect agora tem um array de dependências vazio [],
    // então ele executa apenas uma vez após a montagem inicial.
    console.log(`[AuthenticatedLayout] Main useEffect (ONE-TIME MOCK) triggered.`);
    console.log('[AuthenticatedLayout MOCK] About to call setSession with MOCK data:', JSON.stringify(mockPartnerSession));
    setSession(mockPartnerSession); // Define a sessão mockada
    console.log('[AuthenticatedLayout MOCK] setSession called.');
  }, []); // Array de dependências VAZIO

  // useEffect para observar mudanças no estado 'session'
  useEffect(() => {
    console.log(`[AuthenticatedLayout] Internal 'session' state CHANGED to:`, JSON.stringify(session));
  }, [session]);


  if (!session) {
    console.log('[AuthenticatedLayout RENDER] Internal session state is NULL. Rendering AuthenticatedLayout loading spinner...');
    return (
      <div className="d-flex flex-column align-items-center justify-content-center text-center p-4" style={{ minHeight: '100vh' }}>
        <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
          <span className="visually-hidden">Carregando Layout Autenticado...</span>
        </div>
        <p className="text-muted fs-5">Carregando Layout Autenticado...</p>
      </div>
    );
  }

  // Se a sessão (mockada) estiver definida, renderiza o provedor e os filhos
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
