
'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { registerUserAction } from '@/lib/actions/auth-actions';
import type { AuthActionState } from '@/lib/types'; // Import the type
import { useRouter } from 'next/navigation';
import { AlertCircle, UserPlus } from 'lucide-react';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary w-100" disabled={pending}>
      {pending ? (
        <>
          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
          Registrando...
        </>
      ) : (
        <>
         <UserPlus size={16} className="me-2" /> Registrar
        </>
      )}
    </button>
  );
}

export default function RegisterForm() {
  const router = useRouter();

  const initialState: AuthActionState = {
    message: null,
    type: undefined,
    redirect: undefined,
  };

  const [state, formAction] = useActionState<AuthActionState, FormData>(registerUserAction, initialState);

  const [displayMessage, setDisplayMessage] = useState(initialState.message);
  const [displayMessageType, setDisplayMessageType] = useState(initialState.type);

  useEffect(() => {
    if (state?.message) {
      setDisplayMessage(state.message);
      setDisplayMessageType(state.type);
    }
    if (state?.type === 'success' && state?.redirect) {
      const timer = setTimeout(() => {
          router.push(state.redirect!);
      }, state.message ? 1500 : 500);
      return () => clearTimeout(timer);
    }
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-4">
      {displayMessage && (
         <div className={`alert ${displayMessageType === 'error' ? 'alert-danger' : 'alert-success'} d-flex align-items-center p-2`} role="alert">
          {displayMessageType === 'error' && <AlertCircle size={18} className="me-2 flex-shrink-0" />}
          <small>{displayMessage}</small>
        </div>
      )}
      <div className="mb-3">
        <label htmlFor="username" className="form-label">
          Usuário
        </label>
        <input
          id="username"
          name="username"
          type="text"
          className="form-control"
          required
          placeholder="Escolha um nome de usuário"
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
          placeholder="Crie uma senha (mín. 6 caracteres)"
          minLength={6}
        />
      </div>
      <SubmitButton />
    </form>
  );
}
