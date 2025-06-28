
'use client';

import React, { useActionState, useEffect, useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useSettingsStore } from '@/store/settings-store';
import { changePasswordAction } from '@/lib/actions/user-actions';
import type { AuthActionState } from '@/lib/types';
import { AlertCircle, Eye, EyeOff, KeyRound, Palette, Save, SlidersHorizontal } from 'lucide-react';
import { useFormStatus } from 'react-dom';
import { useSession } from '@/hooks/useSession';


const passwordSchema = z.object({
  currentPassword: z.string().min(1, { message: 'A senha atual é obrigatória.' }),
  newPassword: z.string().min(6, { message: 'A nova senha deve ter no mínimo 6 caracteres.' }),
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'As novas senhas não coincidem.',
  path: ['confirmPassword'],
});

type PasswordFormValues = z.infer<typeof passwordSchema>;

function PasswordSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? (
        <>
          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
          Salvando...
        </>
      ) : (
        <>
          <Save size={16} className="me-2" />
          Salvar Nova Senha
        </>
      )}
    </button>
  );
}


export default function SettingsPage() {
  const session = useSession();
  const { showChronometer, toggleShowChronometer } = useSettingsStore();
  const [isClient, setIsClient] = useState(false);
  const [passwordFormMessage, setPasswordFormMessage] = useState<AuthActionState | null>(null);

  const [state, formAction] = useActionState(changePasswordAction, null);

  useEffect(() => {
    setIsClient(true);
  }, []);
  
  useEffect(() => {
    if (state) {
        setPasswordFormMessage(state);
        if (state.type === 'success') {
            const timer = setTimeout(() => setPasswordFormMessage(null), 3000);
            return () => clearTimeout(timer);
        }
    }
  }, [state]);


  if (!isClient || !session) {
     return (
        <div className="d-flex justify-content-center align-items-center" style={{minHeight: '400px'}}>
            <div className="spinner-border text-primary" role="status" style={{width: '3rem', height: '3rem'}}>
                <span className="visually-hidden">Carregando...</span>
            </div>
        </div>
    );
  }

  return (
    <div className="container py-3 py-lg-4">
      <div className="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom">
        <h1 className="h3 mb-0 d-flex align-items-center">
            <SlidersHorizontal size={24} className="me-2 text-primary" />
            Configurações
        </h1>
      </div>

      <div className="row g-4">
        {/* General Settings Column */}
        <div className="col-md-6">
          <div className="card shadow-sm h-100">
            <div className="card-header d-flex align-items-center">
                <Palette size={18} className="me-2 text-info" />
                <h2 className="h5 mb-0 card-title">Preferências de Interface</h2>
            </div>
            <div className="card-body">
              <ul className="list-group list-group-flush">
                <li className="list-group-item d-flex justify-content-between align-items-center">
                  <label htmlFor="showChronometer" className="form-check-label mb-0">
                    Exibir Cronômetro
                    <p className="text-muted small mb-0">Mostra/oculta o cronômetro e seus controles na aplicação.</p>
                  </label>
                  <div className="form-check form-switch">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      role="switch"
                      id="showChronometer"
                      checked={showChronometer}
                      onChange={toggleShowChronometer}
                    />
                  </div>
                </li>
              </ul>
            </div>
             <div className="card-footer text-muted small">
                Suas preferências de interface são salvas no seu navegador.
            </div>
          </div>
        </div>

        {/* Account Settings Column */}
        <div className="col-md-6">
          <div className="card shadow-sm h-100">
             <div className="card-header d-flex align-items-center">
                 <KeyRound size={18} className="me-2 text-success" />
                 <h2 className="h5 mb-0 card-title">Segurança da Conta</h2>
            </div>
            <div className="card-body">
              <h3 className="h6">Alterar Senha</h3>
              <p className="small text-muted">Use uma senha forte para manter sua conta segura.</p>
              
              <form action={formAction}>
                 {passwordFormMessage && (
                    <div className={`alert ${passwordFormMessage.type === 'error' ? 'alert-danger' : 'alert-success'} d-flex align-items-center p-2 small`} role="alert">
                      <AlertCircle size={18} className="me-2 flex-shrink-0" />
                      <div>{passwordFormMessage.message}</div>
                    </div>
                  )}

                <div className="mb-3">
                  <label htmlFor="currentPassword" className="form-label form-label-sm">Senha Atual</label>
                  <input
                    type="password"
                    id="currentPassword"
                    name="currentPassword"
                    className="form-control form-control-sm"
                    required
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="newPassword" className="form-label form-label-sm">Nova Senha</label>
                  <input
                    type="password"
                    id="newPassword"
                    name="newPassword"
                    className="form-control form-control-sm"
                    required
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="confirmPassword" className="form-label form-label-sm">Confirmar Nova Senha</label>
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    className="form-control form-control-sm"
                    required
                  />
                </div>
                <div className="d-flex justify-content-end">
                    <PasswordSubmitButton />
                </div>
              </form>
            </div>
             <div className="card-footer text-muted small">
                Você será desconectado de outras sessões ao alterar sua senha.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
