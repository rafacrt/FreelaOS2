// src/components/layout/AuthenticatedLayout.tsx
'use client';

import type { ReactNode } from 'react';
import type { SessionPayload } from '@/lib/types';
import { SessionContext } from '@/contexts/SessionContext'; // Importar do local correto

// MOCK SESSION - Versão AGGRESSIVE (Directly provided)
// Mantendo o mock direto para este teste de estrutura
const mockPartnerSession: SessionPayload = {
  sessionType: 'partner',
  id: 'mock-partner-id-007-DIRECT-PROVIDER-V4-FINAL-TEST',
  username: 'mock_partner_user_DIRECT_PROVIDER_V4_FINAL_TEST',
  partnerName: 'Mock Partner DIRECT PROVIDER V4 FINAL TEST Inc.',
  email: 'mock.direct.provider.v4.final.test@partner.com',
  isApproved: true,
};

interface AuthenticatedLayoutProps {
  children: ReactNode;
}

export default function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  // Removido o estado interno 'session' e 'useEffect' para este teste.
  // Estamos passando o mockPartnerSession diretamente para o Provider.

  console.log(`[AuthenticatedLayout RENDER ENTRY - DIRECT MOCK PROVIDER V4 FINAL TEST]`);
  console.log('[AuthenticatedLayout RENDER - DIRECT MOCK PROVIDER V4 FINAL TEST] SessionContext object instance:', SessionContext);
  console.log('[AuthenticatedLayout RENDER - DIRECT MOCK PROVIDER V4 FINAL TEST] PROVIDING DIRECT MOCK SESSION TO CONTEXT:', JSON.stringify(mockPartnerSession));

  return (
    <SessionContext.Provider value={mockPartnerSession}>
      <div className="d-flex flex-column min-vh-100">
        {/* Header e Footer poderiam ser adicionados aqui se AuthenticatedLayout fosse um layout de página completo */}
        {/* Por agora, apenas provendo o contexto e a estrutura básica */}
        <main className="container flex-grow-1 py-4 py-lg-5">
          {children}
        </main>
      </div>
    </SessionContext.Provider>
  );
}
