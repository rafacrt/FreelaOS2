
// src/app/partner/dashboard/page.tsx
'use client';

import React, { useEffect, useState, useMemo } from 'react'; // Restaurado
import Link from 'next/link'; // Restaurado
import { useSession } from '@/hooks/useSession'; // Restaurado
import { useOSStore } from '@/store/os-store'; // Restaurado
import type { OS } from '@/lib/types'; // Restaurado
import { OSStatus } from '@/lib/types'; // Restaurado
import OSCard from '@/components/os-grid/OSCard'; // Restaurado
import { PlusCircle, ListChecks } from 'lucide-react'; // Restaurado PlusCircle, ListChecks (ou outro se preferir para título)

export default function PartnerDashboardPage() {
  const session = useSession();
  const { osList, isStoreInitialized, initializeStore } = useOSStore(state => ({
    osList: state.osList,
    isStoreInitialized: state.isStoreInitialized,
    initializeStore: state.initializeStore,
  }));
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
      console.log('[PartnerDashboardPage] Render/Update. Session from useSession():', session, 'isStoreInitialized:', isStoreInitialized);
      if (session && session.sessionType === 'partner' && !isStoreInitialized) {
        console.log('[PartnerDashboardPage] Session is partner, store not initialized. Calling initializeStore.');
        initializeStore();
      }
    }
  }, [isClient, session, isStoreInitialized, initializeStore]);

  const partnerOSList = useMemo(() => {
    if (!session || session.sessionType !== 'partner' || !isStoreInitialized) {
      console.log('[PartnerDashboardPage] partnerOSList memo: returning empty array. Conditions not met.');
      return [];
    }
    const filtered = osList.filter(os =>
      os.createdByPartnerId === session.id && // OSs criadas por este parceiro
      os.status !== OSStatus.FINALIZADO &&      // Não finalizadas
      os.status !== OSStatus.RECUSADA          // Não recusadas
    ).sort((a,b) => new Date(b.dataAbertura).getTime() - new Date(a.dataAbertura).getTime()); // Mais recentes primeiro

    console.log(`[PartnerDashboardPage] partnerOSList memo: Filtered ${filtered.length} OSs for partner ID ${session.id}.`);
    return filtered;
  }, [osList, session, isStoreInitialized]);

  if (!isClient || !session || !isStoreInitialized) {
    let loadingMessage = "Carregando painel do parceiro...";
    if (!isClient) loadingMessage = "Aguardando cliente...";
    else if (!session) loadingMessage = "Verificando sessão do parceiro...";
    else if (!isStoreInitialized) loadingMessage = "Carregando dados das Ordens de Serviço...";
    
    console.log('[PartnerDashboardPage] Loading state:', loadingMessage);
    return (
        <div className="d-flex flex-column align-items-center justify-content-center text-center p-4" style={{ minHeight: 'calc(100vh - 200px)' }}>
           <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
                <span className="visually-hidden">{loadingMessage}</span>
           </div>
          <p className="text-muted fs-5">{loadingMessage}</p>
        </div>
    );
  }

  if (session.sessionType !== 'partner') {
    // Este caso não deve acontecer se o middleware estiver funcionando corretamente
    console.warn('[PartnerDashboardPage] Session type is not partner, redirecting or showing error.');
    return (
        <div className="text-center py-5">
            <h1 className="h3">Acesso Negado</h1>
            <p className="text-muted">Esta página é apenas para parceiros.</p>
            <Link href="/login" className="btn btn-primary">Ir para Login Admin</Link>
        </div>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom flex-wrap gap-2">
        <h1 className="h3 mb-0 me-auto d-flex align-items-center">
          <ListChecks size={24} className="me-2 text-primary" />
          Minhas Ordens de Serviço
        </h1>
        <Link href="/partner/create-os" className="btn btn-success">
          <PlusCircle size={18} className="me-1" /> Criar Nova OS
        </Link>
      </div>

      {partnerOSList.length === 0 ? (
        <div className="text-center py-5">
          <p className="fs-5 text-muted">Você ainda não criou nenhuma Ordem de Serviço ou todas foram finalizadas/recusadas.</p>
          <p className="text-muted small">Clique em "Criar Nova OS" para começar.</p>
        </div>
      ) : (
        <div className="row row-cols-1 row-cols-sm-2 row-cols-md-2 row-cols-lg-3 g-3">
          {partnerOSList.map((os) => (
            <div className="col" key={os.id}>
              <OSCard os={os} viewMode="partner" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
