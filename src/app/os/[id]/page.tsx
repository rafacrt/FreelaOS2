
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
  
  console.log(`[OSDetailsPage ${id}] Renderizando. Params ID: ${params.id}`);
  const session = useSession();
  console.log(`[OSDetailsPage ${id}] Sessão obtida de useSession():`, session ? { sessionType: session.sessionType, id: session.id, username: session.username } : null);

  const { osFromStore, isStoreInitialized, initializeStore } = useOSStore(state => ({
    osFromStore: state.osList.find(o => o.id === id),
    isStoreInitialized: state.isStoreInitialized,
    initializeStore: state.initializeStore,
  }));
  console.log(`[OSDetailsPage ${id}] OS do store (inicial):`, osFromStore ? { id: osFromStore.id, numero: osFromStore.numero } : null, `Store inicializado: ${isStoreInitialized}`);

  const [os, setOs] = useState<OS | undefined | null>(undefined);
  const [loadingMessage, setLoadingMessage] = useState('Carregando detalhes da OS...');

  useEffect(() => {
    console.log(`[OSDetailsPage ${id} useEffect - Store/Session] isStoreInitialized: ${isStoreInitialized}, session:`, session ? 'present' : 'null');
    if (!isStoreInitialized && session) { // Garante que o store seja inicializado se houver sessão
      console.log(`[OSDetailsPage ${id} useEffect - Store/Session] Store não inicializado, chamando initializeStore()`);
      setLoadingMessage('Inicializando dados da aplicação...');
      initializeStore().then(() => {
        console.log(`[OSDetailsPage ${id} useEffect - Store/Session] Store inicializado via OSDetailsPage.`);
        // A re-renderização causada pelo set({ isStoreInitialized: true }) no store 
        // deve acionar o próximo useEffect para definir a OS.
      }).catch(err => {
        console.error(`[OSDetailsPage ${id} useEffect - Store/Session] Erro ao inicializar store:`, err);
        setOs(null); // Indica falha ao carregar
        setLoadingMessage('Falha ao carregar dados da aplicação.');
      });
    }
  }, [id, isStoreInitialized, initializeStore, session]);

  useEffect(() => {
    console.log(`[OSDetailsPage ${id} useEffect - OS Setter] ID: ${id}, osFromStore:`, osFromStore ? 'present' : 'null', `isStoreInitialized: ${isStoreInitialized}`);
    if (id && isStoreInitialized) { // Apenas tente definir a OS se o store estiver pronto
      const currentOsInStore = useOSStore.getState().osList.find(o => o.id === id);
      console.log(`[OSDetailsPage ${id} useEffect - OS Setter] OS do store (getState):`, currentOsInStore ? { id: currentOsInStore.id, numero: currentOsInStore.numero } : null);

      if (currentOsInStore) {
        setOs(currentOsInStore);
        console.log(`[OSDetailsPage ${id} useEffect - OS Setter] OS definida a partir do store:`, currentOsInStore.numero);
      } else {
        console.warn(`[OSDetailsPage ${id} useEffect - OS Setter] OS com ID ${id} não encontrada no store, mesmo após inicialização. Tentando um delay...`);
        setLoadingMessage(`Procurando OS ${id}...`);
        const timer = setTimeout(() => {
            const stillNotFoundInStore = !useOSStore.getState().osList.find(o => o.id === id);
            if (stillNotFoundInStore) {
                console.error(`[OSDetailsPage ${id} useEffect - OS Setter] OS com ID ${id} AINDA não encontrada no store após delay.`);
                setOs(null); // OS não encontrada
                setLoadingMessage(`OS ${id} não encontrada.`);
            } else {
                 console.log(`[OSDetailsPage ${id} useEffect - OS Setter] OS ${id} encontrada no store APÓS delay.`);
                 setOs(useOSStore.getState().osList.find(o => o.id === id));
            }
        }, 1500); // Aumentado o delay para dar mais tempo se a atualização do store for lenta
        return () => clearTimeout(timer);
      }
    } else if (!id) {
      console.error(`[OSDetailsPage ${id} useEffect - OS Setter] ID da OS é undefined.`);
      setOs(null);
      setLoadingMessage('ID da OS inválido.');
    } else if (!isStoreInitialized) {
       console.log(`[OSDetailsPage ${id} useEffect - OS Setter] Aguardando inicialização do store...`);
       setLoadingMessage('Aguardando dados da aplicação...');
    }
  }, [id, osFromStore, isStoreInitialized]); // osFromStore é incluído para reavaliar se ele mudar

  if (os === undefined || !session || !isStoreInitialized) {
    console.log(`[OSDetailsPage ${id}] Condição de carregamento principal: os=${os === undefined ? 'undefined' : (os === null ? 'null' : 'present')}, session=${session ? 'present' : 'null'}, isStoreInitialized=${isStoreInitialized}`);
    return (
      <AuthenticatedLayout>
        <div className="d-flex flex-column align-items-center justify-content-center text-center" style={{ minHeight: 'calc(100vh - 200px)' }}>
           <div className="spinner-border text-primary me-3 mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
             <span className="visually-hidden">{loadingMessage}</span>
           </div>
          <p className="fs-5 text-muted mb-0">{loadingMessage}</p>
        </div>
      </AuthenticatedLayout>
    );
  }

  if (os === null) {
    console.log(`[OSDetailsPage ${id}] OS é null, renderizando OS Não Encontrada.`);
    return (
      <AuthenticatedLayout>
        <div className="text-center py-5">
          <h2 className="h3 fw-semibold mb-3 text-danger">Ordem de Serviço Não Encontrada</h2>
          <p className="text-muted mb-4">A OS que você está procurando (ID: {id}) não existe ou não pôde ser carregada.</p>
           <Link href={session.sessionType === 'admin' ? "/dashboard" : "/partner/dashboard"} className="btn btn-primary">
             Ir para o Painel
           </Link>
        </div>
      </AuthenticatedLayout>
    );
  }

  // Determine viewMode based on session
  const viewMode = session.sessionType === 'admin' ? 'admin' : 'partner';
  console.log(`[OSDetailsPage ${id}] ViewMode definido como: ${viewMode}`);

  // For partners, check if they are authorized to view this OS
  if (viewMode === 'partner' && os.createdByPartnerId !== session.id) {
    console.warn(`[OSDetailsPage ${id}] Acesso negado para parceiro. OS createdBy: ${os.createdByPartnerId}, Session ID: ${session.id}`);
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

  console.log(`[OSDetailsPage ${id}] Renderizando OSDetailsView para OS:`, { id: os.id, numero: os.numero });
  return (
    <AuthenticatedLayout>
      <div className="transition-opacity">
         <OSDetailsView initialOs={os} viewMode={viewMode} />
      </div>
    </AuthenticatedLayout>
  );
}

