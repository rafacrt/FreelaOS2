
'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import Header from './Header';
import type { User } from '@/lib/types';
import FooterContent from './FooterContent';
import { useOSStore } from '@/store/os-store';
import { getSessionFromToken } from '@/lib/auth-edge'; 
// useRouter is not used here, so it can be removed if not needed for other logic.
// import { useRouter } from 'next/navigation'; 
import { AUTH_COOKIE_NAME } from '@/lib/constants';

// Helper to get cookie client-side (only for non-HttpOnly cookies if used for that)
function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined; // Guard for SSR
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
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authCheckCompleted, setAuthCheckCompleted] = useState(false);

  const initializeStore = useOSStore((state) => state.initializeStore);
  const isStoreInitialized = useOSStore((state) => state.isStoreInitialized);
  // const router = useRouter(); // Keep for potential future use.

  useEffect(() => {
    console.log('[AuthenticatedLayout] useEffect triggered.');
    async function checkSessionAndInitializeData() {
      try {
        // Attempt to get user session details client-side for display purposes.
        // Middleware is the primary source of truth for authentication.
        // This client-side check might fail to get full user details if the cookie is HttpOnly.
        const tokenValue = getCookie(AUTH_COOKIE_NAME);
        // console.log(`[AuthenticatedLayout] Client-side tokenValue for ${AUTH_COOKIE_NAME}:`, tokenValue ? tokenValue.substring(0,10)+'...' : 'undefined');
        
        // getSessionFromToken from auth-edge will attempt to decrypt.
        // If JWT_SECRET is not available on the client (which it shouldn't be for security),
        // and if auth-edge.ts is bundled with client code that calls this,
        // then decryptPayload might fail or be unable to verify.
        // For now, we assume `getSessionFromToken` handles this gracefully (e.g., by returning null if key is unavailable).
        const sessionUser = await getSessionFromToken(tokenValue);

        if (sessionUser) {
          // console.log('[AuthenticatedLayout] Client-side sessionUser retrieved:', sessionUser);
          setUser(sessionUser);
        } else {
          // console.warn(
          //   '[AuthenticatedLayout] Client-side session details not retrieved or token invalid. Trusting middleware. User details for Header might be unavailable.'
          // );
          setUser(null); // Explicitly set to null if no session found client-side
        }

        if (!isStoreInitialized) {
          console.log('[AuthenticatedLayout] Store not initialized, calling initializeStore.');
          await initializeStore(); // This is currently simplified to not make DB calls
        } else {
          console.log('[AuthenticatedLayout] Store already initialized.');
        }
      } catch (e: any) {
        console.error("[AuthenticatedLayout] Error during client-side data initialization:", e);
        setUser(null); // Ensure user is null on error
      } finally {
        setIsLoading(false);
        setAuthCheckCompleted(true);
        console.log('[AuthenticatedLayout] Initial auth check and data init complete.');
      }
    }

    checkSessionAndInitializeData();
  }, [isStoreInitialized, initializeStore]);

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
    <div className="d-flex flex-column min-vh-100">
      <Header user={user} />
      <main className="container flex-grow-1 py-4 py-lg-5">
        {children}
      </main>
      <footer className="py-3 mt-auto text-center text-body-secondary border-top bg-light">
        <FooterContent />
      </footer>
    </div>
  );
}
