
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

  const { register, handleSubmit, formState: { errors, isValid, isDirty }, reset } = useForm<CreatePartnerFormValues | EditPartnerFormValues>({
    resolver: zodResolver(currentSchema),
    defaultValues: {
      name: '',
      username: '',
      email: '',
      contact_person: '',
      is_approved: false,
      ...(!partner && { password: '', confirmPassword: '' }),
    },
    mode: 'onChange',
  });
  
  useEffect(() => {
    if (isOpen) {
      reset({
        name: partner?.name || '',
        username: partner?.username || '',
        email: partner?.email || '',
        contact_person: partner?.contact_person || '',
        is_approved: partner?.is_approved || false,
        ...(!partner && { password: '', confirmPassword: '' }),
      });
      setServerError(null);
    }
  }, [isOpen, partner, reset]);

  useEffect(() => {
    if (typeof window !== 'undefined' && modalRef.current) {
      import('bootstrap/js/dist/modal').then((ModalModule) => {
        const Modal = ModalModule.default;
        let modalInstance: any;
        if (modalRef.current) {
          modalInstance = Modal.getInstance(modalRef.current) || new Modal(modalRef.current);
          setBootstrapModal(modalInstance);
        }

        const handleHide = () => {
           if (isOpen) {
              onClose(); 
           }
        };
        
        if (modalRef.current && !(modalRef.current as any)._eventListenerAttached) {
            modalRef.current.addEventListener('hidden.bs.modal', handleHide);
            (modalRef.current as any)._eventListenerAttached = true;
        }
        
        return () => {
          if (modalRef.current && (modalRef.current as any)._eventListenerAttached) {
              modalRef.current.removeEventListener('hidden.bs.modal', handleHide);
              (modalRef.current as any)._eventListenerAttached = false;
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


  const onSubmit = async (values: CreatePartnerFormValues | EditPartnerFormValues) => {
    setIsSubmitting(true);
    setServerError(null);
    try {
      if (partner) {
        const updateData: UpdatePartnerDetailsData = {
          id: partner.id,
          name: values.name,
          username: (values as EditPartnerFormValues).username,
          email: (values as EditPartnerFormValues).email || undefined,
          contact_person: (values as EditPartnerFormValues).contact_person || undefined,
          is_approved: (values as EditPartnerFormValues).is_approved,
        };
        await updatePartnerEntity(updateData);
      } else {
        const createData: CreatePartnerData = {
          name: values.name,
          username: (values as CreatePartnerFormValues).username,
          email: (values as CreatePartnerFormValues).email || undefined,
          password: (values as CreatePartnerFormValues).password,
          contact_person: (values as CreatePartnerFormValues).contact_person || undefined,
          is_approved: (values as CreatePartnerFormValues).is_approved,
        };
        await addPartnerEntity(createData);
      }
      onClose();
    } catch (error: any) {
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
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
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
                    className={`form-control form-control-sm ${errors.name ? 'is-invalid' : ''}`}
                    placeholder="Ex: Agência Criativa Ltda."
                    {...register('name')}
                  />
                  {errors.name && (
                    <div className="invalid-feedback small">{errors.name.message}</div>
                  )}
                </div>
                 <div className="col-md-6">
                  <label htmlFor="partnerUsername" className="form-label form-label-sm">Usuário (para login) *</label>
                  <input
                    type="text"
                    id="partnerUsername"
                    className={`form-control form-control-sm ${errors.username ? 'is-invalid' : ''}`}
                    placeholder="Ex: agenciacriativa_user"
                    {...register('username')}
                  />
                  {errors.username && (
                    <div className="invalid-feedback small">{errors.username.message}</div>
                  )}
                </div>
                 <div className="col-md-6">
                  <label htmlFor="partnerEmail" className="form-label form-label-sm">Email</label>
                  <input
                    type="email"
                    id="partnerEmail"
                    className={`form-control form-control-sm ${errors.email ? 'is-invalid' : ''}`}
                    placeholder="Ex: contato@agenciacriativa.com"
                    {...register('email')}
                  />
                  {errors.email && (
                    <div className="invalid-feedback small">{errors.email.message}</div>
                  )}
                </div>
                 <div className="col-md-6">
                  <label htmlFor="partnerContactPerson" className="form-label form-label-sm">Pessoa de Contato</label>
                  <input
                    type="text"
                    id="partnerContactPerson"
                    className={`form-control form-control-sm ${errors.contact_person ? 'is-invalid' : ''}`}
                    placeholder="Ex: João Silva"
                    {...register('contact_person')}
                  />
                  {errors.contact_person && (
                    <div className="invalid-feedback small">{(errors.contact_person as any)?.message}</div>
                  )}
                </div>

                {!partner && (
                  <>
                    <div className="col-md-6">
                      <label htmlFor="partnerPassword" className="form-label form-label-sm">Senha *</label>
                      <input
                        type="password"
                        id="partnerPassword"
                        className={`form-control form-control-sm ${errors.password ? 'is-invalid' : ''}`}
                        placeholder="Crie uma senha segura"
                        {...register('password')}
                      />
                      {errors.password && (
                         <div className="invalid-feedback small">{(errors.password as any)?.message}</div>
                      )}
                    </div>
                    <div className="col-md-6">
                      <label htmlFor="partnerConfirmPassword" className="form-label form-label-sm">Confirmar Senha *</label>
                      <input
                        type="password"
                        id="partnerConfirmPassword"
                        className={`form-control form-control-sm ${errors.confirmPassword ? 'is-invalid' : ''}`}
                        placeholder="Repita a senha"
                        {...register('confirmPassword')}
                      />
                      {errors.confirmPassword && (
                        <div className="invalid-feedback small">{(errors.confirmPassword as any)?.message}</div>
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
                            {...register('is_approved')}
                        />
                        <label className="form-check-label form-check-label-sm" htmlFor="partnerIsApproved">
                            Aprovado para Login
                        </label>
                    </div>
                     {errors.is_approved && (
                        <div className="text-danger small mt-1">{(errors.is_approved as any)?.message}</div>
                     )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={handleActualClose} disabled={isSubmitting}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={!isDirty || !isValid || isSubmitting}>
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
    
