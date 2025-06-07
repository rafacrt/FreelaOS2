
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Partner } from '@/store/os-store';
import { useOSStore } from '@/store/os-store';

// Schema inicial, será expandido
const partnerSchema = z.object({
  name: z.string().min(1, { message: 'Nome do parceiro é obrigatório.' }),
  // Campos adicionais (username, email, password, etc.) serão adicionados depois
});

type PartnerFormValues = z.infer<typeof partnerSchema>;

interface AddEditPartnerModalProps {
  partner?: Partner | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function AddEditPartnerModal({ partner, isOpen, onClose }: AddEditPartnerModalProps) {
  const addPartner = useOSStore((state) => state.addPartnerEntity);
  const updatePartner = useOSStore((state) => state.updatePartnerEntity);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const [bootstrapModal, setBootstrapModal] = useState<any>(null);

  const form = useForm<PartnerFormValues>({
    resolver: zodResolver(partnerSchema),
    defaultValues: {
      name: '',
    },
    mode: 'onChange',
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({ name: partner?.name || '' });
    } else {
      form.reset({ name: '' });
    }
  }, [partner, isOpen, form.reset]);

  useEffect(() => {
    if (typeof window !== 'undefined' && modalRef.current) {
      const ModalModule = require('bootstrap/js/dist/modal');
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
           if (modalInstance && (modalInstance as any)._isShown) {
              try {
                  modalInstance.dispose();
              } catch (e) {
                   console.warn("Error disposing Bootstrap modal:", e);
              }
           }
        };
      }
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
  }, []); 

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

  const onSubmit = async (values: PartnerFormValues) => {
    setIsSubmitting(true);
    try {
      if (partner) {
        // Atualizar parceiro - expandir quando actions estiverem prontas
        await updatePartner({ ...partner, name: values.name });
        console.log(`Parceiro "${values.name}" (ID: ${partner.id}) atualizado localmente.`);
      } else {
        // Adicionar novo parceiro - expandir para incluir todos os campos
        const newPartnerData: Omit<Partner, 'id'> = { // Tipagem para os dados de criação
            name: values.name,
            // Valores padrão ou vazios para outros campos que serão adicionados ao form
            username: undefined, 
            email: undefined,
            contact_person: undefined,
            is_approved: false, // Default para não aprovado
        };
        await addPartner(newPartnerData);
        console.log(`Parceiro "${values.name}" adicionado localmente.`);
      }
      onClose();
    } catch (error) {
      console.error('Falha ao salvar parceiro:', error);
      alert('Falha ao salvar parceiro. Por favor, tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleActualClose = () => {
     form.reset({ name: '' });
     onClose();
  };

  return (
    <div
      className="modal fade"
      id="partnerModal"
      tabIndex={-1}
      aria-labelledby="partnerModalLabel"
      aria-hidden={!isOpen}
      ref={modalRef}
    >
      <div className="modal-dialog modal-dialog-centered modal-lg"> {/* modal-lg para mais espaço */}
        <div className="modal-content">
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <div className="modal-header">
              <h5 className="modal-title" id="partnerModalLabel">
                {partner ? 'Editar Parceiro' : 'Adicionar Novo Parceiro'}
              </h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={handleActualClose}></button>
            </div>
            <div className="modal-body">
              {/* Nome do Parceiro */}
              <div className="mb-3">
                <label htmlFor="partnerName" className="form-label">Nome do Parceiro *</label>
                <input
                  type="text"
                  id="partnerName"
                  className={`form-control ${form.formState.errors.name ? 'is-invalid' : ''}`}
                  placeholder="Ex: Agência Criativa Ltda."
                  {...form.register('name')}
                />
                {form.formState.errors.name && (
                  <div className="invalid-feedback">{form.formState.errors.name.message}</div>
                )}
              </div>

              {/* MAIS CAMPOS SERÃO ADICIONADOS AQUI NA PRÓXIMA ETAPA */}
              {/* Username, Email, Senha (para criação), Contato, Aprovação */}
              
              <p className="text-muted small">
                Detalhes adicionais como informações de login e contato serão configuráveis aqui em breve.
              </p>

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
                ) : (partner ? 'Salvar Alterações' : 'Adicionar Parceiro')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
