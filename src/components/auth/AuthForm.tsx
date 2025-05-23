
'use client';

import { useActionState, useEffect, useState } from 'react'; // Correct: useActionState from 'react'
import { useFormStatus } from 'react-dom'; // Correct: useFormStatus from 'react-dom'
import { loginAction } from '@/lib/actions/auth-actions';
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
  // Initialize state for the action with a default structure
  const [state, formAction] = useActionState(loginAction, { 
    message: initialMessage || null, 
    type: initialMessageType || undefined, 
    redirect: undefined 
  });

  const [message, setMessage] = useState(initialMessage || '');
  const [messageType, setMessageType] = useState<'success' | 'error' | undefined>(initialMessageType);
  const router = useRouter();

  useEffect(() => {
    if (state?.message) {
      setMessage(state.message);
      setMessageType(state.type);
    }
    if (state?.type === 'success' && state?.redirect) {
      // Delay redirect slightly for success message to be seen
      const timer = setTimeout(() => {
        router.push(state.redirect!);
      }, state.message ? 1000 : 200); // Shorter delay if no specific message
      return () => clearTimeout(timer);
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
