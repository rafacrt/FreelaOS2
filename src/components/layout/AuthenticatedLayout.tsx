
'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation'; 
import type { SessionPayload } from '@/lib/types';
import { SessionContext } from '@/contexts/SessionContext';

interface AuthenticatedLayoutProps {
  children: ReactNode;
}

export default function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    console.log(`[AuthenticatedLayout] Main useEffect triggered. Pathname: ${pathname}.`);
    // console.log('[AuthenticatedLayout mockAndSetSession] Current internal session BEFORE mock set:', JSON.stringify(session)); // Log before setting

    const mockPartnerSession: SessionPayload = {
      sessionType: 'partner',
      id: 'mock-partner-id-007-isolated-layout-direct-set-vNext',
      username: 'mock_partner_user_debug_isolated_layout_direct_set_vNext',
      partnerName: 'Mock Partner Debug Inc. Isolated Layout Direct Set vNext',
      email: 'mock.debug.direct.vNext@partner.com',
      isApproved: true,
    };
    console.log('[AuthenticatedLayout mockAndSetSession] USING MOCK PARTNER SESSION:', JSON.stringify(mockPartnerSession));
    
    // Diretamente define o estado da sessão
    console.log('[AuthenticatedLayout mockAndSetSession MOCK] About to call setSession with MOCK data.');
    setSession(mockPartnerSession); // Isso deve causar uma nova renderização

    console.log('[AuthenticatedLayout] Main useEffect FINISHED setting mock session.');
    
  }, [pathname]); // pathname é uma dependência razoável para reavaliar a "sessão" se a navegação ocorrer

  // Log o estado atual da sessão em cada renderização
  console.log(`[AuthenticatedLayout RENDER] Current internal session state (value of 'session' state):`, JSON.stringify(session));

  if (!session) {
    // Se a sessão ainda for nula (ex: na primeira renderização antes do useEffect rodar), mostra um estado de carregamento.
    console.log('[AuthenticatedLayout RENDER] Showing AuthenticatedLayout loading spinner (internal "session" state is still null).');
    return (
      <div className="d-flex flex-column justify-content-center align-items-center text-center bg-light" style={{ minHeight: '100vh' }}>
        <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
          <span className="visually-hidden">Carregando Layout (direct set)...</span>
        </div>
        <p className="text-muted">Carregando Layout (direct set)...</p>
      </div>
    );
  }
  
  // Se a sessão estiver definida (deve ser mockPartnerSession após o useEffect rodar), proveja-a.
  console.log('[AuthenticatedLayout RENDER] PROVIDING SESSION TO CONTEXT (value should be non-null here):', JSON.stringify(session));
  return (
    <SessionContext.Provider value={session}>
      <div className="d-flex flex-column min-vh-100">
        {/* Header e Footer ainda removidos para este teste */}
        <main className="container flex-grow-1 py-4 py-lg-5">
          {children}
        </main>
      </div>
    </SessionContext.Provider>
  );
}

