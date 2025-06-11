// src/app/partner/dashboard/page.tsx
'use client';

import React, { useEffect, useState } from 'react'; // Mantemos useState e useEffect para o spinner básico
import Link from 'next/link';
import { useSession } from '@/hooks/useSession';
// import { useOSStore } from '@/store/os-store'; // Removido
// import type { OS } from '@/lib/types'; // Removido
// import { OSStatus } from '@/lib/types'; // Removido
// import OSCard from '@/components/os-grid/OSCard'; // Removido
import { PlusCircle, ListChecks } from 'lucide-react';

export default function PartnerDashboardPage() {
  const session = useSession();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    console.log('[PartnerDashboardPage SIMPLIFIED] Render/Update. Session from useSession():', JSON.stringify(session));
  }, [session]); // Adicionado `session` como dependência para logar sua mudança

  if (!isClient) {
    console.log('[PartnerDashboardPage SIMPLIFIED] Loading state: Aguardando cliente (isClient false).');
    return (
        <div className="d-flex flex-column align-items-center justify-content-center text-center p-4" style={{ minHeight: 'calc(100vh - 200px)' }}>
           <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
                <span className="visually-hidden">Aguardando cliente...</span>
           </div>
          <p className="text-muted fs-5">Aguardando cliente...</p>
        </div>
    );
  }
  
  if (!session) {
    console.log('[PartnerDashboardPage SIMPLIFIED] Loading state: Verificando sessão (session is null/undefined).');
    return (
        <div className="d-flex flex-column align-items-center justify-content-center text-center p-4" style={{ minHeight: 'calc(100vh - 200px)' }}>
           <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
                <span className="visually-hidden">Verificando sessão do parceiro...</span>
           </div>
          <p className="text-muted fs-5">Verificando sessão do parceiro...</p>
        </div>
    );
  }

  // Se chegou aqui, a sessão existe (não é null)
  console.log('[PartnerDashboardPage SIMPLIFIED] Session object received:', JSON.stringify(session));

  if (session.sessionType !== 'partner') {
    console.warn('[PartnerDashboardPage SIMPLIFIED] Session type is not partner. Session:', JSON.stringify(session));
    return (
        <div className="text-center py-5">
            <h1 className="h3">Acesso Negado</h1>
            <p className="text-muted">Esta página é apenas para parceiros. Tipo de sessão recebida: {session.sessionType}</p>
            <Link href="/login" className="btn btn-primary">Ir para Login Admin</Link>
        </div>
    );
  }

  // A sessão é de parceiro
  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom flex-wrap gap-2">
        <h1 className="h3 mb-0 me-auto d-flex align-items-center">
          <ListChecks size={24} className="me-2 text-primary" />
          Minhas Ordens de Serviço (Simplificado)
        </h1>
        <Link href="/partner/create-os" className="btn btn-success">
          <PlusCircle size={18} className="me-1" /> Criar Nova OS
        </Link>
      </div>

      <div className="alert alert-info">
        <h4 className="alert-heading">Página Simplificada!</h4>
        <p>Se você está vendo esta mensagem, a `PartnerDashboardPage` carregou com uma sessão de parceiro válida.</p>
        <hr />
        <p className="mb-0">Dados da Sessão Recebida (via useSession):</p>
        <pre className="small bg-light p-2 rounded mt-2 text-break" style={{whiteSpace: "pre-wrap"}}><code>{JSON.stringify(session, null, 2)}</code></pre>
      </div>
       <p className="mt-3">A lógica de exibição da lista de OS foi removida temporariamente para este teste.</p>
    </div>
  );
}
