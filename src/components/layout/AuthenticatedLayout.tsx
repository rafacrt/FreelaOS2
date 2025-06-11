
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
  // Estado interno para a sessão
  const [session, setSession] = useState<SessionPayload | null>(null);

  console.log(`[AuthenticatedLayout RENDER] Current internal session state (value of 'session' state):`, JSON.stringify(session));
  console.log('[AuthenticatedLayout RENDER] SessionContext object instance:', SessionContext);


  useEffect(() => {
    console.log(`[AuthenticatedLayout] Main useEffect (ONE-TIME MOCK) triggered.`);
    // SIMULATE MOCK PARTNER SESSION
    const mockPartnerSession: SessionPayload = {
      sessionType: 'partner',
      id: 'mock-partner-id-007-AGGRESSIVE-ONETIME-V2', // Changed version for clarity
      username: 'mock_partner_user_AGGRESSIVE_ONETIME_V2',
      partnerName: 'Mock Partner AGGRESSIVE ONETIME V2 Inc.',
      email: 'mock.aggressive.onetime.v2@partner.com',
      isApproved: true,
    };
    console.log('[AuthenticatedLayout MOCK] About to call setSession with MOCK data:', JSON.stringify(mockPartnerSession));
    setSession(mockPartnerSession); // Define a sessão mockada
    console.log('[AuthenticatedLayout MOCK] setSession called.');
    
  }, []); // Array de dependências VAZIO: executa apenas uma vez após a montagem

  // Não há mais spinner aqui baseado no estado interno de 'session' do AuthenticatedLayout.
  // O SessionContext.Provider sempre renderizará, e seu 'value' mudará de null para o objeto mockado.
  // Os componentes filhos (como PartnerDashboardPage) devem reagir a essa mudança de contexto.

  console.log('[AuthenticatedLayout RENDER] PROVIDING SESSION TO CONTEXT (value might be null initially, then mocked session):', JSON.stringify(session));
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
