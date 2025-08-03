'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { simulatePartnerLoginAction } from '@/lib/actions/auth-actions';
import type { AuthActionState } from '@/lib/types';
import { Briefcase } from 'lucide-react';

function SubmitPartnerDevButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-sm btn-outline-info w-100 mt-2" disabled={pending}>
      {pending ? (
        <>
          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
          Entrando (Dev Parceiro)...
        </>
      ) : (
        <>
          <Briefcase size={16} className="me-1" /> Entrar Dev Parceiro
        </>
      )}
    </button>
  );
}

export default function SimulatedPartnerLoginButton() {
  const initialState: AuthActionState = {
    message: null,
    type: undefined,
    redirect: undefined,
  };

  const [state, formAction] = useActionState<AuthActionState, FormData>(simulatePartnerLoginAction, initialState);

  useEffect(() => {
    if (state?.type === 'error' && state?.message) {
      // Handle error display if needed, e.g., via a toast notification
    }
  }, [state]);

  return (
    <form action={formAction}>
      <SubmitPartnerDevButton />
    </form>
  );
}
