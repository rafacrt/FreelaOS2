
'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { SessionPayload } from '@/lib/types';
import { SessionContext } from '@/contexts/SessionContext';
// import { useOSStore } from '@/store/os-store'; // Store logic still removed for this test
// import Header from './Header'; // Header still removed
// import FooterContent from './FooterContent'; // Footer still removed

interface AuthenticatedLayoutProps {
  children: ReactNode;
}

export default function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [isLoadingLayout, setIsLoadingLayout] = useState(true); // New state for layout loading

  const router = useRouter();
  const pathname = usePathname();
  // const { initializeStore, isStoreInitialized: isStoreInitializedState } = useOSStore(); // Store logic still removed

  // Effect to log internal session state changes in AuthenticatedLayout
  useEffect(() => {
    console.log('[AuthenticatedLayout] Internal session state CHANGED to:', JSON.stringify(session));
    if (session !== null) {
        setIsLoadingLayout(false); // Once session is set (even to mock), layout is "ready"
    }
  }, [session]);

  useEffect(() => {
    let isMounted = true;
    console.log(`[AuthenticatedLayout] Main useEffect triggered. Pathname: ${pathname}.`);

    async function mockAndSetSession() {
      console.log('[AuthenticatedLayout mockAndSetSession] Initiated with MOCK.');

      const mockPartnerSession: SessionPayload = {
        sessionType: 'partner',
        id: 'mock-partner-id-007-isolated-layout',
        username: 'mock_partner_user_debug_isolated_layout',
        partnerName: 'Mock Partner Debug Inc. Isolated Layout',
        email: 'mock.debug.isolated.layout@partner.com',
        isApproved: true,
      };
      console.log('[AuthenticatedLayout mockAndSetSession] USING MOCK PARTNER SESSION:', JSON.stringify(mockPartnerSession));

      // Simulate a small delay, like an API call or internal processing
      await new Promise(resolve => setTimeout(resolve, 50));

      if (isMounted) {
        console.log('[AuthenticatedLayout mockAndSetSession MOCK] About to call setSession with MOCK data.');
        setSession(mockPartnerSession); // This should trigger the useEffect above to set isLoadingLayout to false
        
        // Store initialization logic is still removed for this test
        // console.log('[AuthenticatedLayout mockAndSetSession MOCK] Store initialization logic TEMPORARILY SKIPPED.');
      }
    }

    mockAndSetSession().finally(() => {
      if (isMounted) {
        const finalSessionStateForLog = session;
        console.log(`[AuthenticatedLayout mockAndSetSession MOCK] Finalized. Current internal session state for 'finally' block:`, JSON.stringify(finalSessionStateForLog));
        // setIsLoadingLayout(false) is now handled by the useEffect watching `session`
      }
    });

    return () => {
      isMounted = false;
      console.log('[AuthenticatedLayout] Main useEffect cleanup. Pathname was:', pathname);
    };
  }, [pathname]); // Minimal dependencies

  console.log(`[AuthenticatedLayout RENDER] isLoadingLayout: ${isLoadingLayout}, Current session state (before context provider or loading):`, JSON.stringify(session));

  if (isLoadingLayout || !session) { // Show loading if layout is loading OR session is still null
    console.log('[AuthenticatedLayout RENDER] Showing AuthenticatedLayout loading spinner (isLoadingLayout or session is null).');
    return (
      <div className="d-flex flex-column justify-content-center align-items-center text-center bg-light" style={{ minHeight: '100vh' }}>
        <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
          <span className="visually-hidden">Carregando Layout (mock)...</span>
        </div>
        <p className="text-muted">Carregando Layout (mock)...</p>
      </div>
    );
  }
  
  // If we reach here, isLoadingLayout is false and session is not null
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
