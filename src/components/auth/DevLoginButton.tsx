
'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { devLoginAction } from '@/lib/actions/auth-actions';
import type { AuthActionState } from '@/lib/types';
// useRouter não é mais necessário aqui, o Next.js lida com o redirect da action
// import { useRouter } from 'next/navigation';
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
  // const router = useRouter(); // Removido
  const initialState: AuthActionState = {
    message: null,
    type: undefined,
    redirect: undefined,
  };

  // useActionState agora lida com o redirecionamento se a action retornar um estado com `redirect`
  const [state, formAction] = useActionState<AuthActionState, FormData>(devLoginAction, initialState);

  useEffect(() => {
    // Apenas logamos o estado para depuração. O redirecionamento é feito pelo Next.js.
    if (state?.type === 'error' && state?.message) {
      // Poderia exibir state.message em um alerta ou toast se desejado
    }
    // Não é mais necessário chamar router.push() aqui
    // if (state?.type === 'success' && state?.redirect) {
    //   // router.push(state.redirect); // Removido
    // }
  }, [state]);

  return (
    <form action={formAction}>
      <SubmitDevButton />
    </form>
  );
}
