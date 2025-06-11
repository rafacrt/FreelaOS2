
'use client';

import { useFormStatus } from 'react-dom';
import { LogIn } from 'lucide-react';

interface SimulatedLoginButtonProps {
  buttonText: string;
  className?: string;
  icon?: React.ReactNode;
}

export function SimulatedLoginButton({
  buttonText,
  className = "btn-primary",
  icon = <LogIn size={16} className="me-2" />
}: SimulatedLoginButtonProps) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={`btn w-100 ${className}`} disabled={pending}>
      {pending ? (
        <>
          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
          Entrando...
        </>
      ) : (
        <>
          {icon} {buttonText}
        </>
      )}
    </button>
  );
}
