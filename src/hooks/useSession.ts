
'use client';

import { useContext } from 'react';
import { SessionContext } from '@/components/layout/AuthenticatedLayout'; // Importa o Context
import type { SessionPayload } from '@/lib/types';

export function useSession(): SessionPayload | null {
  const session = useContext(SessionContext);
  // Não precisa mais lançar erro, pois o AuthenticatedLayout pode prover null inicialmente
  // ou se não houver sessão. Os componentes consumidores devem tratar o caso de sessão nula.
  return session;
}
