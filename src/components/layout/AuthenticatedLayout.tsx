// src/components/layout/AuthenticatedLayout.tsx
'use client';

import type { ReactNode } from 'react';
// import { useLayoutEffect, useState } from 'react'; // Removido useState e useLayoutEffect
import type { SessionPayload } from '@/lib/types';
import { SessionContext } from '@/contexts/SessionContext';

// MOCK SESSION - Versão AGGRESSIVE V4 (mantida para consistência do teste)
const mockPartnerSession: SessionPayload = {
  sessionType: 'partner',
  id: 'mock-partner-id-007-AGGRESSIVE-V4',
  username: 'mock_partner_user_AGGRESSIVE_V4',
  partnerName: 'Mock Partner AGGRESSIVE V4 Inc.',
  email: 'mock.aggressive.v4@partner.com',
  isApproved: true,
};

interface AuthenticatedLayoutProps {
  children: ReactNode;
}

export default function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  // O estado 'session' e o useEffect/useLayoutEffect que o definia foram removidos.
  // Estamos passando o mockPartnerSession diretamente para o Provider.

  console.log(`[AuthenticatedLayout RENDER ENTRY - NO INTERNAL SESSION STATE]`);
  console.log('[AuthenticatedLayout RENDER ENTRY] SessionContext object instance:', SessionContext);
  console.log('[AuthenticatedLayout RENDER] PROVIDING DIRECT MOCK SESSION TO CONTEXT:', JSON.stringify(mockPartnerSession));

  return (
    <SessionContext.Provider value={mockPartnerSession}>
      <div className="d-flex flex-column min-vh-100">
        <main className="container flex-grow-1 py-4 py-lg-5">
          {children}
        </main>
      </div>
    </SessionContext.Provider>
  );
}
