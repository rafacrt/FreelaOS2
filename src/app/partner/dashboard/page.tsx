
'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useSession } from '@/hooks/useSession';
import { useOSStore } from '@/store/os-store';
import OSCard from '@/components/os-grid/OSCard'; // Reutilizando OSCard por enquanto
import AuthenticatedLayout from '@/components/layout/AuthenticatedLayout';
import { PlusCircle, ListChecks } from 'lucide-react';

export default function PartnerDashboardPage() {
  const session = useSession();
  const osList = useOSStore((state) => state.osList);

  const partnerOSList = useMemo(() => {
    if (!session || session.sessionType !== 'partner') {
      return [];
    }
    return osList.filter(os => os.createdByPartnerId === session.id)
                 .sort((a, b) => new Date(b.dataAbertura).getTime() - new Date(a.dataAbertura).getTime());
  }, [osList, session]);

  if (!session || session.sessionType !== 'partner') {
    // Idealmente, o middleware já teria redirecionado, mas como fallback:
    return (
      <AuthenticatedLayout>
        <div className="text-center py-5">
          <h1 className="h3">Acesso Negado</h1>
          <p className="text-muted">Você precisa estar logado como parceiro para ver esta página.</p>
          <Link href="/partner-login" className="btn btn-primary">
            Login de Parceiro
          </Link>
        </div>
      </AuthenticatedLayout>
    );
  }

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

      {partnerOSList.length === 0 ? (
        <div className="text-center py-5">
          <p className="fs-5 text-muted">Nenhuma Ordem de Serviço criada por você ainda.</p>
          <p className="text-muted small">Clique em "Criar Nova OS" para começar.</p>
        </div>
      ) : (
        <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-xl-4 g-3 pb-4">
          {partnerOSList.map((os) => (
            <div className="col" key={os.id}>
              <OSCard os={os} />
            </div>
          ))}
        </div>
      )}
    </AuthenticatedLayout>
  );
}
