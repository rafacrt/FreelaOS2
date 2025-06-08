
'use client';

import React, { useMemo, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from '@/hooks/useSession';
import { useOSStore } from '@/store/os-store';
import OSCard from '@/components/os-grid/OSCard';
import AuthenticatedLayout from '@/components/layout/AuthenticatedLayout'; // Importar AuthenticatedLayout
import { PlusCircle, ListChecks } from 'lucide-react';

export default function PartnerDashboardPage() {
  const session = useSession();
  const osList = useOSStore((state) => state.osList);
  const isStoreInitialized = useOSStore((state) => state.isStoreInitialized);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // Log para depuração
    if (typeof window !== 'undefined') {
        console.log('[PartnerDashboardPage] Render/Update. Session from useSession():', session, 'isStoreInitialized:', isStoreInitialized);
    }
  }, [session, isStoreInitialized]);

  const partnerOSList = useMemo(() => {
    // Só filtra se a sessão for de parceiro e o store estiver inicializado
    if (!session || session.sessionType !== 'partner' || !isStoreInitialized) {
      // console.log('[PartnerDashboardPage] partnerOSList memo: conditions not met, returning empty.');
      return [];
    }
    // console.log(`[PartnerDashboardPage] partnerOSList memo: Filtering for partner ID ${session.id}. Total OS: ${osList.length}`);
    return osList.filter(os => os.createdByPartnerId && os.createdByPartnerId === session.id)
                 .sort((a, b) => new Date(b.dataAbertura).getTime() - new Date(a.dataAbertura).getTime());
  }, [osList, session, isStoreInitialized]);


  // O AuthenticatedLayout já lida com:
  // 1. O spinner inicial enquanto a sessão é verificada.
  // 2. Redirecionamento se não houver sessão.
  // 3. Inicialização do store se houver sessão.
  //
  // Portanto, quando este componente (PartnerDashboardPage) é renderizado DENTRO do AuthenticatedLayout,
  // podemos assumir que `session` (do useSession) está resolvido (seja o payload ou null se o middleware falhou por algum motivo)
  // e `isStoreInitialized` será true se a sessão for de parceiro.

  // Se não estiver no cliente ainda, não renderize nada para evitar hydration mismatch
  if (!isClient) {
    return null;
  }

  // Se, APESAR do AuthenticatedLayout, a sessão ainda não estiver disponível ou não for de parceiro,
  // ou se o store não estiver inicializado para um parceiro, mostramos um estado de carregamento/erro.
  // Este bloco é uma segurança e para lidar com o carregamento das OSs após a sessão estar ok.
  if (!session || session.sessionType !== 'partner') {
    // AuthenticatedLayout deveria ter redirecionado. Se chegamos aqui, é um estado inesperado.
    // Ou, pode ser o breve momento antes do AuthenticatedLayout redirecionar.
    // Mostrar um spinner genérico para não quebrar.
    console.warn('[PartnerDashboardPage] Renderizando spinner/erro porque session não é de parceiro ou é null APÓS AuthenticatedLayout.');
    return (
      <AuthenticatedLayout>
        <div className="text-center py-5">
            <div className="spinner-border text-primary mb-3" role="status">
                <span className="visually-hidden">Verificando...</span>
            </div>
            <p className="text-muted">Verificando sessão...</p>
        </div>
      </AuthenticatedLayout>
    );
  }

  // Neste ponto, session É de parceiro. Agora verificamos se o store (e a osList) está pronto.
  if (!isStoreInitialized) {
    console.log('[PartnerDashboardPage] Session OK, mas store não inicializado. Mostrando spinner de OSs.');
     return (
      <AuthenticatedLayout>
        <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom flex-wrap gap-2">
            <h1 className="h3 mb-0 d-flex align-items-center">
              <ListChecks size={28} className="me-2 text-primary" />
              Painel do Parceiro: {session.partnerName}
            </h1>
            {/* Pode-se desabilitar o botão enquanto carrega */}
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
      </AuthenticatedLayout>
    );
  }

  // Sessão de parceiro OK, store inicializado OK. Renderizar conteúdo.
  return (
    <AuthenticatedLayout>
      <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom flex-wrap gap-2">
        <h1 className="h3 mb-0 d-flex align-items-center">
          <ListChecks size={28} className="me-2 text-primary" />
          Painel do Parceiro: {session.partnerName}
        </h1>
        <Link href="/partner/create-os" className="btn btn-success">
          <PlusCircle size={18} className="me-2" /> Criar Nova OS
        </Link>
      </div>

      {partnerOSList.length === 0 ? ( // isStoreInitialized já é true aqui
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
    </AuthenticatedLayout>
  );
}
    