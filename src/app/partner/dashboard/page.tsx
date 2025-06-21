
// src/app/partner/dashboard/page.tsx
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useSession } from '@/hooks/useSession';
import type { OS } from '@/lib/types';
import { useOSStore } from '@/store/os-store';
import { ListChecks, PlusCircle, AlertTriangle } from 'lucide-react';
import OSCard from '@/components/os-grid/OSCard';

export default function PartnerDashboardPage() {
  const [isClient, setIsClient] = useState(false);
  const session = useSession();
  const { osList, isStoreInitialized, initializeStore } = useOSStore(state => ({
      osList: state.osList,
      isStoreInitialized: state.isStoreInitialized,
      initializeStore: state.initializeStore,
  }));

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (session && !isStoreInitialized) {
        initializeStore();
    }
  }, [session, isStoreInitialized, initializeStore]);

  const partnerOSList = useMemo(() => {
    if (!session || session.sessionType !== 'partner' || !isStoreInitialized) {
      return [];
    }
    
    const filtered = osList.filter(os => {
      // Show OS if the partner created it OR is assigned as the execution partner
      return os.createdByPartnerId === session.id || os.partnerId === session.id;
    });

    return filtered.sort((a, b) => {
        if (a.isUrgent && !b.isUrgent) return -1;
        if (!a.isUrgent && b.isUrgent) return 1;
        return new Date(b.dataAbertura).getTime() - new Date(a.dataAbertura).getTime();
    });
  }, [osList, session, isStoreInitialized]);

  if (!isClient || !session || !isStoreInitialized) {
    let loadingMessage = "Carregando...";
    if (!isClient) loadingMessage = "Aguardando renderização do cliente...";
    else if (!session) loadingMessage = "Verificando sessão do parceiro...";
    else if (!isStoreInitialized) loadingMessage = "Carregando dados das Ordens de Serviço...";

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
    return (
        <div className="text-center py-5">
            <h1 className="h3">Acesso Negado</h1>
            <p className="text-muted">Esta página é apenas para parceiros.</p>
            <Link href="/login" className="btn btn-primary">Ir para Login Admin</Link>
        </div>
    );
  }

  const partnerSession = session;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom flex-wrap gap-2">
        <h1 className="h3 mb-0 me-auto d-flex align-items-center">
          <ListChecks size={24} className="me-2 text-primary" />
          Minhas Ordens de Serviço
        </h1>
        <div className="d-flex align-items-center gap-2">
            <span className="text-muted small" title={`ID do Parceiro: ${partnerSession.id}`}>Parceiro: {partnerSession.partnerName}</span>
            <Link href="/partner/create-os" className="btn btn-success">
              <PlusCircle size={18} className="me-1" /> Criar Nova OS
            </Link>
        </div>
      </div>

      {!partnerSession.isApproved && (
        <div className="alert alert-warning d-flex align-items-center mb-4" role="alert">
          <AlertTriangle size={20} className="me-2 flex-shrink-0" />
          <div>
            <strong>Atenção:</strong> Sua conta de parceiro ainda não foi aprovada por um administrador.
            Você pode criar Ordens de Serviço, mas elas ficarão com status "Aguardando Aprovação" até serem revisadas.
          </div>
        </div>
      )}

      {partnerOSList.length === 0 ? (
        <div className="text-center py-5 bg-light rounded shadow-sm p-4">
          <p className="fs-5 text-muted">Nenhuma Ordem de Serviço associada a você.</p>
          <p className="text-muted small">Crie uma nova OS ou aguarde um admin associar uma OS a você.</p>
          <Link href="/partner/create-os" className="btn btn-primary mt-3">
            <PlusCircle size={18} className="me-1" /> Criar Nova OS
          </Link>
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
