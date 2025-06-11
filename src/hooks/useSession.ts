
'use client';

import { useContext } from 'react';
import { SessionContext } from '@/contexts/SessionContext'; // Import from new location
import type { SessionPayload } from '@/lib/types';

export function useSession(): SessionPayload | null {
  const session = useContext(SessionContext);
  return session;
}
