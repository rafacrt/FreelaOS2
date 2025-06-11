
'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation'; // Keep useRouter and usePathname
import type { SessionPayload } from '@/lib/types';
import { SessionContext } from '@/contexts/SessionContext';
// Store logic is still removed for this specific test

interface AuthenticatedLayoutProps {
  children: ReactNode;
}

export default function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [isLoadingLayout, setIsLoadingLayout] = useState(true); // Manages the loading state of the layout

  const router = useRouter(); // Keep router
  const pathname = usePathname(); // Keep pathname

  // Effect to log internal session state changes in AuthenticatedLayout
  useEffect(() => {
    console.log('[AuthenticatedLayout] Internal session state (from session state watcher useEffect) CHANGED to:', JSON.stringify(session));
  }, [session]);

  useEffect(() => {
    let isMounted = true;
    console.log(`[AuthenticatedLayout] Main useEffect triggered. Pathname: ${pathname}.`);

    async function mockAndSetSession() {
      console.log('[AuthenticatedLayout mockAndSetSession] Initiated with MOCK.');

      const mockPartnerSession: SessionPayload = {
        sessionType: 'partner',
        id: 'mock-partner-id-007-isolated-layout-delayed',
        username: 'mock_partner_user_debug_isolated_layout_delayed',
        partnerName: 'Mock Partner Debug Inc. Isolated Layout Delayed',
        email: 'mock.debug.delayed@partner.com',
        isApproved: true,
      };
      console.log('[AuthenticatedLayout mockAndSetSession] USING MOCK PARTNER SESSION:', JSON.stringify(mockPartnerSession));

      // Set the session state
      if (isMounted) {
        console.log('[AuthenticatedLayout mockAndSetSession MOCK] About to call setSession with MOCK data.');
        setSession(mockPartnerSession);
      }

      // Introduce a small delay AFTER setting the session, then set isLoadingLayout to false
      // This gives React a cycle to process the session state update before children are rendered.
      setTimeout(() => {
        if (isMounted) {
          console.log(`[AuthenticatedLayout] Delay timer expired, setting isLoadingLayout to false. Current session:`, JSON.stringify(mockPartnerSession)); // Log session at this point
          setIsLoadingLayout(false);
        }
      }, 100); // 100ms delay, can be adjusted

      // Store initialization logic is still removed for this test
    }

    mockAndSetSession(); // No .finally here as isLoadingLayout is set inside setTimeout

    return () => {
      isMounted = false;
      console.log('[AuthenticatedLayout] Main useEffect cleanup. Pathname was:', pathname);
    };
  }, [pathname]); // Minimal dependencies for this test

  console.log(`[AuthenticatedLayout RENDER] isLoadingLayout: ${isLoadingLayout}, Current session state (before context provider or loading):`, JSON.stringify(session));

  if (isLoadingLayout || !session) { // Show loading if layout is loading OR session is still null
    console.log('[AuthenticatedLayout RENDER] Showing AuthenticatedLayout loading spinner (isLoadingLayout or session is null).');
    return (
      <div className="d-flex flex-column justify-content-center align-items-center text-center bg-light" style={{ minHeight: '100vh' }}>
        <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
          <span className="visually-hidden">Carregando Layout (mock, com delay)...</span>
        </div>
        <p className="text-muted">Carregando Layout (mock, com delay)...</p>
      </div>
    );
  }
  
  // If we reach here, isLoadingLayout is false and session is not null
  console.log('[AuthenticatedLayout RENDER] PROVIDING SESSION TO CONTEXT (value should be non-null here):', JSON.stringify(session));
  return (
    <SessionContext.Provider value={session}>
      <div className="d-flex flex-column min-vh-100">
        {/* Header and Footer are still removed for this test */}
        <main className="container flex-grow-1 py-4 py-lg-5">
          {children}
        </main>
      </div>
    </SessionContext.Provider>
  );
}
