
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AuthenticatedLayout from '@/components/layout/AuthenticatedLayout';
import OSDetailsView from '@/components/os/OSDetailsView';
import { useOSStore } from '@/store/os-store';
import type { OS, SessionPayload } from '@/lib/types'; // Import SessionPayload
import Link from 'next/link';
import { useSession } from '@/hooks/useSession'; // Import useSession

export default function OSDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === 'string' ? params.id : undefined;
  const session = useSession(); // Get session to determine viewMode

  const osFromStore = useOSStore(state => state.osList.find(o => o.id === id));
  const [os, setOs] = useState<OS | undefined | null>(undefined);

  useEffect(() => {
    if (id) {
      if (osFromStore) {
        setOs(osFromStore);
      } else {
        const timer = setTimeout(() => {
            const stillNotFound = !useOSStore.getState().osList.find(o => o.id === id);
            if (stillNotFound) {
                console.warn(`[OSDetailsPage] OS with ID ${id} not found in store after delay.`);
                setOs(null);
            }
        }, 1000);
        return () => clearTimeout(timer);
      }
    } else {
      setOs(null);
    }
  }, [id, osFromStore]);

  if (os === undefined || !session) { // Wait for session as well
    return (
      <AuthenticatedLayout>
        <div className="d-flex flex-column align-items-center justify-content-center text-center" style={{ minHeight: 'calc(100vh - 200px)' }}>
           <div className="spinner-border text-primary me-3 mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
             <span className="visually-hidden">Carregando...</span>
           </div>
          <p className="fs-5 text-muted mb-0">Carregando detalhes da OS...</p>
        </div>
      </AuthenticatedLayout>
    );
  }

  if (os === null) {
    return (
      <AuthenticatedLayout>
        <div className="text-center py-5">
          <h2 className="h3 fw-semibold mb-3 text-danger">Ordem de Serviço Não Encontrada</h2>
          <p className="text-muted mb-4">A OS que você está procurando não existe ou não pôde ser carregada.</p>
           <Link href={session.sessionType === 'admin' ? "/dashboard" : "/partner/dashboard"} className="btn btn-primary">
             Ir para o Painel
           </Link>
        </div>
      </AuthenticatedLayout>
    );
  }

  // Determine viewMode based on session
  const viewMode = session.sessionType === 'admin' ? 'admin' : 'partner';

  // For partners, check if they are authorized to view this OS
  if (viewMode === 'partner' && os.createdByPartnerId !== session.id) {
    return (
      <AuthenticatedLayout>
        <div className="text-center py-5">
          <h2 className="h3 fw-semibold mb-3 text-danger">Acesso Negado</h2>
          <p className="text-muted mb-4">Você não tem permissão para visualizar esta Ordem de Serviço.</p>
           <Link href="/partner/dashboard" className="btn btn-primary">
             Ir para o Painel do Parceiro
           </Link>
        </div>
      </AuthenticatedLayout>
    );
  }


  return (
    <AuthenticatedLayout>
      <div className="transition-opacity">
         <OSDetailsView initialOs={os} viewMode={viewMode} />
      </div>
    </AuthenticatedLayout>
  );
}
