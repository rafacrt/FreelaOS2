
// src/app/partner/create-os/page.tsx
'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import { useOSStore } from '@/store/os-store';
import type { CreateOSData, Client, ChecklistItem as OSChecklistItem } from '@/lib/types';
import { OSStatus } from '@/lib/types'; // Removed ALL_OS_STATUSES as it's not used directly here
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { ArrowLeft, PlusCircle, Save, Trash2, CheckSquare, Square } from 'lucide-react';

const partnerFormSchema = z.object({
  cliente: z.string().min(1, { message: 'Nome do cliente é obrigatório.' }),
  projeto: z.string().min(1, { message: 'Nome do projeto é obrigatório.' }),
  tarefa: z.string().min(1, { message: 'A descrição da tarefa é obrigatória.' }),
  observacoes: z.string().optional(),
  programadoPara: z.string().optional().refine(val => !val || !isNaN(Date.parse(val)), {
    message: "Data inválida. Use o formato AAAA-MM-DD.",
  }),
  isUrgent: z.boolean().default(false),
});

type PartnerCreateOSFormValues = z.infer<typeof partnerFormSchema>;

export default function PartnerCreateOSPage() {
  const router = useRouter();
  const session = useSession();
  const { addOS, clients, isStoreInitialized, initializeStore } = useOSStore((state) => ({
    addOS: state.addOS,
    clients: state.clients,
    isStoreInitialized: state.isStoreInitialized,
    initializeStore: state.initializeStore,
  }));

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientInput, setClientInput] = useState('');
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const clientInputRef = useRef<HTMLInputElement>(null);
  const clientSuggestionsRef = useRef<HTMLDivElement>(null);

  const [checklistActive, setChecklistActive] = useState(false);
  const [checklistItems, setChecklistItems] = useState<string[]>(['']);

  const form = useForm<PartnerCreateOSFormValues>({
    resolver: zodResolver(partnerFormSchema),
    defaultValues: {
      cliente: '',
      projeto: '',
      tarefa: '',
      observacoes: '',
      programadoPara: '',
      isUrgent: false,
    },
    mode: 'onChange',
  });

  useEffect(() => {
    if (session && !isStoreInitialized) {
      initializeStore();
    }
  }, [session, isStoreInitialized, initializeStore]);

  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'cliente') {
        setClientInput(value.cliente ?? '');
      }
    });
    return () => subscription.unsubscribe();
  }, [form.watch]);


  const filteredClients = useMemo(() => {
    if (!clientInput) return [];
    const lowerInput = clientInput.toLowerCase();
    return clients.filter(c => c.name.toLowerCase().includes(lowerInput));
  }, [clientInput, clients]);

  const handleClientSelect = (clientName: string) => {
    form.setValue('cliente', clientName, { shouldValidate: true });
    setClientInput(clientName);
    setShowClientSuggestions(false);
  };

  const handleAddChecklistItem = () => {
    setChecklistItems(prev => [...prev, '']);
     setTimeout(() => {
        const inputs = document.querySelectorAll<HTMLInputElement>('.checklist-item-input-partner');
        if (inputs && inputs.length > 0) inputs[inputs.length - 1].focus();
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

  async function onSubmit(values: PartnerCreateOSFormValues) {
    if (!session || session.sessionType !== 'partner') {
      alert('Sessão de parceiro inválida. Por favor, faça login novamente.');
      router.push('/partner-login');
      return;
    }
    setIsSubmitting(true);
    try {
      const dataToSubmit: CreateOSData = {
        ...values,
        cliente: clientInput.trim(),
        status: OSStatus.AGUARDANDO_APROVACAO, 
        observacoes: values.observacoes || '',
        programadoPara: values.programadoPara || undefined,
        checklistItems: checklistActive ? checklistItems.map(item => item.trim()).filter(item => item !== '') : undefined,
      };
      
      const creatorInfo = { name: session.partnerName, type: 'partner' as const, id: session.id };
      const createdOS = await addOS(dataToSubmit, creatorInfo); 

      if (createdOS) {
        alert(`OS "${createdOS.projeto}" (Nº ${createdOS.numero}) criada com sucesso! Status: ${createdOS.status}.`);
        router.push('/partner/dashboard');
      } else {
        alert('Falha ao criar OS. Verifique os dados e tente novamente.');
      }
    } catch (error: any) {
      alert(`Falha ao criar OS: ${error.message || 'Erro desconhecido.'}`);
    } finally {
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

  useEffect(() => setupClickListener(clientInputRef, clientSuggestionsRef, setShowClientSuggestions), [clientInputRef, clientSuggestionsRef, setupClickListener]);


  if (!session || !isStoreInitialized) { // Wait for session and store
    return (
      <div className="d-flex justify-content-center align-items-center" style={{minHeight: '400px'}}>
        <div className="spinner-border text-primary" role="status" style={{width: '3rem', height: '3rem'}}>
          <span className="visually-hidden">Carregando...</span>
        </div>
      </div>
    );
  }


  return (
    <div className="container py-lg-4 py-3">
      <div className="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom">
        <h1 className="h3 mb-0">Criar Nova Ordem de Serviço</h1>
        <Link href="/partner/dashboard" className="btn btn-outline-secondary btn-sm">
          <ArrowLeft className="me-2" size={16} /> Voltar ao Painel
        </Link>
      </div>

      <div className="card shadow-sm">
        <div className="card-header bg-light-subtle">
          <p className="mb-0 small text-muted">Preencha os detalhes abaixo. Todas as OSs criadas por parceiros aguardam aprovação de um administrador.</p>
        </div>
        <div className="card-body p-lg-4 p-3">
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <div className="mb-3 position-relative">
              <label htmlFor="cliente" className="form-label">Nome do Cliente *</label>
              <input
                ref={clientInputRef}
                type="text"
                id="cliente"
                placeholder="Ex: Empresa de Teste LTDA (Pode ser um novo cliente)"
                className={`form-control ${form.formState.errors.cliente ? 'is-invalid' : ''}`}
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
                      onMouseDown={(e) => {e.preventDefault(); handleClientSelect(c.name);}}>
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
              {form.formState.errors.cliente && (
                <div className="invalid-feedback small">{form.formState.errors.cliente.message}</div>
              )}
            </div>

            <div className="mb-3">
              <label htmlFor="projeto" className="form-label">Nome do Projeto *</label>
              <input
                type="text"
                id="projeto"
                placeholder="Ex: Campanha de Marketing Digital de Final de Ano"
                className={`form-control ${form.formState.errors.projeto ? 'is-invalid' : ''}`}
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
                className={`form-control ${form.formState.errors.tarefa ? 'is-invalid' : ''}`}
                rows={3}
                {...form.register('tarefa')}
              />
              {form.formState.errors.tarefa && (
                <div className="invalid-feedback small">{form.formState.errors.tarefa.message}</div>
              )}
            </div>

            <div className="mb-3">
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
                                className="form-control form-control-sm checklist-item-input-partner"
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

            <div className="mb-3">
              <label htmlFor="observacoes" className="form-label">Observações Adicionais</label>
              <textarea
                id="observacoes"
                placeholder="Notas, detalhes importantes, informações de contato, etc."
                className={`form-control ${form.formState.errors.observacoes ? 'is-invalid' : ''}`}
                rows={2}
                {...form.register('observacoes')}
              />
              {form.formState.errors.observacoes && (
                <div className="invalid-feedback small">{form.formState.errors.observacoes.message}</div>
              )}
            </div>

            <div className="row">
                <div className="col-md-6 mb-3">
                    <label htmlFor="programadoPara" className="form-label">Programado Para (Opcional)</label>
                    <input
                        type="date"
                        id="programadoPara"
                        className={`form-control ${form.formState.errors.programadoPara ? 'is-invalid' : ''}`}
                        {...form.register('programadoPara')}
                    />
                    {form.formState.errors.programadoPara && (
                        <div className="invalid-feedback small">{form.formState.errors.programadoPara.message}</div>
                    )}
                    <div className="form-text small">
                        Data prevista para conclusão ou próxima etapa importante.
                    </div>
                </div>
                 <div className="col-md-6 mb-3 align-self-center">
                    <div className="form-check mt-md-3 pt-md-2">
                        <input
                            type="checkbox"
                            className="form-check-input"
                            id="isUrgent"
                            {...form.register('isUrgent')}
                        />
                        <label className="form-check-label" htmlFor="isUrgent">
                            Marcar como Urgente
                        </label>
                        <p className="text-muted small mt-1 mb-0">
                            Se marcado, será destacado para administradores após aprovação.
                        </p>
                    </div>
                </div>
            </div>


            <div className="mt-4 d-flex justify-content-end border-top pt-3">
              <Link href="/partner/dashboard" className="btn btn-outline-secondary me-2" passHref>
                Cancelar
              </Link>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting || !form.formState.isValid || !clientInput.trim()}>
                {isSubmitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Salvando OS...
                  </>
                ) : (
                  <>
                    <Save size={16} className="me-2" /> Salvar Ordem de Serviço
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
