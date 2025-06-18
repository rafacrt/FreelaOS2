
'use client'; // Error components must be Client Components

import { useEffect } from 'react';
import Link from 'next/link';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // console.error("Dashboard Error Boundary Caught:", error); // Log the error to an error reporting service
  }, [error]);

  return (
    // Use Bootstrap centering and spacing utilities
    <div className="d-flex flex-column align-items-center justify-content-center text-center p-4" style={{ minHeight: 'calc(100vh - 200px)' }}>
      <h1 className="h2 fw-bold text-danger mb-3">Oops! Algo deu errado.</h1>
      <p className="fs-5 text-muted mb-4">
        Não foi possível carregar o painel de controle no momento.
      </p>
      {/* Use Bootstrap alert for error details */}
      <div className="alert alert-danger p-3 mb-4" style={{ maxWidth: '500px', width: '100%' }}>
        <h4 className="alert-heading h6 fw-semibold mb-2">Detalhes do Erro:</h4>
        <p className="mb-1 small text-break">{error.message}</p>
        {error.digest && (
          <p className="mb-0 mt-2 small text-muted">Digest: {error.digest}</p>
        )}
      </div>
      <div className="d-flex gap-3">
         <button
          onClick={() => reset()}
          className="btn btn-primary btn-lg"
        >
          Tentar Novamente
        </button>
        {/* Use Bootstrap button for link */}
        <Link href="/" className="btn btn-outline-secondary btn-lg">
          Voltar para Início
        </Link>
      </div>
    </div>
  );
}
