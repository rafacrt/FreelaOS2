
'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { loginAction } from '@/lib/actions/auth-actions';
import type { AuthActionState } from '@/lib/types';
import { AlertCircle, LogIn } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface AuthFormProps {
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
          <LogIn size={16} className="me-2" /> Entrar
        </>
      )}
    </button>
  );
}

export default function AuthForm({ initialMessage, initialMessageType }: AuthFormProps) {
  const router = useRouter(); // Keep router for potential future use or other navigations

  const initialState: AuthActionState = {
    message: initialMessage || null,
    type: initialMessageType || undefined,
    redirect: undefined,
  };

  const [state, formAction] = useActionState<AuthActionState, FormData>(loginAction, initialState);

  const [displayMessage, setDisplayMessage] = useState(initialState.message);
  const [displayMessageType, setDisplayMessageType] = useState(initialState.type);

  useEffect(() => {
    console.log("[AuthForm] Message useEffect. state.message:", state?.message, "state.type:", state?.type);
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
    console.log("[AuthForm] Redirection useEffect. state.type:", state?.type, "state.redirect:", state?.redirect);
    if (state?.type === 'success' && state?.redirect) {
      console.log(`[AuthForm] Success state detected. Attempting redirect with window.location.assign to: ${state.redirect}`);
      if (state.redirect) {
        window.location.assign(state.redirect);
      }
    }
  }, [state?.type, state?.redirect]); // Removed router from dependencies as it's not used here for push

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
          placeholder="Seu nome de usuário"
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
