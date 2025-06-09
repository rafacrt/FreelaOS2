
'use client';

import type { ReactNode } from 'react';
// import { useEffect, useState, createContext, useMemo } from 'react'; // Temporarily commented out
import { createContext } from 'react'; // Keep createContext for SessionContext export
// import Header from './Header'; // Temporarily commented out
import type { SessionPayload } from '@/lib/types';
// import FooterContent from './FooterContent'; // Temporarily commented out
// import { useOSStore } from '@/store/os-store'; // Temporarily commented out

// SessionContext export is KEPT so that useSession.ts doesn't break.
// However, AuthenticatedLayout will NOT provide this context in this temporary version.
export const SessionContext = createContext<SessionPayload | null>(null);

interface AuthenticatedLayoutProps {
  children: ReactNode;
}

export default function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  // const [session, setSession] = useState<SessionPayload | null>(null); // Temporarily commented out
  // const [isLoading, setIsLoading] = useState(true); // Temporarily commented out
  // const [authCheckCompleted, setAuthCheckCompleted] = useState(false); // Temporarily commented out

  // const initializeStore = useOSStore((state) => state.initializeStore); // Temporarily commented out
  // const isStoreInitialized = useOSStore((state) => state.isStoreInitialized); // Temporarily commented out

  /* // Temporarily commented out all internal logic
  useEffect(() => {
    console.log('[AuthenticatedLayout SIMPLIFIED DEBUG] useEffect for session check - LOGIC REMOVED FOR DEBUG.');
    // Simulate completion for testing if the layout itself is the issue
    // setIsLoading(false);
    // setAuthCheckCompleted(true);
    // setSession(null); // Explicitly null as we are not fetching
    // console.log('[AuthenticatedLayout SIMPLIFIED DEBUG] Minimal setup complete.');
  }, []); // Removed dependencies as well
  */

  // const sessionContextValue = useMemo(() => session, [session]); // Temporarily commented out

  /* // Temporarily commented out loader
  if (isLoading || !authCheckCompleted) {
    return (
      <div className="d-flex flex-column justify-content-center align-items-center text-center bg-light" style={{ minHeight: '100vh' }}>
        <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
          <span className="visually-hidden">Carregando aplicação (AuthenticatedLayout Ultra-Simplified)...</span>
        </div>
        <p className="text-muted">Carregando aplicação (AuthenticatedLayout Ultra-Simplified)...</p>
      </div>
    );
  }
  */

  // Render children directly without SessionContext.Provider, Header, or Footer for debugging
  console.log('[AuthenticatedLayout EXTREME SIMPLIFICATION DEBUG] Rendering children directly.');
  return (
    <div className="d-flex flex-column min-vh-100 debug-auth-layout-simplified">
      {/* <Header session={null} /> */} {/* Temporarily removed */}
      <main className="container flex-grow-1 py-4 py-lg-5 debug-main-content">
        {children}
      </main>
      {/* 
      <footer className="py-3 mt-auto text-center text-body-secondary border-top bg-light debug-footer">
        {/* <FooterContent /> */} {/* Temporarily removed */}
      {/*</footer> 
      */}
    </div>
  );
  
  /* // Original return when context was provided:
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
