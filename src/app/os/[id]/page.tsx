
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
// import AuthenticatedLayout from '@/components/layout/AuthenticatedLayout'; // Removido
import OSDetailsView from '@/components/os/OSDetailsView';
import { useOSStore } from '@/store/os-store';
import type { OS, SessionPayload } from '@/lib/types';
import Link from 'next/link';
import { useSession } from '@/hooks/useSession'; 

export default function OSDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === 'string' ? params.id : undefined;
  
  const session = useSession();

  const { osFromStore, isStoreInitialized, initializeStore } = useOSStore(state => ({
    osFromStore: state.osList.find(o => o.id === id),
    isStoreInitialized: state.isStoreInitialized,
    initializeStore: state.initializeStore,
  }));

  const [os, setOs] = useState<OS | undefined | null>(undefined);
  const [loadingMessage, setLoadingMessage] = useState('Carregando detalhes da OS...');

  useEffect(() => {
    if (!isStoreInitialized && session) { 
      setLoadingMessage('Inicializando dados da aplicação...');
      initializeStore().then(() => {
      }).catch(err => {
        setOs(null); 
        setLoadingMessage('Falha ao carregar dados da aplicação.');
      });
    }
  }, [id, isStoreInitialized, initializeStore, session]);

  useEffect(() => {
    if (id && isStoreInitialized) { 
      const currentOsInStore = useOSStore.getState().osList.find(o => o.id === id);

      if (currentOsInStore) {
        setOs(currentOsInStore);
      } else {
        setLoadingMessage(`Procurando OS ${id}...`);
        const timer = setTimeout(() => {
            const stillNotFoundInStore = !useOSStore.getState().osList.find(o => o.id === id);
            if (stillNotFoundInStore) {
                setOs(null); 
                setLoadingMessage(`OS ${id} não encontrada.`);
            } else {
                 setOs(useOSStore.getState().osList.find(o => o.id === id));
            }
        }, 2000); 
        return () => clearTimeout(timer);
      }
    } else if (!id) {
      setOs(null);
      setLoadingMessage('ID da OS inválido.');
    } else if (!isStoreInitialized) {
       setLoadingMessage('Aguardando dados da aplicação...');
    }
  }, [id, osFromStore, isStoreInitialized]); 

  if (os === undefined || !session || !isStoreInitialized) {
    return (
        <div className="d-flex flex-column align-items-center justify-content-center text-center" style={{ minHeight: 'calc(100vh - 200px)' }}>
           <div className="spinner-border text-primary me-3 mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
             <span className="visually-hidden">{loadingMessage}</span>
           </div>
          <p className="fs-5 text-muted mb-0">{loadingMessage}</p>
        </div>
    );
  }

  if (os === null) {
    return (
        <div className="text-center py-5">
          <h2 className="h3 fw-semibold mb-3 text-danger">Ordem de Serviço Não Encontrada</h2>
          <p className="text-muted mb-4">A OS que você está procurando (ID: {id}) não existe ou não pôde ser carregada.</p>
           <Link href={session.sessionType === 'admin' ? "/dashboard" : "/partner/dashboard"} className="btn btn-primary">
             Ir para o Painel
           </Link>
        </div>
    );
  }

  const viewMode = session.sessionType === 'admin' ? 'admin' : 'partner';

  if (viewMode === 'partner' && os.createdByPartnerId !== session.id) {
    return (
        <div className="text-center py-5">
          <h2 className="h3 fw-semibold mb-3 text-danger">Acesso Negado</h2>
          <p className="text-muted mb-4">Você não tem permissão para visualizar esta Ordem de Serviço.</p>
           <Link href="/partner/dashboard" className="btn btn-primary">
             Ir para o Painel do Parceiro
           </Link>
        </div>
    );
  }

  return (
    <div className="transition-opacity">
        <OSDetailsView initialOs={os} viewMode={viewMode} />
    </div>
  );
}
