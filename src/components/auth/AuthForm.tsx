
'use client';

import { useActionState, useFormStatus } from 'react';
import { loginAction } from '@/lib/actions/auth-actions';
import { useEffect, useState } from 'react';
import { AlertCircle, LogIn } from 'lucide-react';
import { useRouter } from 'next/navigation'; // Import for potential redirection after login

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
  // The 'redirect' property might not be directly part of the state from loginAction,
  // as redirection is often handled by calling redirect() within the action itself.
  // However, if loginAction is designed to return a redirect path, this structure is fine.
  const [state, formAction] = useActionState(loginAction, { message: initialMessage || null, type: initialMessageType || undefined, redirect: undefined });
  const [message, setMessage] = useState(initialMessage || '');
  const [messageType, setMessageType] = useState<'success' | 'error' | undefined>(initialMessageType);
  const router = useRouter();

  useEffect(() => {
    if (state?.message) {
      setMessage(state.message);
      setMessageType(state.type);
    }
    // Handle redirection if the action state indicates it
    // Note: Direct redirection within Server Actions is usually preferred using `redirect()` from `next/navigation`.
    // This client-side redirect based on state is a fallback or alternative.
    if (state?.type === 'success' && state?.redirect) {
      router.push(state.redirect);
    }
  }, [state, router]);
  
  return (
    <form action={formAction} className="space-y-4">
      {message && (
        <div className={`alert ${messageType === 'error' ? 'alert-danger' : 'alert-success'} d-flex align-items-center p-2`} role="alert">
          {messageType === 'error' && <AlertCircle size={18} className="me-2 flex-shrink-0" />}
          <small>{message}</small>
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
