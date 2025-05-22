
'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import Header from './Header';
import type { User } from '@/lib/types'; // User type might still be used for Header
import FooterContent from './FooterContent';
import { useOSStore } from '@/store/os-store';
import { getSessionFromToken } from '@/lib/auth-edge'; // Use from auth-edge
import { useRouter } from 'next/navigation';
import { AUTH_COOKIE_NAME } from '@/lib/constants';

// Helper to get cookie client-side
function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined; // Guard for SSR
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
}


export default function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  // No longer managing user state here as login is removed
  // const [user, setUser] = useState<User | null>(null); 
  const [isLoading, setIsLoading] = useState(true); // General loading state for store init

  const initializeStore = useOSStore((state) => state.initializeStore);
  const isStoreInitialized = useOSStore((state) => state.isStoreInitialized);
  const router = useRouter();

  useEffect(() => {
    async function initApp() {
      if (!isStoreInitialized) {
        console.log('[AuthenticatedLayout] Store not initialized, calling initializeStore.');
        await initializeStore(); // initializeStore is async
      } else {
        console.log('[AuthenticatedLayout] Store already initialized.');
      }
      setIsLoading(false);
    }
    initApp();
  }, [isStoreInitialized, initializeStore]);


  if (isLoading) {
     return (
        <div className="d-flex flex-column justify-content-center align-items-center text-center bg-light" style={{ minHeight: '100vh' }}>
          <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Carregando aplicação...</span>
          </div>
          <p className="text-muted">Carregando aplicação...</p>
        </div>
        <p className="text-muted">Carregando aplicação...</p>
      </div>
    );
  }
  
  if (!user && authCheckCompleted) { // Only show "Verificando" if auth check is done and still no user
      console.warn("[AuthenticatedLayout] Rendered without user after auth check completed. This implies redirection should occur or has occurred via middleware.");
      return (
         <div className="d-flex flex-column justify-content-center align-items-center text-center bg-light" style={{ minHeight: '100vh' }}>
            <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
              <span className="visually-hidden">Verificando autenticação...</span>
            </div>
            <p className="text-muted">Verificando autenticação...</p>
         </div>
      );
  }

  return (
    <div className="d-flex flex-column min-vh-100">
      {/* Pass null or a mock user to Header if needed. For now, Header handles user being null. */}
      <Header user={null} /> 
      <main className="container flex-grow-1 py-4 py-lg-5">
        {children}
      </main>
      <footer className="py-3 mt-auto text-center text-body-secondary border-top bg-light">
        <FooterContent />
      </footer>
    </div>
  );
}
