
// src/app/partner/layout.tsx
'use client'; // Este layout usará AuthenticatedLayout, que é um Client Component

import AuthenticatedLayout from '@/components/layout/AuthenticatedLayout';
import type { ReactNode } from 'react';

export default function PartnerGroupLayout({ children }: { children: ReactNode }) {
  // AuthenticatedLayout aqui irá prover o SessionContext para as páginas filhas
  // como PartnerDashboardPage e PartnerCreateOSPage
  return (
    <AuthenticatedLayout>
      {children}
    </AuthenticatedLayout>
  );
}
