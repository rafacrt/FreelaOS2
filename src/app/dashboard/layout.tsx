
// src/app/dashboard/layout.tsx
'use client';

import AuthenticatedLayout from '@/components/layout/AuthenticatedLayout';
import type { ReactNode } from 'react';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  console.log('[DashboardLayout] Renderizando...');
  return (
    <AuthenticatedLayout>
      {children}
    </AuthenticatedLayout>
  );
}
