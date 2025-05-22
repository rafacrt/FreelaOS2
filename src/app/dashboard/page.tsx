
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AuthenticatedLayout from '@/components/layout/AuthenticatedLayout';
import PostLoginAnimation from '@/components/layout/PostLoginAnimation';
import OSGrid from '@/components/os-grid/OSGrid';
import { CreateOSDialog } from '@/components/os/CreateOSDialog';
import { Calendar, Users, FileText as ReportIcon } from 'lucide-react';
import type { User } from '@/lib/types';
import { getSession } from '@/lib/auth'; // For client-side session access if needed

const ANIMATION_PLAYED_KEY = 'freelaos_animation_played';

export default function DashboardPage() {
  const [isClient, setIsClient] = useState(false);
  const [showAnimation, setShowAnimation] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null); // Store user from session

  useEffect(() => {
    setIsClient(true);
    
    async function fetchUserAndCheckAnimation() {
        const sessionUser = await getSession(); // Client-side getSession
        setCurrentUser(sessionUser);

        try {
          const animationPlayed = sessionStorage.getItem(ANIMATION_PLAYED_KEY);
          if (animationPlayed !== 'true' && sessionUser) { // Only show animation if logged in
            setShowAnimation(true);
          } else {
            setShowAnimation(false);
          }
        } catch (error) {
          console.warn("Session storage not available or error accessing it:", error);
          setShowAnimation(false);
        }
    }
    fetchUserAndCheckAnimation();

  }, []);

  const handleAnimationComplete = () => {
    setShowAnimation(false);
    try {
      sessionStorage.setItem(ANIMATION_PLAYED_KEY, 'true');
    } catch (error) {
      console.warn("Error setting session storage:", error);
    }
  };
  
  // AuthenticatedLayout will handle the main loading and auth check.
  // This component assumes it's rendered within an authenticated context.

  if (!isClient) {
    // AuthenticatedLayout handles initial loading screen, so this might not be strictly necessary
    // but can be a fallback or for specific Dashboard loading.
    return (
      <AuthenticatedLayout>
        <div className="d-flex flex-column align-items-center justify-content-center text-center p-4" style={{ minHeight: 'calc(100vh - 200px)' }}>
           <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
                <span className="visually-hidden">Carregando...</span>
           </div>
          <p className="mt-3 text-muted fs-5">Carregando painel...</p>
        </div>
      </AuthenticatedLayout>
    );
  }
  
  if (showAnimation && currentUser) { // Only show animation if there's a user
    return (
      <AuthenticatedLayout>
        <PostLoginAnimation onAnimationComplete={handleAnimationComplete} />
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom flex-wrap gap-2">
        <h1 className="h3 mb-0 me-auto">Ordens de Serviço</h1>
         <div className="d-flex gap-2 flex-wrap">
            <Link href="/calendar" className="btn btn-sm btn-outline-secondary">
                <Calendar size={16} className="me-1" /> Calendário
            </Link>
             <Link href="/entities" className="btn btn-sm btn-outline-info">
                 <Users size={16} className="me-1" /> Entidades
             </Link>
              <Link href="/reports" className="btn btn-sm btn-outline-warning">
                 <ReportIcon size={16} className="me-1" /> Relatórios
             </Link>
            <CreateOSDialog />
        </div>
      </div>
      <OSGrid />
    </AuthenticatedLayout>
  );
}
