
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation'; // Import useRouter
import AuthenticatedLayout from '@/components/layout/AuthenticatedLayout';
import OSDetailsView from '@/components/os/OSDetailsView';
import { useOSStore } from '@/store/os-store';
import type { OS } from '@/lib/types';
import Link from 'next/link';

export default function OSDetailsPage() {
  const params = useParams();
  const router = useRouter(); // Initialize router
  const id = typeof params.id === 'string' ? params.id : undefined;

  // Select the specific OS from the store's osList
  // This ensures that when the OS object in the store updates, this component re-renders with the new OS data.
  const osFromStore = useOSStore(state => state.osList.find(o => o.id === id));

  const [os, setOs] = useState<OS | undefined | null>(undefined); // undefined: loading, null: not found

  useEffect(() => {
    if (id) {
      if (osFromStore) {
        setOs(osFromStore);
      } else {
        // If not found in store after a delay (e.g., direct navigation),
        // it might indicate an issue or a very fresh OS not yet in client store.
        // For now, we'll assume store is the source of truth after initial load.
        // Consider fetching from DB if not in store as a fallback for direct navigation.
        const timer = setTimeout(() => {
            const stillNotFound = !useOSStore.getState().osList.find(o => o.id === id);
            if (stillNotFound) {
                console.warn(`[OSDetailsPage] OS with ID ${id} not found in store after delay.`);
                setOs(null); // Mark as not found
            }
        }, 1000); // Wait a bit for store to potentially populate
        return () => clearTimeout(timer);
      }
    } else {
      setOs(null); // No ID, so not found
    }
  }, [id, osFromStore]); // Re-run when id or the specific osFromStore object changes

  if (os === undefined) {
    return (
      <AuthenticatedLayout>
        <div className="d-flex flex-column align-items-center justify-content-center text-center" style={{ minHeight: 'calc(100vh - 200px)' }}>
           <div className="spinner-border text-primary me-3 mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
             <span className="visually-hidden">Carregando...</span>
           </div>
          <p className="fs-5 text-muted mb-0">Carregando detalhes da OS...</p>
        </div>
      </AuthenticatedLayout>
    );
  }

  if (os === null) {
    return (
      <AuthenticatedLayout>
        <div className="text-center py-5">
          <h2 className="h3 fw-semibold mb-3 text-danger">Ordem de Serviço Não Encontrada</h2>
          <p className="text-muted mb-4">A OS que você está procurando não existe ou não pôde ser carregada.</p>
           <Link href="/dashboard" className="btn btn-primary">
             Ir para o Painel
           </Link>
        </div>
      </AuthenticatedLayout>
    );
  }

  // Pass the potentially updated 'os' (from osFromStore) to OSDetailsView
  return (
    <AuthenticatedLayout>
      <div className="transition-opacity">
         <OSDetailsView initialOs={os} />
      </div>
    </AuthenticatedLayout>
  );
}
