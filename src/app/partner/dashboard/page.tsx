
'use client';

import React, { useMemo, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from '@/hooks/useSession';
import { useOSStore } from '@/store/os-store';
import OSCard from '@/components/os-grid/OSCard';
// AuthenticatedLayout não é importado aqui diretamente.
import { PlusCircle, ListChecks } from 'lucide-react';

export default function PartnerDashboardPage() {
  const session = useSession();
  const osList = useOSStore((state) => state.osList);
  const isStoreInitialized = useOSStore((state) => state.isStoreInitialized);
  const [isClient, setIsClient] = useState(false); // Para evitar hydration mismatch em logs e renderização condicional

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
      console.log('[PartnerDashboardPage] Status Update. Session:', session, 'isStoreInitialized:', isStoreInitialized);
    }
  }, [session, isStoreInitialized, isClient]);


  const partnerOSList = useMemo(() => {
    if (!session || session.sessionType !== 'partner' || !isStoreInitialized) {
      if (isClient) console.log('[PartnerDashboardPage] partnerOSList memo: returning empty array. Conditions not met.');
      return [];
    }
    if (isClient) console.log(`[PartnerDashboardPage] partnerOSList memo: Filtering for partner ID ${session.id}. osList length: ${osList.length}`);
    return osList.filter(os => os.createdByPartnerId && os.createdByPartnerId === session.id)
                 .sort((a, b) => new Date(b.dataAbertura).getTime() - new Date(a.dataAbertura).getTime());
  }, [osList, session, isStoreInitialized, isClient]);

  // Se ainda não estamos no cliente, não renderize nada ou um placeholder mínimo
  if (!isClient) {
    return null; // Ou um placeholder muito básico se preferir, mas null evita flashes
  }

  // Spinner primário: esperando sessão ou store, SÓ SE JÁ ESTIVER NO CLIENTE
  if (!session || !isStoreInitialized) {
    console.log('[PartnerDashboardPage] Showing primary spinner (waiting for session or store init).');
    return (
        <div className="d-flex flex-column justify-content-center align-items-center text-center" style={{ minHeight: 'calc(100vh - 200px)' }}>
            <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
                <span className="visually-hidden">Carregando...</span>
            </div>
            <p className="text-muted">Carregando dados do parceiro...</p>
        </div>
    );
  }

  // Sessão existe, store inicializado, mas não é de parceiro
  if (session.sessionType !== 'partner') {
    console.log('[PartnerDashboardPage] Session is not partner type. Showing Access Denied.');
    // Este caso teoricamente não deveria acontecer se o middleware estiver correto
    // e o AuthenticatedLayout estiver funcionando, mas é uma proteção.
    return (
      <div className="text-center py-5">
        <h1 className="h3">Acesso Negado</h1>
        <p className="text-muted">Você precisa estar logado como parceiro para ver esta página.</p>
        <Link href="/partner-login" className="btn btn-primary">
          Login de Parceiro
        </Link>
      </div>
    );
  }

  // Tudo carregado, sessão de parceiro OK. Renderizar conteúdo.
  console.log('[PartnerDashboardPage] Rendering main content. Partner OS count:', partnerOSList.length);
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom flex-wrap gap-2">
        <h1 className="h3 mb-0 d-flex align-items-center">
          <ListChecks size={28} className="me-2 text-primary" />
          Painel do Parceiro: {session.partnerName}
        </h1>
        <Link href="/partner/create-os" className="btn btn-success">
          <PlusCircle size={18} className="me-2" /> Criar Nova OS
        </Link>
      </div>

      {partnerOSList.length === 0 && isStoreInitialized ? ( // Só mostra "nenhuma OS" se o store realmente carregou
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
