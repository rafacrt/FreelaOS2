
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { PlusCircle, Trash2, CheckSquare, Square } from 'lucide-react';
import { useSession } from '@/hooks/useSession';
import { useOSStore } from '@/store/os-store';
import { OSStatus, ALL_OS_STATUSES, type CreateOSData, type ChecklistItem as OSChecklistItem } from '@/lib/types'; // Renamed ChecklistItem to avoid conflict

const formSchema = z.object({
  cliente: z.string().min(1, { message: 'Nome do cliente é obrigatório.' }),
  parceiro: z.string().optional(),
  projeto: z.string().min(1, { message: 'Nome do projeto é obrigatório.' }),
  tarefa: z.string().min(1, { message: 'A descrição da tarefa é obrigatória.' }),
  observacoes: z.string().optional(),
  programadoPara: z.string().optional(),
  status: z.nativeEnum(OSStatus).default(OSStatus.NA_FILA),
  isUrgent: z.boolean().default(false),
});

type CreateOSFormValues = z.infer<typeof formSchema>;

export function CreateOSDialog() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const session = useSession();
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

  const [checklistActive, setChecklistActive] = useState(false);
  const [checklistItems, setChecklistItems] = useState<string[]>(['']);

  const form = useForm<CreateOSFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      cliente: '',
      parceiro: '',
      projeto: '',
      tarefa: '',
      observacoes: '',
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
    setChecklistActive(false);
    setChecklistItems(['']);
    setIsSubmitting(false);
  }, [form]);

  useEffect(() => {
    const currentModalElement = modalElementRef.current;
    if (!currentModalElement || typeof window === 'undefined') return;

    import('bootstrap/js/dist/modal').then(ModalModule => {
        const BootstrapModal = ModalModule.default;
        if (currentModalElement && !modalInstanceRef.current) {
            modalInstanceRef.current = new BootstrapModal(currentModalElement);
        }
        if (modalInstanceRef.current) {
             currentModalElement.addEventListener('hidden.bs.modal', resetFormAndStates);
        }
    }).catch(error => {});

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
    setClientInput(clientName);
    setShowClientSuggestions(false);
  };

  const handlePartnerSelect = (partnerName: string) => {
    form.setValue('parceiro', partnerName, { shouldValidate: true });
    setPartnerInput(partnerName);
    setShowPartnerSuggestions(false);
  };

  const handleShowModal = () => {
    resetFormAndStates(); 
    if (modalInstanceRef.current && typeof modalInstanceRef.current.show === 'function') {
        modalInstanceRef.current.show();
    } else {
    }
  };

  const handleAddChecklistItem = () => {
    setChecklistItems(prev => [...prev, '']);
    setTimeout(() => {
        const inputs = modalElementRef.current?.querySelectorAll<HTMLInputElement>('.checklist-item-input');
        if (inputs && inputs.length > 0) {
            inputs[inputs.length - 1].focus();
        }
    }, 0);
  };

  const handleChecklistItemChange = (index: number, value: string) => {
    setChecklistItems(prev => prev.map((item, i) => (i === index ? value : item)));
  };

  const handleRemoveChecklistItem = (index: number) => {
    setChecklistItems(prev => {
      const newItems = prev.filter((_, i) => i !== index);
      return newItems.length === 0 && checklistActive ? [''] : newItems;
    });
  };

  const handleChecklistKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAddChecklistItem();
    }
  };


  async function onSubmit(values: CreateOSFormValues) {
    if (!session || session.sessionType !== 'admin') {
      alert('Apenas administradores podem criar OS a partir deste diálogo.');
      return;
    }
    setIsSubmitting(true);
    try {
      const dataToSubmit: CreateOSData = {
        ...values,
        cliente: clientInput.trim(), 
        parceiro: partnerInput.trim() || undefined, 
        observacoes: values.observacoes || '',
        // tempoTrabalhado was removed from CreateOSData and formSchema implicitly
        programadoPara: values.programadoPara || undefined,
        checklistItems: checklistActive ? checklistItems.map(item => item.trim()).filter(item => item !== '') : undefined,
      };
      
      const creatorInfo = { name: session.username, type: 'admin' as const, id: session.id };
      await addOS(dataToSubmit, creatorInfo);
      
      if (modalInstanceRef.current && typeof modalInstanceRef.current.hide === 'function') {
        modalInstanceRef.current.hide(); 
      } else {
        resetFormAndStates(); 
      }
    } catch (error) {
      alert('Falha ao criar OS. Por favor, tente novamente.');
    } finally {
      // setIsSubmitting will be reset by resetFormAndStates when modal hides
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
            <div className="modal-body" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
              <p className="text-muted small mb-3">Preencha os detalhes abaixo para criar uma nova OS. Campos marcados com * são obrigatórios.</p>
              <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
                 <div className="row g-2 mb-2">
                    <div className="col-md-6">
                        <div className="mb-2 position-relative">
                          <label htmlFor="cliente" className="form-label form-label-sm">Nome do Cliente *</label>
                          <input
                            ref={clientInputRef}
                            type="text"
                            id="cliente"
                            placeholder="Ex: Empresa Acme"
                            className={`form-control form-control-sm ${form.formState.errors.cliente ? 'is-invalid' : ''}`}
                            {...form.register('cliente')}
                            value={clientInput} 
                            onChange={(e) => {
                                const val = e.target.value;
                                setClientInput(val); 
                                form.setValue('cliente', val, { shouldValidate: true });
                                setShowClientSuggestions(!!val && clients.filter(c => c.name.toLowerCase().includes(val.toLowerCase())).length > 0);
                            }}
                            onFocus={() => setShowClientSuggestions(!!clientInput && filteredClients.length > 0)}
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
                        <div className="mb-2 position-relative">
                          <label htmlFor="parceiro" className="form-label form-label-sm">Parceiro (opcional)</label>
                          <input
                            ref={partnerInputRef}
                            type="text"
                            id="parceiro"
                            placeholder="Ex: Agência XYZ"
                            className={`form-control form-control-sm ${form.formState.errors.parceiro ? 'is-invalid' : ''}`}
                            {...form.register('parceiro')} 
                            value={partnerInput} 
                             onChange={(e) => {
                                const val = e.target.value;
                                setPartnerInput(val); 
                                form.setValue('parceiro', val, { shouldValidate: true });
                                setShowPartnerSuggestions(!!val && partners.filter(p => p.name.toLowerCase().includes(val.toLowerCase())).length > 0);
                            }}
                            onFocus={() => setShowPartnerSuggestions(!!partnerInput && filteredPartners.length > 0)}
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

                <div className="mb-2">
                  <label htmlFor="projeto" className="form-label form-label-sm">Nome do Projeto *</label>
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

                <div className="mb-2">
                  <label htmlFor="tarefa" className="form-label form-label-sm">Tarefa Principal *</label>
                  <textarea
                    id="tarefa"
                    placeholder="Descreva a tarefa principal a ser realizada..."
                    className={`form-control form-control-sm ${form.formState.errors.tarefa ? 'is-invalid' : ''}`}
                    rows={2} 
                    {...form.register('tarefa')}
                  />
                  {form.formState.errors.tarefa && (
                    <div className="invalid-feedback small">{form.formState.errors.tarefa.message}</div>
                  )}
                </div>
                
                <div className="mb-2">
                    <button 
                        type="button" 
                        className="btn btn-sm btn-outline-secondary mb-2" 
                        onClick={() => {
                            setChecklistActive(!checklistActive);
                            if (!checklistActive && checklistItems.length === 0) {
                                setChecklistItems(['']);
                            }
                        }}
                    >
                        {checklistActive ? <Square size={14} className="me-1"/> : <CheckSquare size={14} className="me-1"/>}
                        {checklistActive ? 'Remover Checklist' : 'Adicionar Checklist'}
                    </button>

                    {checklistActive && (
                        <div className="p-2 border rounded bg-light-subtle">
                            <label className="form-label form-label-sm d-block mb-1">Itens do Checklist:</label>
                            {checklistItems.map((item, index) => (
                                <div key={index} className="input-group input-group-sm mb-1">
                                <input
                                    type="text"
                                    className="form-control form-control-sm checklist-item-input"
                                    placeholder={`Item ${index + 1}`}
                                    value={item}
                                    onChange={(e) => handleChecklistItemChange(index, e.target.value)}
                                    onKeyDown={(e) => handleChecklistKeyDown(index, e)}
                                />
                                <button 
                                    className="btn btn-outline-danger btn-sm" 
                                    type="button" 
                                    onClick={() => handleRemoveChecklistItem(index)}
                                    title="Remover item"
                                    disabled={checklistItems.length === 1 && item.trim() === ''}
                                >
                                    <Trash2 size={14} />
                                </button>
                                </div>
                            ))}
                            <button 
                                type="button" 
                                className="btn btn-sm btn-success mt-1" 
                                onClick={handleAddChecklistItem}
                            >
                                <PlusCircle size={14} className="me-1"/> Adicionar Item
                            </button>
                        </div>
                    )}
                </div>

                <div className="mb-2">
                  <label htmlFor="observacoes" className="form-label form-label-sm">Observações</label>
                  <textarea
                    id="observacoes"
                    placeholder="Notas adicionais, detalhes importantes..."
                    className={`form-control form-control-sm ${form.formState.errors.observacoes ? 'is-invalid' : ''}`}
                    rows={2} 
                    {...form.register('observacoes')}
                  />
                   {form.formState.errors.observacoes && (
                    <div className="invalid-feedback small">{form.formState.errors.observacoes.message}</div>
                  )}
                </div>

                <div className="row g-2">
                    <div className="col-md-6">
                        <div className="mb-2">
                          <label htmlFor="status" className="form-label form-label-sm">Status Inicial</label>
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
                        <div className="mb-2">
                            <label htmlFor="programadoPara" className="form-label form-label-sm">Programado Para</label>
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
