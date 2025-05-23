
'use client';

import { useActionState, useEffect, useState } from 'react'; // Correct: useActionState from 'react'
import { useFormStatus } from 'react-dom'; // Correct: useFormStatus from 'react-dom'
import { registerUserAction } from '@/lib/actions/auth-actions';
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
  const [state, formAction] = useActionState(registerUserAction, { 
    message: null, 
    type: undefined, 
    redirect: undefined 
  });
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | undefined>(undefined);

  useEffect(() => {
    if (state?.message) {
      setMessage(state.message);
      setMessageType(state.type);
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
