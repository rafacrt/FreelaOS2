
'use client';

import type { ReactNode } from 'react';
import { useEffect, useState, createContext, useMemo } from 'react';
import Header from './Header';
import type { SessionPayload } from '@/lib/types';
import FooterContent from './FooterContent';
import { useOSStore } from '@/store/os-store';
// getSessionFromToken e AUTH_COOKIE_NAME não são mais usados diretamente aqui
// import { getSessionFromToken } from '@/lib/auth-edge';
// import { AUTH_COOKIE_NAME } from '@/lib/constants';

export const SessionContext = createContext<SessionPayload | null>(null);

// getCookie não é mais necessário aqui, pois a API route lida com o cookie
// function getCookie(name: string): string | undefined { ... }

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
    console.log('[AuthenticatedLayout] useEffect triggered for session check.');
    async function checkSessionAndInitializeData() {
      try {
        const response = await fetch('/api/session');
        if (!response.ok) {
          console.error('[AuthenticatedLayout] API call to /api/session failed:', response.status, await response.text());
          setSession(null);
        } else {
          const sessionData: SessionPayload | null = await response.json();
          console.log('[AuthenticatedLayout] Session data from API:', sessionData);
          setSession(sessionData);

          // Initialize store for any logged-in user if it's not already initialized
          if (sessionData && !isStoreInitialized) {
            console.log(`[AuthenticatedLayout] Session type ${sessionData.sessionType}, store not initialized, calling initializeStore.`);
            await initializeStore();
          } else if (sessionData && isStoreInitialized) {
            console.log(`[AuthenticatedLayout] Session type ${sessionData.sessionType}, store already initialized.`);
          } else if (!sessionData) {
            console.log('[AuthenticatedLayout] No session data, store initialization skipped if not already done.');
          }
        }
      } catch (e: any) {
        console.error("[AuthenticatedLayout] Error fetching session from API or initializing data:", e);
        setSession(null);
      } finally {
        setIsLoading(false);
        setAuthCheckCompleted(true);
        console.log('[AuthenticatedLayout] Initial auth check and data init complete.');
      }
    }

    checkSessionAndInitializeData();
  }, [isStoreInitialized, initializeStore]); // initializeStore é estável, isStoreInitialized é a chave aqui

  const sessionContextValue = useMemo(() => session, [session]);

  if (isLoading || !authCheckCompleted) {
    return (
      <div className="d-flex flex-column justify-content-center align-items-center text-center bg-light" style={{ minHeight: '100vh' }}>
        <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
          <span className="visually-hidden">Carregando aplicação...</span>
        </div>
        <p className="text-muted">Carregando aplicação...</p>
      </div>
    );
  }

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
}
