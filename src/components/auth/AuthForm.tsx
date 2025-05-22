
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 988ed2c (vc não pode colocar tudo isso já no projeto? (essa questão do bcrypt) onde meu trabalho seja unicamente criar as tabelas via sql lá no banco? vc cria uma área para cadastro de usuário, e o primeiro usuário registrado, já vira super admin, e do segundo em diante precisa de aprovação)
'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { loginAction } from '@/lib/actions/auth-actions';
import { useEffect, useState } from 'react';
import { AlertCircle, LogIn } from 'lucide-react';

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
  const [state, formAction] = useFormState(loginAction, { message: initialMessage || null, type: initialMessageType || undefined });
  const [message, setMessage] = useState(initialMessage || '');
  const [messageType, setMessageType] = useState<'success' | 'error' | undefined>(initialMessageType);

  useEffect(() => {
    if (state?.message) {
      setMessage(state.message);
      setMessageType(state.type);
    }
  }, [state]);
  
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
<<<<<<< HEAD
=======
// This file is no longer needed and will be deleted.
// If you re-introduce login, you can recreate it.
// For now, access is direct to the dashboard.
>>>>>>> 8e19822 (remova a parte do login que fizemos alguns passos atrás)
=======
>>>>>>> 988ed2c (vc não pode colocar tudo isso já no projeto? (essa questão do bcrypt) onde meu trabalho seja unicamente criar as tabelas via sql lá no banco? vc cria uma área para cadastro de usuário, e o primeiro usuário registrado, já vira super admin, e do segundo em diante precisa de aprovação)
