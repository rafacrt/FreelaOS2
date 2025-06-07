
'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useSession } from '@/hooks/useSession';
import { useOSStore } from '@/store/os-store';
import OSCard from '@/components/os-grid/OSCard';
import AuthenticatedLayout from '@/components/layout/AuthenticatedLayout'; // Manter para o wrapper principal
import { PlusCircle, ListChecks } from 'lucide-react';

export default function PartnerDashboardPage() {
  const session = useSession(); // Pode ser null inicialmente
  const osList = useOSStore((state) => state.osList);
  const isStoreInitialized = useOSStore((state) => state.isStoreInitialized); // Para saber se os dados já carregaram

  const partnerOSList = useMemo(() => {
    if (!session || session.sessionType !== 'partner') {
      return [];
    }
    // Garante que osList e session.id existam antes de filtrar
    return osList.filter(os => os.createdByPartnerId && os.createdByPartnerId === session.id)
                 .sort((a, b) => new Date(b.dataAbertura).getTime() - new Date(a.dataAbertura).getTime());
  }, [osList, session]);

  // Se a sessão ainda está carregando (AuthenticatedLayout cuida do spinner global)
  // ou se o store ainda não foi inicializado (osList pode estar vazia)
  if (!session && !isStoreInitialized) {
    // AuthenticatedLayout já mostra um spinner global.
    // Podemos mostrar um placeholder específico se desejado, ou null para esperar o layout pai.
    // No entanto, se o middleware falhar e a sessão for realmente nula, o AuthenticatedLayout deve lidar com isso.
    // A lógica abaixo é um fallback caso a página seja acessada diretamente e o middleware não tenha atuado.
    return (
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '300px' }}>
            <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Carregando...</span>
            </div>
        </div>
    );
  }

  // Se, após o carregamento, a sessão não for de parceiro
  if (!session || session.sessionType !== 'partner') {
    return (
      // Não aninhe AuthenticatedLayout aqui. Esta página já é um filho dele.
      <div className="text-center py-5">
        <h1 className="h3">Acesso Negado</h1>
        <p className="text-muted">Você precisa estar logado como parceiro para ver esta página.</p>
        <Link href="/partner-login" className="btn btn-primary">
          Login de Parceiro
        </Link>
      </div>
    );
  }

  // Se a sessão é de parceiro, mas a lista de OS ainda está sendo carregada pelo store
  if (!isStoreInitialized && session && session.sessionType === 'partner') {
      return (
           <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '300px' }}>
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Carregando Ordens de Serviço...</span>
                </div>
            </div>
      )
  }


  return (
    // O AuthenticatedLayout já envolve esta página
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
