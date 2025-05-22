
'use client';

import { useState, useEffect } from 'react';

export default function FooterContent() {
  const [currentYear, setCurrentYear] = useState<number | null>(null);

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  if (currentYear === null) {
    return <div style={{ height: '1.5rem' }}></div>;
  }

  return (
    <span className="text-muted small">
      © {currentYear} FreelaOS. Todos os direitos reservados. {/* Removed "Minimal" */}
    </span>
  );
}
