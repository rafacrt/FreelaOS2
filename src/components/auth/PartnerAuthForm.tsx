
'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { partnerLoginAction } from '@/lib/actions/auth-actions'; // Changed to partnerLoginAction
import type { AuthActionState } from '@/lib/types';
import { AlertCircle, LogIn } from 'lucide-react';
// import { useRouter } from 'next/navigation'; // Not strictly needed if action handles redirect

interface PartnerAuthFormProps {
  initialMessage?: string;
  initialMessageType?: 'success' | 'error';
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary w-100" disabled={pending}>
      {pending ? (
        <>
          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
          Entrando...
        </>
      ) : (
        <>
          <LogIn size={16} className="me-2" /> Entrar como Parceiro
        </>
      )}
    </button>
  );
}

export default function PartnerAuthForm({ initialMessage, initialMessageType }: PartnerAuthFormProps) {
  // const router = useRouter(); // Keep if needed for other navigations

  const initialState: AuthActionState = {
    message: initialMessage || null,
    type: initialMessageType || undefined,
    redirect: undefined,
  };

  const [state, formAction] = useActionState<AuthActionState, FormData>(partnerLoginAction, initialState);

  const [displayMessage, setDisplayMessage] = useState(initialState.message);
  const [displayMessageType, setDisplayMessageType] = useState(initialState.type);

  useEffect(() => {
    if (state?.message) {
      setDisplayMessage(state.message);
      setDisplayMessageType(state.type);
    } else if (initialState.message && !state?.message) {
      setDisplayMessage(initialState.message);
      setDisplayMessageType(initialState.type);
    } else if (!state?.message && !initialState.message) {
      setDisplayMessage(null);
      setDisplayMessageType(undefined);
    }
  }, [state?.message, state?.type, initialState.message, initialState.type]);


  useEffect(() => {
    if (state?.type === 'success' && state?.redirect) {
      // Next.js server action redirects should handle this automatically if `redirect()` is called in action
      // For client-side forced redirect after message display:
      // window.location.assign(state.redirect);
    }
  }, [state?.type, state?.redirect]);

  return (
    <form action={formAction} className="space-y-4">
      {displayMessage && (
        <div className={`alert ${displayMessageType === 'error' ? 'alert-danger' : 'alert-success'} d-flex align-items-center p-2`} role="alert">
          {displayMessageType === 'error' && <AlertCircle size={18} className="me-2 flex-shrink-0" />}
          <small>{displayMessage}</small>
        </div>
      )}
      <div className="mb-3">
        <label htmlFor="identifier" className="form-label">
          Usuário ou Email do Parceiro
        </label>
        <input
          id="identifier"
          name="identifier" // Ensure name matches what action expects
          type="text"
          className="form-control"
          required
          placeholder="Seu usuário ou email de parceiro"
        />
      </div>
      <div className="mb-3">
        <label htmlFor="password" className="form-label">
          Senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          className="form-control"
          required
          placeholder="Sua senha"
        />
      </div>
      <SubmitButton />
    </form>
  );
}
    