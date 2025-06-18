
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
// import AuthenticatedLayout from '@/components/layout/AuthenticatedLayout'; // Removido
import PostLoginAnimation from '@/components/layout/PostLoginAnimation';
import OSGrid from '@/components/os-grid/OSGrid';
import { CreateOSDialog } from '@/components/os/CreateOSDialog';
import { Calendar, Users, FileText as ReportIcon } from 'lucide-react';
import type { User } from '@/lib/types';

const ANIMATION_PLAYED_KEY = 'freelaos_animation_played';

export default function DashboardPage() {
  const [isClient, setIsClient] = useState(false);
  const [showAnimation, setShowAnimation] = useState(false);

  useEffect(() => {
    setIsClient(true);
    try {
      const animationPlayed = sessionStorage.getItem(ANIMATION_PLAYED_KEY);
      if (animationPlayed !== 'true') {
        setShowAnimation(true);
      } else {
        setShowAnimation(false);
      }
    } catch (error) {
      setShowAnimation(false); 
    }
  }, []);

  const handleAnimationComplete = () => {
    setShowAnimation(false);
    try {
      sessionStorage.setItem(ANIMATION_PLAYED_KEY, 'true');
    } catch (error) {
    }
  };
  
  if (!isClient) {
    return (
        <div className="d-flex flex-column align-items-center justify-content-center text-center p-4" style={{ minHeight: 'calc(100vh - 200px)' }}>
           <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
                <span className="visually-hidden">Carregando...</span>
           </div>
          <p className="mt-3 text-muted fs-5">Carregando painel...</p>
        </div>
    );
  }
  
  if (showAnimation) { 
    return (
        <PostLoginAnimation onAnimationComplete={handleAnimationComplete} />
    );
  }

  return (
    <>
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
    </>
  );
}
