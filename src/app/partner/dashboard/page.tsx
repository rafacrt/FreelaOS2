// src/app/partner/dashboard/page.tsx
'use client';

import React from 'react'; // Manter a importação do React
import Link from 'next/link'; // Restaurar Link

// Hooks e lógica de estado temporariamente comentados para depuração extrema
// import { useSession } from '@/hooks/useSession';
// import { useOSStore } from '@/store/os-store';
// import { useEffect, useState, useMemo } from 'react';

export default function PartnerDashboardPage() {
  console.log('[PartnerDashboardPage EXTREME SIMPLIFICATION DEBUG] Renderizando componente mínimo.');

  // Toda a lógica de hooks, estado e efeitos foi comentada.
  // const session = useSession();
  // const { osList, isStoreInitialized, initializeStore } = useOSStore(state => ({
  //   osList: state.osList,
  //   isStoreInitialized: state.isStoreInitialized,
  //   initializeStore: state.initializeStore,
  // }));
  // const [isClient, setIsClient] = useState(false);

  // useEffect(() => {
  //   setIsClient(true);
  //   console.log('[PartnerDashboardPage EXTREME SIMPLIFICATION DEBUG] isClient seria true aqui.');
  // }, []);

  // useEffect(() => {
  //   if (isClient) {
  //     console.log('[PartnerDashboardPage EXTREME SIMPLIFICATION DEBUG] Render/Update. Sessão e Store comentados.');
  //   }
  // }, [isClient /*, session, isStoreInitialized*/]);

  // A lógica condicional de renderização baseada em isClient, session, etc., foi removida.
  // Renderiza diretamente o JSX estático.

  return (
    <div>
      <h1>Partner Dashboard (Extremamente Simplificado)</h1>
      <p>Se você vê esta mensagem, o componente básico renderizou sem o erro React #130.</p>
      <p>A lógica de sessão e do store está temporariamente desabilitada nesta página.</p>
      <Link 
        href="/partner/create-os" 
        className="btn btn-success" // Adicionando classes Bootstrap para que pareça um botão
      >
         Criar Nova OS (Link de Teste Restaurado)
      </Link>
    </div>
  );
}
