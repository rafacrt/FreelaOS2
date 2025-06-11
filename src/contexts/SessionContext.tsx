
'use client';

import { createContext } from 'react';
import type { SessionPayload } from '@/lib/types';

export const SessionContext = createContext<SessionPayload | null>(null);
