
'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { devLoginAction } from '@/lib/actions/auth-actions';
import type { AuthActionState } from '@/lib/types';
import { useRouter } from 'next/navigation'; // Import useRouter
import { LogIn } from 'lucide-react';

function SubmitDevButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-sm btn-outline-warning w-100 mt-2" disabled={pending}>
      {pending ? (
        <>
          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
          Entrando (Dev)...
        </>
      ) : (
        <>
          <LogIn size={16} className="me-1" /> Entrar Dev
        </>
      )}
    </button>
  );
}

export default function DevLoginButton() {
  const router = useRouter();
  const initialState: AuthActionState = {
    message: null,
    type: undefined,
    redirect: undefined,
  };

  const [state, formAction] = useActionState<AuthActionState, FormData>(devLoginAction, initialState);

  useEffect(() => {
    console.log("[DevLoginButton] State from devLoginAction:", state);
    if (state?.type === 'success' && state?.redirect) {
      console.log(`[DevLoginButton] Success! Redirecting to ${state.redirect}`);
      router.push(state.redirect);
    } else if (state?.type === 'error' && state?.message) {
      // Optionally, display the error message from devLoginAction if it fails
      // For now, we'll just log it, as the main form handles general errors.
      console.error(`[DevLoginButton] Dev login failed: ${state.message}`);
      // alert(`Dev Login Error: ${state.message}`); // Or some other UI feedback
    }
  }, [state, router]);

  return (
    <form action={formAction}>
      <SubmitDevButton />
    </form>
  );
}
