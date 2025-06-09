
'use client';

import type { ReactNode } from 'react';
import { useEffect, useState, createContext, useMemo } from 'react';
// import Header from './Header'; // Temporarily commented out
import type { SessionPayload } from '@/lib/types';
// import FooterContent from './FooterContent'; // Temporarily commented out
import { useOSStore } from '@/store/os-store';

// export const SessionContext = createContext<SessionPayload | null>(null); // Temporarily commented out

interface AuthenticatedLayoutProps {
  children: ReactNode;
}

export default function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authCheckCompleted, setAuthCheckCompleted] = useState(false);

  const initializeStore = useOSStore((state) => state.initializeStore);
  const isStoreInitialized = useOSStore((state) => state.isStoreInitialized);

  useEffect(() => {
    console.log('[AuthenticatedLayout SIMPLIFIED] useEffect triggered for session check.');
    async function checkSessionAndInitializeData() {
      setIsLoading(true);
      try {
        const response = await fetch('/api/session');
        if (!response.ok) {
          console.error('[AuthenticatedLayout SIMPLIFIED] API call to /api/session failed:', response.status, await response.text());
          setSession(null);
        } else {
          const sessionData: SessionPayload | null = await response.json();
          console.log('[AuthenticatedLayout SIMPLIFIED] Session data from API:', sessionData);
          setSession(sessionData);

          if (sessionData && !isStoreInitialized) {
            console.log(`[AuthenticatedLayout SIMPLIFIED] Session type ${sessionData.sessionType}, store not initialized, calling initializeStore.`);
            await initializeStore();
          } else if (sessionData && isStoreInitialized) {
            console.log(`[AuthenticatedLayout SIMPLIFIED] Session type ${sessionData.sessionType}, store already initialized.`);
          } else if (!sessionData) {
            console.log('[AuthenticatedLayout SIMPLIFIED] No session data, store initialization skipped if not already done.');
          }
        }
      } catch (e: any) {
        console.error("[AuthenticatedLayout SIMPLIFIED] Error fetching session from API or initializing data:", e);
        setSession(null);
      } finally {
        setIsLoading(false);
        setAuthCheckCompleted(true);
        console.log('[AuthenticatedLayout SIMPLIFIED] Initial auth check and data init complete.');
      }
    }

    checkSessionAndInitializeData();
  }, [isStoreInitialized, initializeStore]);

  // const sessionContextValue = useMemo(() => session, [session]); // Temporarily commented out

  if (isLoading || !authCheckCompleted) {
    return (
      <div className="d-flex flex-column justify-content-center align-items-center text-center bg-light" style={{ minHeight: '100vh' }}>
        <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
          <span className="visually-hidden">Carregando aplicação (AuthenticatedLayout Simplified)...</span>
        </div>
        <p className="text-muted">Carregando aplicação (AuthenticatedLayout Simplified)...</p>
      </div>
    );
  }

  // Temporarily rendering children directly without SessionContext.Provider, Header, or Footer
  return (
    <div className="d-flex flex-column min-vh-100">
      {/* <Header session={session} /> */}
      <main className="container flex-grow-1 py-4 py-lg-5">
        {children}
      </main>
      {/* 
      <footer className="py-3 mt-auto text-center text-body-secondary border-top bg-light">
        <FooterContent />
      </footer> 
      */}
    </div>
  );
  
  /* Original return:
  return (
    <SessionContext.Provider value={sessionContextValue}>
      <div className="d-flex flex-column min-vh-100">
        <Header session={session} />
        <main className="container flex-grow-1 py-4 py-lg-5">
          {children}
        </main>
        <footer className="py-3 mt-auto text-center text-body-secondary border-top bg-light">
          <FooterContent />
        </footer>
      </div>
    </SessionContext.Provider>
  );
  */
}
