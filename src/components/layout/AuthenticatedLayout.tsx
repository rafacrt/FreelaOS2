
// src/components/layout/AuthenticatedLayout.tsx
'use client';

import type { ReactNode } from 'react';
import { useState, useEffect } from 'react';
import type { SessionPayload } from '@/lib/types';
import { SessionContext } from '@/contexts/SessionContext';
import { useOSStore } from '@/store/os-store';
import Header from './Header';
import FooterContent from './FooterContent';
import { usePathname } from 'next/navigation';

interface AuthenticatedLayoutProps {
  children: ReactNode;
}

export default function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const { initializeStore, isStoreInitialized } = useOSStore();
  const pathname = usePathname();

  useEffect(() => {
    let isMounted = true;

    async function fetchSessionData() {
      setIsLoadingSession(true);
      try {
        const response = await fetch('/api/session');
        if (!response.ok) {
          throw new Error(`API responded with ${response.status}`);
        }
        const sessionData: SessionPayload | null = await response.json();
        if (isMounted) {
          setSession(sessionData);
        }
      } catch (error) {
        if (isMounted) {
          setSession(null);
        }
      } finally {
        if (isMounted) {
          setIsLoadingSession(false);
        }
      }
    }

    fetchSessionData();

    return () => {
      isMounted = false;
    };
  }, [pathname]); // Re-fetch session if pathname changes

  useEffect(() => {
    if (!isLoadingSession && !isStoreInitialized) {
      initializeStore().then(() => {
      }).catch(err => {
      });
    }
  }, [isLoadingSession, isStoreInitialized, initializeStore, session]); // Add session as dependency

  const showFullLayout = !pathname.startsWith('/login') && !pathname.startsWith('/register') && !pathname.startsWith('/partner-login');

  if (isLoadingSession && showFullLayout) { // Only show full page spinner for protected routes
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100 bg-light">
        <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
          <span className="visually-hidden">Carregando sessão...</span>
        </div>
      </div>
    );
  }
  
  // For public pages (login, register, partner-login), render children immediately if session is still loading
  // The pages themselves can handle their own loading states or content based on session presence.
  // Middleware should handle redirects if session exists for public pages.

  return (
    <SessionContext.Provider value={session}>
      <div className="d-flex flex-column min-vh-100">
        {showFullLayout && <Header session={session} />}
        <main className={`flex-grow-1 ${showFullLayout ? 'container py-3 py-md-4' : ''}`}>
          {isLoadingSession && !showFullLayout ? (
             <div className="d-flex justify-content-center align-items-center min-vh-100 bg-light">
                <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
                    <span className="visually-hidden">Carregando...</span>
                </div>
            </div>
          ) : children}
        </main>
        {showFullLayout && (
          <footer className="footer mt-auto py-3 bg-light border-top text-center no-print">
            <div className="container footer-content-container">
              <FooterContent />
            </div>
          </footer>
        )}
      </div>
    </SessionContext.Provider>
  );
}
