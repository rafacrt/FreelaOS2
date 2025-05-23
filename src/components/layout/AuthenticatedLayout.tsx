
'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import Header from './Header';
import type { User } from '@/lib/types';
import FooterContent from './FooterContent';
import { useOSStore } from '@/store/os-store';
import { getSessionFromToken } from '@/lib/auth-edge'; 
import { useRouter } from 'next/navigation';
import { AUTH_COOKIE_NAME } from '@/lib/constants';

// Helper to get cookie client-side
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
  const [authCheckCompleted, setAuthCheckCompleted] = useState(false); // Tracks if the initial effect has run

  const initializeStore = useOSStore((state) => state.initializeStore);
  const isStoreInitialized = useOSStore((state) => state.isStoreInitialized);
  const router = useRouter(); // Keep for potential future use, though immediate redirect is removed

  useEffect(() => {
    async function checkSessionAndInitializeData() {
      try {
        // Attempt to get user session details client-side.
        // This may return null if the cookie is HttpOnly, as document.cookie cannot access it.
        // Middleware is the primary source of truth for authentication.
        const tokenValue = getCookie(AUTH_COOKIE_NAME);
        const sessionUser = await getSessionFromToken(tokenValue);

        if (sessionUser) {
          setUser(sessionUser);
        } else {
          // If middleware allowed access, we assume the user IS authenticated.
          // Client-side `getCookie` might fail for HttpOnly cookies.
          // We will not redirect to login from here as middleware should handle unauth access.
          // The Header component will need to gracefully handle a potentially null 'user' prop.
          console.warn(
            '[AuthenticatedLayout] Client-side session details not retrieved (cookie might be HttpOnly or not set client-accessible). Trusting middleware. User details for Header might be unavailable if not fetched via API.'
          );
        }

        // Initialize the store regardless of client-side session retrieval success,
        // as middleware has already authenticated the request to reach this layout.
        if (!isStoreInitialized) {
          console.log('[AuthenticatedLayout] Store not initialized, calling initializeStore.');
          await initializeStore();
        } else {
          console.log('[AuthenticatedLayout] Store already initialized.');
        }
      } catch (e: any) {
        console.error("[AuthenticatedLayout] Error during client-side data initialization (store or session fetch attempt):", e);
        // Avoid redirecting to login on store init failure if middleware has passed.
        // The page will render, potentially in a degraded state if store data is crucial.
      } finally {
        setIsLoading(false);
        setAuthCheckCompleted(true);
      }
    }

    checkSessionAndInitializeData();
  }, [isStoreInitialized, initializeStore]); // router removed as dependency as it's not directly causing side-effects in the new logic flow

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
  
  // If we reach here, middleware has authenticated.
  // The `user` state might be null if the client-side check couldn't get it (e.g. HttpOnly cookie).
  // The Header component needs to handle `user` being potentially null.
  return (
    <div className="d-flex flex-column min-vh-100">
      <Header user={user} /> {/* Pass the potentially null user state to Header */}
      <main className="container flex-grow-1 py-4 py-lg-5">
        {children}
      </main>
      <footer className="py-3 mt-auto text-center text-body-secondary border-top bg-light">
        <FooterContent />
      </footer>
    </div>
  );
}
