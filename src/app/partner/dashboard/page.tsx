
'use client';

import React, { useMemo, useEffect, useState } from 'react';
// import Link from 'next/link'; // Comentado para teste
import { useSession } from '@/hooks/useSession';
import { useOSStore } from '@/store/os-store';
// import OSCard from '@/components/os-grid/OSCard'; // Comentado para teste
// import { PlusCircle } from 'lucide-react'; // Ícones comentados para teste

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
    if (isClient && session?.sessionType === 'partner' && !isStoreInitialized) {
      console.log('[PartnerDashboardPage] Client-side: Partner session detected, store not initialized. Attempting to initialize.');
      initializeStore();
    }
  }, [isClient, session, isStoreInitialized, initializeStore]);

  useEffect(() => {
    if (isClient) {
      console.log('[PartnerDashboardPage] Render/Update. Session from useSession():', session, 'isStoreInitialized:', isStoreInitialized);
    }
  }, [isClient, session, isStoreInitialized]);

  const partnerOSList = useMemo(() => {
    if (!session || session.sessionType !== 'partner' || !isStoreInitialized) {
      console.log('[PartnerDashboardPage] partnerOSList memo: returning empty array. Conditions not met.');
      return [];
    }
    console.log(`[PartnerDashboardPage] partnerOSList memo: Filtering for partner ID ${session.id}. Total OS: ${osList.length}`);
    return osList.filter(os => os.createdByPartnerId && os.createdByPartnerId === session.id)
                 .sort((a, b) => new Date(b.dataAbertura).getTime() - new Date(a.dataAbertura).getTime());
  }, [osList, session, isStoreInitialized]);


  if (!isClient) {
    // Render nothing or a minimal static loader on the server/first client render pass
    // This helps avoid issues before client-side hooks and state are fully available
    return null;
  }

  // At this point, isClient is true. AuthenticatedLayout should have handled session fetching and initial redirects.
  // Now, we handle the specific states for the partner dashboard.

  if (!session) {
    console.warn('[PartnerDashboardPage] Session is null even after client mount. This might indicate an issue with AuthenticatedLayout or session propagation.');
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary mb-3" role="status">
          <span className="visually-hidden">Verificando sessão...</span>
        </div>
        <p className="text-muted">Verificando sessão...</p>
        <p className="small mt-2">Se o problema persistir, tente <a href="/partner-login">fazer login novamente</a>.</p>
      </div>
    );
  }

  if (session.sessionType !== 'partner') {
    console.warn(`[PartnerDashboardPage] Acesso negado. Tipo de sessão '${session.sessionType}' não é 'partner'.`);
    return (
      <div className="text-center py-5">
        <h1 className="h3">Acesso Negado</h1>
        <p className="text-muted">Esta página é exclusiva para parceiros.</p>
        <a href={session.sessionType === 'admin' ? "/dashboard" : "/login"} className="btn btn-primary mt-2">
          {session.sessionType === 'admin' ? "Ir para Painel Admin" : "Ir para Login"}
        </a>
      </div>
    );
  }

  // Session is valid and is a partner session.
  // Now check if the store (OS list) is initialized.
  if (!isStoreInitialized) {
    console.log('[PartnerDashboardPage] Session OK (Partner), mas store não inicializado. Mostrando spinner de OSs.');
    return (
      <>
        <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom flex-wrap gap-2">
          {session && session.sessionType === 'partner' && (
            <h1 className="h3 mb-0 d-flex align-items-center">
                {/* Ícone removido para teste */}
                Painel do Parceiro: {session.partnerName || session.username}
            </h1>
          )}
          {/* <PlusCircle size={18} className="me-2" /> Ícone removido */}
          <a href="/partner/create-os" className="btn btn-success disabled" aria-disabled="true">
             Criar Nova OS (Link Teste)
          </a>
        </div>
        <div className="text-center py-5">
          <div className="spinner-border text-secondary mb-3" role="status">
            <span className="visually-hidden">Carregando OSs...</span>
          </div>
          <p className="text-muted">Carregando suas Ordens de Serviço...</p>
        </div>
      </>
    );
  }

  // Session is partner, store is initialized. Render the main content.
  console.log('[PartnerDashboardPage] Session and store OK. Rendering partner dashboard content (simplified).');
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom flex-wrap gap-2">
        {session && session.sessionType === 'partner' && (
            <h1 className="h3 mb-0 d-flex align-items-center">
                {/* Ícone removido para teste */}
                Painel do Parceiro: {session.partnerName || session.username}
            </h1>
        )}
        {/* <PlusCircle size={18} className="me-2" /> Ícone removido */}
        <a href="/partner/create-os" className="btn btn-success">
           Criar Nova OS (Link Teste)
        </a>
      </div>

      {partnerOSList.length === 0 ? (
        <div className="text-center py-5">
          <p className="fs-5 text-muted">Nenhuma Ordem de Serviço criada por você ainda.</p>
          <p className="text-muted small">Clique em "Criar Nova OS" para começar.</p>
        </div>
      ) : (
        <div className="alert alert-info" role="alert">
          Lista de OSs temporariamente removida para teste. Se você vê esta mensagem e não há erros no console, a lógica básica de carregamento da página está funcionando.
          Total de OSs do parceiro: {partnerOSList.length}
        </div>
        // <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-xl-4 g-3 pb-4">
        //   {partnerOSList.map((os) => (
        //     <div className="col" key={os.id}>
        //       {/* <OSCard os={os} viewMode="partner" /> Componente OSCard comentado para teste */}
        //     </div>
        //   ))}
        // </div>
      )}
    </>
  );
}
