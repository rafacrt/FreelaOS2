
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Client } from '@/lib/types';
import { useOSStore } from '@/store/os-store';
import { AlertCircle } from 'lucide-react';

const clientSchema = z.object({
  name: z.string().min(1, { message: 'Nome do cliente é obrigatório.' }),
});

type ClientFormValues = z.infer<typeof clientSchema>;

interface AddEditClientModalProps {
  client?: Client | null; // Client to edit, or null/undefined to add
  isOpen: boolean;
  onClose: () => void;
}

export default function AddEditClientModal({ client, isOpen, onClose }: AddEditClientModalProps) {
  const addClientStore = useOSStore((state) => state.addClient);
  const updateClientStore = useOSStore((state) => state.updateClient);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const [bootstrapModal, setBootstrapModal] = useState<any>(null);

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: '',
    },
    mode: 'onChange',
  });

  const resetFormAndErrors = () => {
    form.reset({ name: client?.name || '' });
    setServerError(null);
  };

  useEffect(() => {
    if (isOpen) {
      resetFormAndErrors();
       if (client) {
         form.setValue('name', client.name);
       }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, isOpen]);

  useEffect(() => {
    if (typeof window !== 'undefined' && modalRef.current) {
      import('bootstrap/js/dist/modal').then((ModalModule) => {
        const Modal = ModalModule.default;
        if (modalRef.current) {
          const modalInstance = new Modal(modalRef.current);
          setBootstrapModal(modalInstance);

          const handleHide = () => {
             if (isOpen) { 
                onClose();
             }
          };
          modalRef.current.addEventListener('hidden.bs.modal', handleHide);

          return () => {
            if (modalRef.current) {
                modalRef.current.removeEventListener('hidden.bs.modal', handleHide);
            }
             if (modalInstance && typeof modalInstance.dispose === 'function') { // Check if dispose exists
                try {
                    if ((modalInstance as any)._isShown) { // Check if shown before hiding
                         modalInstance.hide();
                    }
                     modalInstance.dispose();
                } catch (e) {
                     console.warn("Error disposing Bootstrap modal:", e);
                }
             }
          };
        }
      }).catch(err => console.error("Failed to load Bootstrap modal:", err));
    }
     return () => {
       if (bootstrapModal && typeof bootstrapModal.dispose === 'function') {
            try {
                if ((bootstrapModal as any)._isShown) {
                     bootstrapModal.hide();
                }
                 bootstrapModal.dispose();
            } catch (error) {
                console.warn("Error disposing Bootstrap modal on cleanup:", error);
            }
        }
     };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]); // Re-initialize if isOpen changes, to handle dynamic import on modal opening

  useEffect(() => {
    if (bootstrapModal) {
      if (isOpen) {
        if (!(bootstrapModal as any)._isShown) { 
             bootstrapModal.show();
        }
      } else {
         if ((bootstrapModal as any)._isShown) { 
             bootstrapModal.hide();
         }
      }
    }
  }, [isOpen, bootstrapModal]);

  const onSubmit = async (values: ClientFormValues) => {
    setIsSubmitting(true);
    setServerError(null);
    try {
      if (client) {
        await updateClientStore({ ...client, name: values.name });
        console.log(`Cliente "${values.name}" atualizado.`);
      } else {
        await addClientStore({ name: values.name });
        console.log(`Cliente "${values.name}" adicionado.`);
      }
      onClose(); 
    } catch (error: any) {
      console.error('Failed to save client:', error);
      setServerError(error.message || 'Falha ao salvar cliente. Por favor, tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleActualClose = () => {
     onClose(); 
  };


  return (
    <div
      className="modal fade"
      id="clientModal"
      tabIndex={-1}
      aria-labelledby="clientModalLabel"
      aria-hidden={!isOpen} 
      ref={modalRef}
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <div className="modal-header">
              <h5 className="modal-title" id="clientModalLabel">
                {client ? 'Editar Cliente' : 'Adicionar Novo Cliente'}
              </h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={handleActualClose}></button>
            </div>
            <div className="modal-body">
              {serverError && (
                <div className="alert alert-danger d-flex align-items-center p-2 mb-3">
                  <AlertCircle size={18} className="me-2 flex-shrink-0" />
                  <small>{serverError}</small>
                </div>
              )}
              <div className="mb-3">
                <label htmlFor="clientName" className="form-label">Nome do Cliente *</label>
                <input
                  type="text"
                  id="clientName"
                  className={`form-control ${form.formState.errors.name ? 'is-invalid' : ''}`}
                  placeholder="Ex: Empresa Fantástica S.A."
                  {...form.register('name')}
                />
                {form.formState.errors.name && (
                  <div className="invalid-feedback">{form.formState.errors.name.message}</div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={handleActualClose} disabled={isSubmitting}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={!form.formState.isValid || isSubmitting}>
                {isSubmitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Salvando...
                  </>
                ) : (client ? 'Salvar Alterações' : 'Adicionar Cliente')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}


    