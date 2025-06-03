
'use client';

import type { ReactNode } from 'react';
import { useEffect, useState, createContext, useMemo } from 'react'; // Added createContext, useMemo
import Header from './Header';
import type { SessionPayload } from '@/lib/types';
import FooterContent from './FooterContent';
import { useOSStore } from '@/store/os-store';
import { getSessionFromToken } from '@/lib/auth-edge';
import { AUTH_COOKIE_NAME } from '@/lib/constants';

// Define e exporta o Context
export const SessionContext = createContext<SessionPayload | null>(null);

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    const cookieValue = parts.pop()?.split(';').shift();
    return cookieValue;
  }
  return undefined;
}

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
    console.log('[AuthenticatedLayout] useEffect triggered.');
    async function checkSessionAndInitializeData() {
      try {
        const tokenValue = getCookie(AUTH_COOKIE_NAME);
        const sessionData = await getSessionFromToken(tokenValue);

        if (sessionData) {
          console.log('[AuthenticatedLayout] Client-side sessionData retrieved:', sessionData);
          setSession(sessionData);
        } else {
          console.warn('[AuthenticatedLayout] Client-side session details not retrieved. Trusting middleware.');
          setSession(null);
        }

        if (sessionData?.sessionType === 'admin' && !isStoreInitialized) {
          console.log('[AuthenticatedLayout] Admin session detected, store not initialized, calling initializeStore.');
          await initializeStore();
        } else if (sessionData?.sessionType === 'admin' && isStoreInitialized) {
            console.log('[AuthenticatedLayout] Admin session, store already initialized.');
        } else if (sessionData?.sessionType === 'partner') {
            console.log('[AuthenticatedLayout] Partner session detected. OS Store initialization skipped for now (or handled by partner dashboard).');
        }

      } catch (e: any) {
        console.error("[AuthenticatedLayout] Error during client-side data initialization:", e);
        setSession(null);
      } finally {
        setIsLoading(false);
        setAuthCheckCompleted(true);
        console.log('[AuthenticatedLayout] Initial auth check and data init complete.');
      }
    }

    checkSessionAndInitializeData();
  }, [isStoreInitialized, initializeStore]);

  // Memoize o valor do contexto para evitar re-renderizações desnecessárias dos consumidores
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
    <SessionContext.Provider value={sessionContextValue}> {/* Prove o valor da sessão */}
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
