// src/app/partner/create-os/page.tsx
'use client';

import React from 'react';
import Link from 'next/link';
// AuthenticatedLayout não é mais necessário aqui, pois será provido pelo src/app/partner/layout.tsx

export default function PartnerCreateOSPage() {
  console.log('[PartnerCreateOSPage EXTREME SIMPLIFICATION DEBUG] Renderizando componente mínimo.');

  return (
    // Removido o AuthenticatedLayout daqui
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">Criar Nova Ordem de Serviço (Simplificado)</h1>
        <Link href="/partner/dashboard" className="btn btn-outline-secondary btn-sm">
          {/* <ArrowLeft className="me-2" size={16} /> */} Voltar ao Painel do Parceiro (Simplificado)
        </Link>
      </div>

      <div className="card shadow-sm">
        <div className="card-header">
          Página de Criação de OS Simplificada para Teste
        </div>
        <div className="card-body">
          <p>Se você vê esta mensagem, a página de criação de OS carregou em seu estado mínimo.</p>
          <p>A funcionalidade de formulário está temporariamente desabilitada.</p>
        </div>
      </div>
    </div>
  );
}
