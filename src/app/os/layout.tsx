
// src/app/os/layout.tsx
'use client'; 

import AuthenticatedLayout from '@/components/layout/AuthenticatedLayout';
import type { ReactNode } from 'react';

export default function OSGroupLayout({ children }: { children: ReactNode }) {
  return (
    <AuthenticatedLayout>
      {children}
    </AuthenticatedLayout>
  );
}
