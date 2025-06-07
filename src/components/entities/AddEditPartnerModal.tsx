
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Partner } from '@/store/os-store';
import { useOSStore } from '@/store/os-store';
import type { CreatePartnerData, UpdatePartnerDetailsData } from '@/lib/actions/partner-actions';
import { AlertCircle } from 'lucide-react';

const strongPasswordSchema = z.string()
  .min(6, { message: "Senha deve ter no mínimo 6 caracteres." })
  // .regex(/[a-z]/, { message: "Senha deve conter ao menos uma letra minúscula." })
  // .regex(/[A-Z]/, { message: "Senha deve conter ao menos uma letra maiúscula." })
  // .regex(/[0-9]/, { message: "Senha deve conter ao menos um número." })
  // .regex(/[^a-zA-Z0-9]/, { message: "Senha deve conter ao menos um caractere especial." });


const createPartnerSchema = z.object({
  name: z.string().min(1, { message: 'Nome do parceiro é obrigatório.' }),
  username: z.string().min(3, { message: 'Nome de usuário é obrigatório (mín. 3 caracteres).' }).regex(/^[a-zA-Z0-9_]+$/, { message: 'Nome de usuário pode conter apenas letras, números e underscore (_).' }),
  email: z.string().email({ message: 'Email inválido.' }).optional().or(z.literal('')),
  password: strongPasswordSchema,
  confirmPassword: strongPasswordSchema,
  contact_person: z.string().optional(),
  is_approved: z.boolean().default(false),
}).refine(data => data.password === data.confirmPassword, {
  message: "As senhas não coincidem.",
  path: ["confirmPassword"], // path of error
});

const editPartnerSchema = z.object({
    name: z.string().min(1, { message: 'Nome do parceiro é obrigatório.' }),
    username: z.string().min(3, { message: 'Nome de usuário é obrigatório (mín. 3 caracteres).' }).regex(/^[a-zA-Z0-9_]+$/, { message: 'Nome de usuário pode conter apenas letras, números e underscore (_).' }),
    email: z.string().email({ message: 'Email inválido.' }).optional().or(z.literal('')),
    contact_person: z.string().optional(),
    is_approved: z.boolean().default(false),
});


type CreatePartnerFormValues = z.infer<typeof createPartnerSchema>;
type EditPartnerFormValues = z.infer<typeof editPartnerSchema>;

interface AddEditPartnerModalProps {
  partner?: Partner | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function AddEditPartnerModal({ partner, isOpen, onClose }: AddEditPartnerModalProps) {
  const addPartnerEntity = useOSStore((state) => state.addPartnerEntity);
  const updatePartnerEntity = useOSStore((state) => state.updatePartnerEntity);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const [bootstrapModal, setBootstrapModal] = useState<any>(null);

  const currentSchema = partner ? editPartnerSchema : createPartnerSchema;

  const form = useForm<CreatePartnerFormValues | EditPartnerFormValues>({
    resolver: zodResolver(currentSchema),
    defaultValues: {
      name: '',
      username: '',
      email: '',
      contact_person: '',
      is_approved: false,
      ...(partner ? {} : { password: '', confirmPassword: '' }), // Only add password fields for create mode
    },
    mode: 'onChange',
  });

  const resetFormAndErrors = () => {
    form.reset({
      name: partner?.name || '',
      username: partner?.username || '',
      email: partner?.email || '',
      contact_person: partner?.contact_person || '',
      is_approved: partner?.is_approved || false,
      ...(partner ? {} : { password: '', confirmPassword: '' }),
    });
    setServerError(null);
  };
  
  useEffect(() => {
    if (isOpen) {
        resetFormAndErrors(); // Reset with potentially new partner data
        if (partner) {
             form.setValue('name', partner.name);
             form.setValue('username', partner.username || '');
             form.setValue('email', partner.email || '');
             form.setValue('contact_person', partner.contact_person || '');
             form.setValue('is_approved', partner.is_approved || false);
        }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partner, isOpen]);

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

  const onSubmit = async (values: CreatePartnerFormValues | EditPartnerFormValues) => {
    setIsSubmitting(true);
    setServerError(null);
    try {
      if (partner) { // Editing existing partner
        const updateData: UpdatePartnerDetailsData = {
          id: partner.id,
          name: values.name,
          username: (values as EditPartnerFormValues).username,
          email: (values as EditPartnerFormValues).email || undefined,
          contact_person: (values as EditPartnerFormValues).contact_person || undefined,
          is_approved: (values as EditPartnerFormValues).is_approved,
        };
        await updatePartnerEntity(updateData);
        console.log(`Parceiro "${values.name}" (ID: ${partner.id}) atualizado.`);
      } else { // Adding new partner
        const createData: CreatePartnerData = {
          name: values.name,
          username: (values as CreatePartnerFormValues).username,
          email: (values as CreatePartnerFormValues).email || undefined,
          password: (values as CreatePartnerFormValues).password,
          contact_person: (values as CreatePartnerFormValues).contact_person || undefined,
          is_approved: (values as CreatePartnerFormValues).is_approved,
        };
        await addPartnerEntity(createData);
        console.log(`Parceiro "${values.name}" adicionado.`);
      }
      onClose();
    } catch (error: any) {
      console.error('Falha ao salvar parceiro:', error);
      setServerError(error.message || 'Falha ao salvar parceiro. Verifique os dados e tente novamente.');
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
      id="partnerModal"
      tabIndex={-1}
      aria-labelledby="partnerModalLabel"
      aria-hidden={!isOpen}
      ref={modalRef}
    >
      <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
        <div className="modal-content">
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <div className="modal-header">
              <h5 className="modal-title" id="partnerModalLabel">
                {partner ? 'Editar Parceiro' : 'Adicionar Novo Parceiro'}
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
              <div className="row g-3">
                <div className="col-md-6">
                  <label htmlFor="partnerName" className="form-label form-label-sm">Nome do Parceiro *</label>
                  <input
                    type="text"
                    id="partnerName"
                    className={`form-control form-control-sm ${form.formState.errors.name ? 'is-invalid' : ''}`}
                    placeholder="Ex: Agência Criativa Ltda."
                    {...form.register('name')}
                  />
                  {form.formState.errors.name && (
                    <div className="invalid-feedback small">{form.formState.errors.name.message}</div>
                  )}
                </div>
                 <div className="col-md-6">
                  <label htmlFor="partnerUsername" className="form-label form-label-sm">Usuário (para login) *</label>
                  <input
                    type="text"
                    id="partnerUsername"
                    className={`form-control form-control-sm ${form.formState.errors.username ? 'is-invalid' : ''}`}
                    placeholder="Ex: agenciacriativa_user"
                    {...form.register('username')}
                  />
                  {form.formState.errors.username && (
                    <div className="invalid-feedback small">{form.formState.errors.username.message}</div>
                  )}
                </div>
                 <div className="col-md-6">
                  <label htmlFor="partnerEmail" className="form-label form-label-sm">Email</label>
                  <input
                    type="email"
                    id="partnerEmail"
                    className={`form-control form-control-sm ${form.formState.errors.email ? 'is-invalid' : ''}`}
                    placeholder="Ex: contato@agenciacriativa.com"
                    {...form.register('email')}
                  />
                  {form.formState.errors.email && (
                    <div className="invalid-feedback small">{form.formState.errors.email.message}</div>
                  )}
                </div>
                 <div className="col-md-6">
                  <label htmlFor="partnerContactPerson" className="form-label form-label-sm">Pessoa de Contato</label>
                  <input
                    type="text"
                    id="partnerContactPerson"
                    className={`form-control form-control-sm ${form.formState.errors.contact_person ? 'is-invalid' : ''}`}
                    placeholder="Ex: João Silva"
                    {...form.register('contact_person')}
                  />
                  {form.formState.errors.contact_person && (
                    <div className="invalid-feedback small">{form.formState.errors.contact_person.message}</div>
                  )}
                </div>

                {!partner && ( // Somente mostrar campos de senha ao criar novo parceiro
                  <>
                    <div className="col-md-6">
                      <label htmlFor="partnerPassword" className="form-label form-label-sm">Senha *</label>
                      <input
                        type="password"
                        id="partnerPassword"
                        className={`form-control form-control-sm ${form.formState.errors.password ? 'is-invalid' : ''}`}
                        placeholder="Crie uma senha segura"
                        {...form.register('password')}
                      />
                      {form.formState.errors.password && (
                        <div className="invalid-feedback small">{form.formState.errors.password.message}</div>
                      )}
                    </div>
                    <div className="col-md-6">
                      <label htmlFor="partnerConfirmPassword" className="form-label form-label-sm">Confirmar Senha *</label>
                      <input
                        type="password"
                        id="partnerConfirmPassword"
                        className={`form-control form-control-sm ${form.formState.errors.confirmPassword ? 'is-invalid' : ''}`}
                        placeholder="Repita a senha"
                        {...form.register('confirmPassword')}
                      />
                      {form.formState.errors.confirmPassword && (
                        <div className="invalid-feedback small">{form.formState.errors.confirmPassword.message}</div>
                      )}
                    </div>
                  </>
                )}
                <div className="col-12">
                    <div className="form-check form-switch mt-2">
                         <input
                            className="form-check-input"
                            type="checkbox"
                            id="partnerIsApproved"
                            role="switch"
                            {...form.register('is_approved')}
                        />
                        <label className="form-check-label form-check-label-sm" htmlFor="partnerIsApproved">
                            Aprovado para Login
                        </label>
                    </div>
                     {form.formState.errors.is_approved && (
                        <div className="text-danger small mt-1">{form.formState.errors.is_approved.message}</div>
                     )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={handleActualClose} disabled={isSubmitting}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={!form.formState.isDirty || !form.formState.isValid || isSubmitting}>
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
      

    