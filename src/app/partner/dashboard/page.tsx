
'use client';

import React, { useMemo, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from '@/hooks/useSession';
import { useOSStore } from '@/store/os-store';
import OSCard from '@/components/os-grid/OSCard';
// AuthenticatedLayout NÃO deve ser importado ou usado aqui diretamente
import { PlusCircle, ListChecks } from 'lucide-react';

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
    // Se estamos no cliente, temos uma sessão de parceiro, mas o store não foi inicializado,
    // tentamos inicializá-lo. Isso pode ser redundante se o AuthenticatedLayout pai já fez,
    // mas é uma salvaguarda.
    if (typeof window !== 'undefined' && session?.sessionType === 'partner' && !isStoreInitialized) {
      console.log('[PartnerDashboardPage] Client-side: Partner session detected, store not initialized. Attempting to initialize.');
      initializeStore();
    }
  }, [session, isStoreInitialized, initializeStore]);

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
    // Renderiza um placeholder simples ou null no lado do servidor ou antes da hidratação do cliente
    // para evitar o erro #130 se algo for undefined prematuramente.
    // O AuthenticatedLayout pai já mostra um spinner global.
    return null;
  }

  // **Condições de Carregamento e Erro (SEM AuthenticatedLayout aninhado)**
  // O AuthenticatedLayout PAI já deve ter lidado com o redirecionamento se não houver sessão.
  // Aqui, lidamos com os estados PÓS AuthenticatedLayout ter carregado a sessão.
  if (!session) {
    // Isso não deveria acontecer se o AuthenticatedLayout pai estiver funcionando corretamente
    // e redirecionando usuários não autenticados. Mas como uma segurança:
    console.warn('[PartnerDashboardPage] Session is null even after client mount. This might indicate an issue with AuthenticatedLayout or session propagation.');
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary mb-3" role="status">
          <span className="visually-hidden">Verificando sessão...</span>
        </div>
        <p className="text-muted">Verificando sessão...</p>
        <p className="small mt-2">Se o problema persistir, tente <Link href="/partner-login">fazer login novamente</Link>.</p>
      </div>
    );
  }

  if (session.sessionType !== 'partner') {
    // Se o usuário logado não for um parceiro, o middleware deveria ter redirecionado.
    // Mas como uma segurança:
    console.warn(`[PartnerDashboardPage] Acesso negado. Tipo de sessão '${session.sessionType}' não é 'partner'.`);
    return (
      <div className="text-center py-5">
        <h1 className="h3">Acesso Negado</h1>
        <p className="text-muted">Esta página é exclusiva para parceiros.</p>
        <Link href={session.sessionType === 'admin' ? "/dashboard" : "/login"} className="btn btn-primary mt-2">
          {session.sessionType === 'admin' ? "Ir para Painel Admin" : "Ir para Login"}
        </Link>
      </div>
    );
  }

  // Se a sessão é de parceiro, mas o store (lista de OSs) ainda não carregou:
  if (!isStoreInitialized) {
    console.log('[PartnerDashboardPage] Session OK (Partner), mas store não inicializado. Mostrando spinner de OSs.');
    return (
      <>
        <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom flex-wrap gap-2">
          <h1 className="h3 mb-0 d-flex align-items-center">
            <ListChecks size={28} className="me-2 text-primary" />
            Painel do Parceiro: {session.partnerName || session.username}
          </h1>
          <Link href="/partner/create-os" className="btn btn-success disabled" aria-disabled="true">
            <PlusCircle size={18} className="me-2" /> Criar Nova OS
          </Link>
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

  // Sessão de parceiro OK, store inicializado OK. Renderizar conteúdo.
  console.log('[PartnerDashboardPage] Session and store OK. Rendering partner dashboard content.');
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom flex-wrap gap-2">
        <h1 className="h3 mb-0 d-flex align-items-center">
          <ListChecks size={28} className="me-2 text-primary" />
          Painel do Parceiro: {session.partnerName || session.username}
        </h1>
        <Link href="/partner/create-os" className="btn btn-success">
          <PlusCircle size={18} className="me-2" /> Criar Nova OS
        </Link>
      </div>

      {partnerOSList.length === 0 ? (
        <div className="text-center py-5">
          <p className="fs-5 text-muted">Nenhuma Ordem de Serviço criada por você ainda.</p>
          <p className="text-muted small">Clique em "Criar Nova OS" para começar.</p>
        </div>
      ) : (
        <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-xl-4 g-3 pb-4">
          {partnerOSList.map((os) => (
            <div className="col" key={os.id}>
              <OSCard os={os} viewMode="partner" />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
    
