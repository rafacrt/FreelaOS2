
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Client } from '@/lib/types';
import type { Partner } from '@/store/os-store';
import { useOSStore } from '@/store/os-store';
import { AlertCircle } from 'lucide-react';

const clientSchema = z.object({
  name: z.string().min(1, { message: 'Nome do cliente é obrigatório.' }),
  sourcePartnerId: z.string().nullable().optional(), // Pode ser string (ID do parceiro) ou null/undefined
});

type ClientFormValues = z.infer<typeof clientSchema>;

interface AddEditClientModalProps {
  client?: Client | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function AddEditClientModal({ client, isOpen, onClose }: AddEditClientModalProps) {
  const { addClient, updateClient, partners } = useOSStore((state) => ({
    addClient: state.addClient,
    updateClient: state.updateClient,
    partners: state.partners,
  }));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const [bootstrapModal, setBootstrapModal] = useState<any>(null);

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: '',
      sourcePartnerId: null, // Default to null
    },
    mode: 'onChange',
  });

  const resetFormAndErrors = () => {
    form.reset({ 
        name: client?.name || '',
        sourcePartnerId: client?.sourcePartnerId || null, // Ensure reset uses null for empty
    });
    setServerError(null);
  };

  useEffect(() => {
    if (isOpen) {
      resetFormAndErrors();
       // No need to call form.setValue here again if resetFormAndErrors covers it.
       // The form.reset call above should correctly set the initial values based on the client prop.
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, isOpen]);

  useEffect(() => {
    if (typeof window !== 'undefined' && modalRef.current) {
      import('bootstrap/js/dist/modal').then((ModalModule) => {
        const Modal = ModalModule.default;
        let modalInstance = Modal.getInstance(modalRef.current);
        if (!modalInstance) {
            modalInstance = new Modal(modalRef.current);
        }
        setBootstrapModal(modalInstance);

        const currentModalNode = modalRef.current;
        const handleHide = () => {
           if (isOpen) { 
              onClose();
           }
        };
        
        if (currentModalNode && !(currentModalNode as any)._eventListenerAttached) {
            currentModalNode.addEventListener('hidden.bs.modal', handleHide);
            (currentModalNode as any)._eventListenerAttached = true;
        }
        
        return () => {
          if (currentModalNode && (currentModalNode as any)._eventListenerAttached) {
              currentModalNode.removeEventListener('hidden.bs.modal', handleHide);
              (currentModalNode as any)._eventListenerAttached = false;
          }
        };
      }).catch(err => console.error("Failed to load Bootstrap modal:", err));
    }
  }, [isOpen, onClose]);

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

  useEffect(() => {
    return () => {
      if (bootstrapModal && typeof bootstrapModal.dispose === 'function') {
        try {
            if ((bootstrapModal as any)._isShown) {
                bootstrapModal.hide();
            }
            bootstrapModal.dispose();
        } catch (error) {
            console.warn("Error disposing Bootstrap modal on component unmount:", error);
        }
      }
    };
  }, [bootstrapModal]);

  const onSubmit = async (values: ClientFormValues) => {
    setIsSubmitting(true);
    setServerError(null);
    try {
      const dataToSave = {
        name: values.name,
        // Ensure sourcePartnerId is null if the "Nenhum" (empty string) option was selected.
        sourcePartnerId: values.sourcePartnerId === "" ? null : values.sourcePartnerId,
      };

      if (client) {
        await updateClient({ 
            ...client, 
            name: dataToSave.name, 
            sourcePartnerId: dataToSave.sourcePartnerId 
        });
        console.log(`Cliente "${dataToSave.name}" atualizado.`);
      } else {
        await addClient({ 
            name: dataToSave.name, 
            sourcePartnerId: dataToSave.sourcePartnerId 
        });
        console.log(`Cliente "${dataToSave.name}" adicionado.`);
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
              <div className="mb-3">
                <label htmlFor="sourcePartnerId" className="form-label">Parceiro de Origem (Opcional)</label>
                <select
                  id="sourcePartnerId"
                  className={`form-select ${form.formState.errors.sourcePartnerId ? 'is-invalid' : ''}`}
                  {...form.register('sourcePartnerId')}
                  // Use form.watch to get the current value for the select if needed, or rely on register
                  // DefaultValue should be handled by form.reset and defaultValues in useForm
                >
                  <option value="">Nenhum</option> {/* value is empty string for "None" */}
                  {partners.sort((a,b) => a.name.localeCompare(b.name)).map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {form.formState.errors.sourcePartnerId && (
                  <div className="invalid-feedback">{form.formState.errors.sourcePartnerId.message}</div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={handleActualClose} disabled={isSubmitting}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={!form.formState.isDirty || !form.formState.isValid || isSubmitting}>
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
    