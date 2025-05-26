
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { PlusCircle } from 'lucide-react';

import { useOSStore } from '@/store/os-store';
// import type { Partner } from '@/store/os-store'; // Not directly used, store handles types
// import type { Client } from '@/lib/types'; // Not directly used, store handles types
import { OSStatus, ALL_OS_STATUSES, type CreateOSData } from '@/lib/types';

const formSchema = z.object({
  cliente: z.string().min(1, { message: 'Nome do cliente é obrigatório.' }),
  parceiro: z.string().optional(),
  projeto: z.string().min(1, { message: 'Nome do projeto é obrigatório.' }),
  tarefa: z.string().min(1, { message: 'A descrição da tarefa é obrigatória.' }),
  observacoes: z.string().optional(),
  tempoTrabalhado: z.string().optional(), // This is for manual notes/time
  programadoPara: z.string().optional(),
  status: z.nativeEnum(OSStatus).default(OSStatus.NA_FILA),
  isUrgent: z.boolean().default(false),
});

type CreateOSFormValues = z.infer<typeof formSchema>;

export function CreateOSDialog() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addOS, partners, clients } = useOSStore((state) => ({
      addOS: state.addOS,
      partners: state.partners,
      clients: state.clients,
  }));
  const modalElementRef = useRef<HTMLDivElement>(null);
  const modalInstanceRef = useRef<any | null>(null);

  const [clientInput, setClientInput] = useState('');
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const clientInputRef = useRef<HTMLInputElement>(null);
  const clientSuggestionsRef = useRef<HTMLDivElement>(null);

  const [partnerInput, setPartnerInput] = useState('');
  const [showPartnerSuggestions, setShowPartnerSuggestions] = useState(false);
  const partnerInputRef = useRef<HTMLInputElement>(null);
  const partnerSuggestionsRef = useRef<HTMLDivElement>(null);


  const form = useForm<CreateOSFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      cliente: '',
      parceiro: '',
      projeto: '',
      tarefa: '',
      observacoes: '',
      tempoTrabalhado: '',
      programadoPara: '',
      status: OSStatus.NA_FILA,
      isUrgent: false,
    },
    mode: 'onChange',
  });

  const resetFormAndStates = useCallback(() => {
    form.reset();
    setClientInput('');
    setShowClientSuggestions(false);
    setPartnerInput('');
    setShowPartnerSuggestions(false);
    setIsSubmitting(false);
  }, [form]);

  useEffect(() => {
    const currentModalElement = modalElementRef.current;
    if (!currentModalElement || typeof window === 'undefined') return;

    import('bootstrap/js/dist/modal').then(ModalModule => {
        const BootstrapModal = ModalModule.default;
        if (currentModalElement && !modalInstanceRef.current) {
            modalInstanceRef.current = new BootstrapModal(currentModalElement);
            currentModalElement.addEventListener('hidden.bs.modal', resetFormAndStates);
        }
    }).catch(error => console.error("Failed to initialize Bootstrap modal:", error));

    return () => {
      if (currentModalElement) {
        currentModalElement.removeEventListener('hidden.bs.modal', resetFormAndStates);
      }
      if (modalInstanceRef.current && typeof modalInstanceRef.current.dispose === 'function') {
        try {
             if ((modalInstanceRef.current as any)._isShown) {
                 modalInstanceRef.current.hide();
             }
            modalInstanceRef.current.dispose();
        } catch (e) {
            console.warn("Error disposing modal instance on cleanup:", e);
        }
        modalInstanceRef.current = null;
      }
    };
  }, [resetFormAndStates]);

  const filteredClients = useMemo(() => {
    if (!clientInput) return [];
    const lowerInput = clientInput.toLowerCase();
    return clients.filter(c => c.name.toLowerCase().includes(lowerInput));
  }, [clientInput, clients]);

  const filteredPartners = useMemo(() => {
    if (!partnerInput) return [];
    const lowerInput = partnerInput.toLowerCase();
    return partners.filter(p => p.name.toLowerCase().includes(lowerInput));
  }, [partnerInput, partners]);

  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'cliente') {
        setClientInput(value.cliente ?? '');
      }
      if (name === 'parceiro') {
        setPartnerInput(value.parceiro ?? '');
      }
    });
    return () => subscription.unsubscribe();
  }, [form.watch]);


  const handleClientSelect = (clientName: string) => {
    form.setValue('cliente', clientName, { shouldValidate: true });
    setClientInput(clientName); // Sync controlled input
    setShowClientSuggestions(false);
    // clientInputRef.current?.focus(); // Avoid auto-focus issues
  };

  const handlePartnerSelect = (partnerName: string) => {
    form.setValue('parceiro', partnerName, { shouldValidate: true });
    setPartnerInput(partnerName); // Sync controlled input
    setShowPartnerSuggestions(false);
    // partnerInputRef.current?.focus(); // Avoid auto-focus issues
  };

  const handleShowModal = () => {
    if (modalInstanceRef.current && typeof modalInstanceRef.current.show === 'function') {
        modalInstanceRef.current.show();
    } else {
        console.warn('Modal instance not available to show.');
    }
  };

  async function onSubmit(values: CreateOSFormValues) {
    setIsSubmitting(true);
    try {
      const dataToSubmit: CreateOSData = {
        ...values,
        cliente: clientInput.trim(), // Use the state variable that's definitely up-to-date
        parceiro: partnerInput.trim() || undefined, // Use the state variable
        observacoes: values.observacoes || '',
        tempoTrabalhado: values.tempoTrabalhado || '',
        programadoPara: values.programadoPara || undefined,
      };
      console.log('[CreateOSDialog onSubmit] Data para addOS:', JSON.stringify(dataToSubmit, null, 2));
      await addOS(dataToSubmit);
      
      if (modalInstanceRef.current && typeof modalInstanceRef.current.hide === 'function') {
        modalInstanceRef.current.hide();
      } else {
        resetFormAndStates();
      }
    } catch (error) {
      console.error("[CreateOSDialog] Failed to create OS:", error);
      alert('Falha ao criar OS. Por favor, tente novamente.');
      setIsSubmitting(false);
    }
  }

  const setupClickListener = useCallback((
    inputRef: React.RefObject<HTMLInputElement>,
    suggestionBoxRef: React.RefObject<HTMLDivElement>,
    setShowSuggestions: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        inputRef.current && !inputRef.current.contains(event.target as Node) &&
        suggestionBoxRef.current && !suggestionBoxRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
     if (typeof document !== 'undefined') {
        document.addEventListener('mousedown', handleClickOutside);
     }
    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('mousedown', handleClickOutside);
      }
    };
  }, []);

  useEffect(() => setupClickListener(clientInputRef, clientSuggestionsRef, setShowClientSuggestions), [clientInputRef, clientSuggestionsRef, setupClickListener, setShowClientSuggestions]);
  useEffect(() => setupClickListener(partnerInputRef, partnerSuggestionsRef, setShowPartnerSuggestions), [partnerInputRef, partnerSuggestionsRef, setupClickListener, setShowPartnerSuggestions]);


  return (
    <>
      <button type="button" className="btn btn-primary" onClick={handleShowModal}>
        <PlusCircle className="me-2" size={18} /> Nova OS
      </button>

      <div className="modal fade" id="createOSModal" tabIndex={-1} aria-labelledby="createOSModalLabel" aria-hidden="true" ref={modalElementRef}>
        <div className="modal-dialog modal-dialog-scrollable modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="createOSModalLabel">Criar Nova Ordem de Serviço</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body">
              <p className="text-muted small mb-3">Preencha os detalhes abaixo para criar uma nova OS. Campos marcados com * são obrigatórios.</p>
              <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
                 <div className="row g-3">
                    <div className="col-md-6">
                        <div className="mb-3 position-relative">
                          <label htmlFor="cliente" className="form-label">Nome do Cliente *</label>
                          <input
                            ref={clientInputRef}
                            type="text"
                            id="cliente"
                            placeholder="Ex: Empresa Acme"
                            className={`form-control form-control-sm ${form.formState.errors.cliente ? 'is-invalid' : ''}`}
                            {...form.register('cliente')} // Still register for validation
                            value={clientInput} // Controlled by clientInput state
                            onChange={(e) => {
                                const val = e.target.value;
                                setClientInput(val); // Update controlled state
                                form.setValue('cliente', val, { shouldValidate: true }); // Update form state for validation
                                setShowClientSuggestions(!!val && clients.filter(c => c.name.toLowerCase().includes(val.toLowerCase())).length > 0);
                            }}
                            onFocus={() => setShowClientSuggestions(!!clientInput && filteredClients.length > 0)}
                            // onBlur removed to rely on document click away
                            autoComplete="off"
                          />
                          {showClientSuggestions && filteredClients.length > 0 && (
                            <div ref={clientSuggestionsRef} className="list-group position-absolute w-100 mt-1" style={{ zIndex: 1056, maxHeight: '150px', overflowY: 'auto', boxShadow: '0 .5rem 1rem rgba(0,0,0,.15)' }}>
                              {filteredClients.map(c => (
                                <button type="button" key={c.id} className="list-group-item list-group-item-action list-group-item-light py-1 px-2 small"
                                  onMouseDown={() => handleClientSelect(c.name)}>
                                  {c.name}
                                </button>
                              ))}
                            </div>
                          )}
                          {form.formState.errors.cliente && (
                            <div className="invalid-feedback small">{form.formState.errors.cliente.message}</div>
                          )}
                        </div>
                    </div>
                    <div className="col-md-6">
                        <div className="mb-3 position-relative">
                          <label htmlFor="parceiro" className="form-label">Parceiro (opcional)</label>
                          <input
                            ref={partnerInputRef}
                            type="text"
                            id="parceiro"
                            placeholder="Ex: Agência XYZ"
                            className={`form-control form-control-sm ${form.formState.errors.parceiro ? 'is-invalid' : ''}`}
                            {...form.register('parceiro')} // Still register for validation
                            value={partnerInput} // Controlled by partnerInput state
                             onChange={(e) => {
                                const val = e.target.value;
                                setPartnerInput(val); // Update controlled state
                                form.setValue('parceiro', val, { shouldValidate: true }); // Update form state for validation
                                setShowPartnerSuggestions(!!val && partners.filter(p => p.name.toLowerCase().includes(val.toLowerCase())).length > 0);
                            }}
                            onFocus={() => setShowPartnerSuggestions(!!partnerInput && filteredPartners.length > 0)}
                             // onBlur removed to rely on document click away
                            autoComplete="off"
                          />
                          {showPartnerSuggestions && filteredPartners.length > 0 && (
                            <div ref={partnerSuggestionsRef} className="list-group position-absolute w-100 mt-1" style={{ zIndex: 1056, maxHeight: '150px', overflowY: 'auto', boxShadow: '0 .5rem 1rem rgba(0,0,0,.15)' }}>
                              {filteredPartners.map(p => (
                                <button type="button" key={p.id} className="list-group-item list-group-item-action list-group-item-light py-1 px-2 small"
                                   onMouseDown={() => handlePartnerSelect(p.name)}>
                                  {p.name}
                                </button>
                              ))}
                            </div>
                          )}
                          {form.formState.errors.parceiro && (
                            <div className="invalid-feedback small">{form.formState.errors.parceiro.message}</div>
                          )}
                        </div>
                    </div>
                 </div>

                <div className="mb-3">
                  <label htmlFor="projeto" className="form-label">Nome do Projeto *</label>
                  <input
                    type="text"
                    id="projeto"
                    placeholder="Ex: Desenvolvimento de Website"
                    className={`form-control form-control-sm ${form.formState.errors.projeto ? 'is-invalid' : ''}`}
                    {...form.register('projeto')}
                  />
                  {form.formState.errors.projeto && (
                    <div className="invalid-feedback small">{form.formState.errors.projeto.message}</div>
                  )}
                </div>

                <div className="mb-3">
                  <label htmlFor="tarefa" className="form-label">Tarefa Principal *</label>
                  <textarea
                    id="tarefa"
                    placeholder="Descreva a tarefa principal a ser realizada..."
                    className={`form-control form-control-sm ${form.formState.errors.tarefa ? 'is-invalid' : ''}`}
                    rows={2} // Reduced rows
                    {...form.register('tarefa')}
                  />
                  {form.formState.errors.tarefa && (
                    <div className="invalid-feedback small">{form.formState.errors.tarefa.message}</div>
                  )}
                </div>

                <div className="mb-3">
                  <label htmlFor="observacoes" className="form-label">Observações</label>
                  <textarea
                    id="observacoes"
                    placeholder="Notas adicionais, detalhes importantes..."
                    className={`form-control form-control-sm ${form.formState.errors.observacoes ? 'is-invalid' : ''}`}
                    rows={2} // Reduced rows
                    {...form.register('observacoes')}
                  />
                   {form.formState.errors.observacoes && (
                    <div className="invalid-feedback small">{form.formState.errors.observacoes.message}</div>
                  )}
                </div>

                 <div className="mb-3">
                  <label htmlFor="tempoTrabalhado" className="form-label">Notas de Tempo (Manual)</label>
                  <input
                    type="text"
                    id="tempoTrabalhado"
                    placeholder="Ex: 2h reunião, 4h desenvolvimento"
                    className={`form-control form-control-sm ${form.formState.errors.tempoTrabalhado ? 'is-invalid' : ''}`}
                    {...form.register('tempoTrabalhado')}
                  />
                   <div className="form-text small">
                      Registre o tempo já dedicado ou sessões de trabalho (formato livre). O tempo do cronômetro é automático.
                    </div>
                  {form.formState.errors.tempoTrabalhado && (
                    <div className="invalid-feedback small">{form.formState.errors.tempoTrabalhado.message}</div>
                  )}
                </div>

                <div className="row g-3">
                    <div className="col-md-6">
                        <div className="mb-3">
                          <label htmlFor="status" className="form-label">Status Inicial</label>
                          <select
                            id="status"
                            className={`form-select form-select-sm ${form.formState.errors.status ? 'is-invalid' : ''}`}
                            defaultValue={OSStatus.NA_FILA}
                            {...form.register('status')}
                          >
                            {ALL_OS_STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                          {form.formState.errors.status && (
                            <div className="invalid-feedback small">{form.formState.errors.status.message}</div>
                          )}
                        </div>
                    </div>
                     <div className="col-md-6">
                        <div className="mb-3">
                            <label htmlFor="programadoPara" className="form-label">Programado Para</label>
                            <input
                                type="date"
                                id="programadoPara"
                                className={`form-control form-control-sm ${form.formState.errors.programadoPara ? 'is-invalid' : ''}`}
                                {...form.register('programadoPara')}
                            />
                            {form.formState.errors.programadoPara && (
                                <div className="invalid-feedback small">{form.formState.errors.programadoPara.message}</div>
                            )}
                             <div className="form-text small">
                                Data prevista para conclusão ou próxima etapa.
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mb-3 form-check">
                    <input
                        type="checkbox"
                        className="form-check-input"
                        id="isUrgent"
                        {...form.register('isUrgent')}
                    />
                    <label className="form-check-label small" htmlFor="isUrgent">
                        Marcar como Urgente
                    </label>
                     <p className="text-muted small mt-1 mb-0">
                        Tarefas urgentes serão destacadas.
                     </p>
                </div>

                <div className="modal-footer mt-3 pt-3 border-top">
                    <button type="button" className="btn btn-sm btn-outline-secondary" data-bs-dismiss="modal" disabled={isSubmitting}>
                        Cancelar
                    </button>
                    <button type="submit" className="btn btn-sm btn-primary" disabled={!form.formState.isValid || isSubmitting || !clientInput.trim()}>
                        {isSubmitting ? (
                            <>
                                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                Salvando...
                            </>
                        ) : 'Salvar OS'}
                    </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

    