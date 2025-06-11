// src/app/partner/dashboard/page.tsx
'use client';

import React, { useEffect, useState, useContext } from 'react'; // Adicionado useContext
import Link from 'next/link';
import { SessionContext } from '@/contexts/SessionContext'; // Importar contexto diretamente
import type { SessionPayload } from '@/lib/types';
import { ListChecks, PlusCircle } from 'lucide-react'; // Re-adicionando ícones

export default function PartnerDashboardPage() {
  const [isClient, setIsClient] = useState(false);
  const session = useContext(SessionContext); // Usar useContext diretamente

  useEffect(() => {
    setIsClient(true);
    // Logar o objeto de contexto em si e a sessão dele
    console.log('[PartnerDashboardPage AGGRESSIVE] Context object from SessionContext:', SessionContext);
    console.log('[PartnerDashboardPage AGGRESSIVE] Render/Update. Session from useContext(SessionContext):', JSON.stringify(session));
  }, [session]); // Re-log when session from context changes

  if (!isClient) {
    console.log('[PartnerDashboardPage AGGRESSIVE] Loading state: Aguardando cliente (isClient false).');
    return (
        <div className="d-flex flex-column align-items-center justify-content-center text-center p-4" style={{ minHeight: 'calc(100vh - 200px)' }}>
           <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
                <span className="visually-hidden">Aguardando cliente...</span>
           </div>
          <p className="text-muted fs-5">Aguardando cliente...</p>
        </div>
    );
  }
  
  if (!session) { // This check now happens after isClient is true
    console.log('[PartnerDashboardPage AGGRESSIVE] Loading state: Verificando sessão (session is null/undefined from useContext).');
    return (
        <div className="d-flex flex-column align-items-center justify-content-center text-center p-4" style={{ minHeight: 'calc(100vh - 200px)' }}>
           <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
                <span className="visually-hidden">Verificando sessão do parceiro (useContext)...</span>
           </div>
          <p className="text-muted fs-5">Verificando sessão do parceiro (useContext)...</p>
        </div>
    );
  }

  // Se chegamos aqui, a sessão DEVE ser o objeto mockado.
  console.log('[PartnerDashboardPage AGGRESSIVE] Session object received via useContext:', JSON.stringify(session));

  if (session.sessionType !== 'partner') { // Should not happen with the mock
    console.warn('[PartnerDashboardPage AGGRESSIVE] Session type is not partner. Session:', JSON.stringify(session));
    return (
        <div className="text-center py-5">
            <h1 className="h3">Acesso Negado</h1>
            <p className="text-muted">Esta página é apenas para parceiros. Tipo de sessão recebida: {session.sessionType}</p>
            <Link href="/login" className="btn btn-primary">Ir para Login Admin</Link>
        </div>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom flex-wrap gap-2">
        <h1 className="h3 mb-0 me-auto d-flex align-items-center">
          <ListChecks size={24} className="me-2 text-primary" />
          Minhas Ordens de Serviço (Simplificado AGGRESSIVE)
        </h1>
        <Link href="/partner/create-os" className="btn btn-success">
          <PlusCircle size={18} className="me-1" /> Criar Nova OS
        </Link>
      </div>

      <div className="alert alert-info">
        <h4 className="alert-heading">Página Simplificada (AGGRESSIVE TEST)!</h4>
        <p>Se você está vendo esta mensagem, a `PartnerDashboardPage` carregou e a sessão (via useContext) é:</p>
        <pre className="small bg-light p-2 rounded mt-2 text-break" style={{whiteSpace: "pre-wrap"}}><code>{JSON.stringify(session, null, 2)}</code></pre>
      </div>
       <p className="mt-3">A lógica de exibição da lista de OS foi removida temporariamente para este teste.</p>
    </div>
  );
}
