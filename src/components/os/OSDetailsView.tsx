
'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { OS, ChecklistItem } from '@/lib/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft, CalendarClock, CheckCircle2, FileText, Flag, Server, User as UserIconLucide,
    Users, Briefcase, MessageSquare, Clock3, Save, Edit, Calendar as CalendarIcon, Printer,
    CheckSquare as CheckSquareIcon, Square, Play, Pause, RotateCcw, UploadCloud, Paperclip, AlertTriangle, Clock,
    PlusCircle, Trash2
} from 'lucide-react';
import { format, parseISO, isValid, differenceInSeconds, formatDistanceStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useOSStore } from '@/store/os-store';
import { OSStatus, ALL_OS_STATUSES } from '@/lib/types';
import ChronometerDisplay from './ChronometerDisplay';

// Helper to get background and text color classes based on status
const getStatusHeaderClasses = (status: OSStatus, isEditing: boolean): string => {
  if (isEditing) return 'bg-light text-dark'; // Neutral when editing
  switch (status) {
    case OSStatus.NA_FILA: return 'bg-secondary-subtle text-secondary-emphasis';
    case OSStatus.AGUARDANDO_CLIENTE: return 'bg-warning-subtle text-warning-emphasis';
    case OSStatus.EM_PRODUCAO: return 'bg-info-subtle text-info-emphasis';
    case OSStatus.AGUARDANDO_PARCEIRO: return 'bg-primary-subtle text-primary-emphasis';
    case OSStatus.FINALIZADO: return 'bg-success-subtle text-success-emphasis';
    default: return 'bg-light text-dark';
  }
};

const getStatusIcon = (status: OSStatus) => {
  switch (status) {
    case OSStatus.NA_FILA: return <Clock size={16} className="me-2" />;
    case OSStatus.AGUARDANDO_CLIENTE: return <UserIconLucide size={16} className="me-2" />;
    case OSStatus.EM_PRODUCAO: return <Server size={16} className="me-2" />;
    case OSStatus.AGUARDANDO_PARCEIRO: return <Users size={16} className="me-2" />;
    case OSStatus.FINALIZADO: return <CheckCircle2 size={16} className="me-2" />;
    default: return <FileText size={16} className="me-2" />;
  }
};

interface DetailItemProps {
  label: string;
  value?: string | null | boolean | number | React.ReactNode;
  icon?: React.ReactNode;
  name?: keyof OS | string; // Allow string for custom field names like checklist
  isEditableField: boolean;
  children?: React.ReactNode;
  className?: string;
  isEditingMode: boolean;
}

const DetailItem = ({ label, value, icon, name, isEditableField, children, className, isEditingMode }: DetailItemProps) => {
  let displayValue: string | React.ReactNode = value;

  if (name === 'programadoPara' && typeof value === 'string' && value) {
    try {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseISO(value + 'T00:00:00Z') : parseISO(value);
      if (isValidDate(date)) {
        displayValue = format(date, "dd/MM/yyyy", { locale: ptBR });
      }
    } catch { /* fallback to original value */ }
  } else if ((name === 'dataAbertura' || name === 'dataFinalizacao' || name === 'dataInicioProducao' || name === 'dataInicioProducaoAtual') && typeof value === 'string' && value) {
    try {
      const date = parseISO(value);
      if (isValidDate(date)) {
        displayValue = format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
      }
    } catch { /* fallback to original value */ }
  } else if (typeof value === 'boolean') {
    displayValue = value ? 'Sim' : 'Não';
  }

  const valueIsReactNode = React.isValidElement(displayValue);

  return (
    <div className={`row py-2 ${className || ''}`}>
      <dt className="col-sm-4 col-lg-3 text-muted d-flex align-items-center small fw-medium">{icon}{label}</dt>
      <dd className="col-sm-8 col-lg-9 mb-0">
        {isEditingMode && isEditableField ? (
          children
        ) : (
          valueIsReactNode ? displayValue : (
            <span className={`form-control-plaintext p-0 text-break small ${name === 'observacoes' || name === 'tarefa' || name === 'tempoTrabalhado' || name === 'checklist' ? 'text-pre-wrap' : ''}`}>
              {displayValue === undefined || displayValue === null || (typeof displayValue === 'string' && displayValue.trim() === '') ? (
                <span className="text-muted fst-italic">N/A</span>
              ) : (
                displayValue
              )}
            </span>
          )
        )}
      </dd>
    </div>
  );
};


// Helper to validate if a date object is valid
function isValidDate(d: any): d is Date {
    return d instanceof Date && !isNaN(d.getTime());
}

const formatDateForDetailsSection = (dateString?: string | null): string | React.ReactNode => {
    if (!dateString) return <span className="text-muted fst-italic">N/D</span>;
    try {
        const date = parseISO(dateString);
        if (isValidDate(date)) {
            return format(date, "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR });
        }
    } catch (e) { /* fallback */ }
    return <span className="text-muted fst-italic">Data inválida</span>;
};

const CurrentSessionDuration: React.FC<{ startTimeISO: string | null | undefined }> = ({ startTimeISO }) => {
    const [duration, setDuration] = useState<string>('0s');

    useEffect(() => {
        let intervalId: NodeJS.Timeout | undefined;
        if (startTimeISO) {
            const startDate = parseISO(startTimeISO);
            if (isValidDate(startDate)) {
                const updateDuration = () => {
                    const now = new Date();
                    const seconds = differenceInSeconds(now, startDate);
                    setDuration(formatDistanceStrict(now, startDate, { locale: ptBR, unit: seconds < 60 ? 's' : (seconds < 3600 ? 'm' : 'h'), addSuffix: false }) || '0s');
                };
                updateDuration();
                intervalId = setInterval(updateDuration, 1000);
            } else {
                setDuration('Início inválido');
            }
        } else {
            setDuration('0s');
        }
        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [startTimeISO]);

    return <span>{duration}</span>;
};


interface OSDetailsViewProps {
  initialOs: OS;
}

export default function OSDetailsView({ initialOs }: OSDetailsViewProps) {
  const { updateOS, updateOSStatus, partners, clients, toggleProductionTimer } = useOSStore();
  const router = useRouter();

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const formatProgramadoParaForInput = useCallback((isoDate?: string) => {
    if (!isoDate) return '';
    try {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(isoDate) ? parseISO(isoDate + 'T00:00:00Z') : parseISO(isoDate);
      return isValidDate(date) ? format(date, 'yyyy-MM-dd') : '';
    } catch {
      return '';
    }
  }, []);

  const [formData, setFormData] = useState<OS>({
    ...initialOs,
    programadoPara: formatProgramadoParaForInput(initialOs.programadoPara),
    checklist: initialOs.checklist ? [...initialOs.checklist.map(item => ({...item}))] : [],
  });

  // Log para depuração do estado do cronômetro e dos botões
  console.log("[OSDetailsView Render] initialOs:", initialOs);
  console.log("[OSDetailsView Render] formData:", formData);


  useEffect(() => {
    console.log("[OSDetailsView Effect] initialOs ID or isEditing changed. Current initialOs ID:", initialOs.id, "Current isEditing:", isEditing);
    if (!isEditing) {
      console.log("[OSDetailsView Effect] Syncing formData with initialOs because not editing or OS ID changed.");
      setFormData({
        ...initialOs,
        programadoPara: formatProgramadoParaForInput(initialOs.programadoPara),
        checklist: initialOs.checklist ? [...initialOs.checklist.map(item => ({...item}))] : [],
      });
      setClientInput(initialOs.cliente || '');
      setPartnerInput(initialOs.parceiro || '');
      setSelectedFiles([]);
      setPastedImages([]);
       // Reset editableChecklist only if OS changes
      if(initialOs.id !== formData.id) {
        setEditableChecklist(initialOs.checklist ? initialOs.checklist.map(item => ({...item})) : [{id: `item-${Date.now()}`, text: '', completed: false}]);
      }
    } else {
      // Quando entra em modo de edição, inicializa editableChecklist com os dados de initialOs.checklist
       console.log("[OSDetailsView Effect] Entering edit mode. Initializing editableChecklist.");
       setEditableChecklist(initialOs.checklist ? initialOs.checklist.map(item => ({...item})) : [{id: `item-${Date.now()}`, text: '', completed: false}]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOs, isEditing, formatProgramadoParaForInput]);


  const [clientInput, setClientInput] = useState(initialOs.cliente || '');
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const clientInputRef = useRef<HTMLInputElement>(null);
  const clientSuggestionsRef = useRef<HTMLDivElement>(null);

  const [partnerInput, setPartnerInput] = useState(initialOs.parceiro || '');
  const [showPartnerSuggestions, setShowPartnerSuggestions] = useState(false);
  const partnerInputRef = useRef<HTMLInputElement>(null);
  const partnerSuggestionsRef = useRef<HTMLDivElement>(null);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [pastedImages, setPastedImages] = useState<{ name: string, url: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editableChecklist, setEditableChecklist] = useState<ChecklistItem[]>(initialOs.checklist ? initialOs.checklist.map(item => ({...item})) : [{id: `item-${Date.now()}`, text: '', completed: false}]);


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

  const handleFormInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : (name === 'programadoPara' ? (value || undefined) : value)
    }));
  };

  const handleClientInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setClientInput(value);
    // Atualizar formData se estiver editando
    if (isEditing) {
        setFormData(prev => ({ ...prev, cliente: value, clientId: clients.find(c => c.name === value)?.id || prev.clientId }));
    }
    setShowClientSuggestions(!!value && clients.filter(c => c.name.toLowerCase().includes(value.toLowerCase())).length > 0 && document.activeElement === clientInputRef.current);
  };

  const handlePartnerInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPartnerInput(value);
     if (isEditing) {
        setFormData(prev => ({ ...prev, parceiro: value || undefined, partnerId: partners.find(p => p.name === value)?.id || prev.partnerId }));
    }
    setShowPartnerSuggestions(!!value && partners.filter(p => p.name.toLowerCase().includes(value.toLowerCase())).length > 0 && document.activeElement === partnerInputRef.current);
  };

  const handleClientSelect = (clientName: string) => {
    setClientInput(clientName);
    if (isEditing) {
        setFormData(prev => ({ ...prev, cliente: clientName, clientId: clients.find(c => c.name === clientName)?.id || prev.clientId }));
    }
    setShowClientSuggestions(false);
  };

  const handlePartnerSelect = (partnerName: string) => {
    setPartnerInput(partnerName);
    if (isEditing) {
        setFormData(prev => ({ ...prev, parceiro: partnerName || undefined, partnerId: partners.find(p => p.name === partnerName)?.id || prev.partnerId }));
    }
    setShowPartnerSuggestions(false);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(prev => [...prev, ...files]);
    const filePlaceholders = files.map(file => `\n[Arquivo: ${file.name}]`).join('');
    setFormData(prev => ({
      ...prev,
      observacoes: (prev.observacoes || '') + filePlaceholders
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePasteInObservacoes = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (!isEditing) return;
    const items = event.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            const imageName = `imagem_colada_${Date.now()}.${blob.type.split('/')[1] || 'png'}`;
            setPastedImages(prev => [...prev, { name: imageName, url: dataUrl }]);
            const imagePlaceholder = `\n[Imagem Colada: ${imageName}]`;
            setFormData(prev => ({
              ...prev,
              observacoes: (prev.observacoes || '') + imagePlaceholder
            }));
          };
          reader.readAsDataURL(blob);
          event.preventDefault();
          break;
        }
      }
    }
  };

  // Checklist editing functions
  const handleAddEditableChecklistItem = () => {
    setEditableChecklist(prev => [...prev, { id: `item-${Date.now()}-${prev.length}`, text: '', completed: false }]);
    setTimeout(() => {
        const inputs = document.querySelectorAll<HTMLInputElement>('.editable-checklist-item-input');
        if (inputs && inputs.length > 0) inputs[inputs.length - 1].focus();
    }, 0);
  };

  const handleEditableChecklistItemChange = (id: string, newText: string) => {
    setEditableChecklist(prev => prev.map(item => item.id === id ? { ...item, text: newText } : item));
  };

  const handleToggleEditableChecklistItem = (id: string) => {
    setEditableChecklist(prev => prev.map(item => item.id === id ? { ...item, completed: !item.completed } : item));
  };

  const handleRemoveEditableChecklistItem = (id: string) => {
    setEditableChecklist(prev => {
        const newItems = prev.filter(item => item.id !== id);
        return newItems.length === 0 ? [{ id: `item-${Date.now()}`, text: '', completed: false }] : newItems;
    });
  };

  const handleEditableChecklistKeyDown = (id: string, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAddEditableChecklistItem();
    }
  };


  const handleSave = async () => {
    setIsSaving(true);
    console.log("[OSDetailsView handleSave] Current formData (before direct client/partner input):", formData);
    console.log("[OSDetailsView handleSave] Current clientInput:", clientInput, "Current partnerInput:", partnerInput);

    const finalChecklist = isEditing ? editableChecklist.filter(item => item.text.trim() !== '') : initialOs.checklist;

    const dataToSave: OS = {
      ...formData,
      cliente: clientInput.trim(),
      parceiro: partnerInput.trim() || undefined,
      id: initialOs.id,
      numero: initialOs.numero,
      dataAbertura: initialOs.dataAbertura,
      // Timer related fields should use the current formData which reflects direct edits IF ANY,
      // otherwise they come from initialOs via the useEffect sync.
      // For status, always use formData.status as it's directly editable.
      status: formData.status,
      dataInicioProducao: formData.dataInicioProducao,
      dataInicioProducaoAtual: formData.dataInicioProducaoAtual,
      tempoGastoProducaoSegundos: formData.tempoGastoProducaoSegundos,
      dataFinalizacao: formData.dataFinalizacao,
      clientId: clients.find(c => c.name === clientInput.trim())?.id || initialOs.clientId, // Ensure clientId is updated
      partnerId: partners.find(p => p.name === partnerInput.trim())?.id || initialOs.partnerId, // Ensure partnerId is updated
      checklist: finalChecklist,
    };
    console.log('[OSDetailsView handleSave] Data para updateOS (store):', JSON.stringify(dataToSave, null, 2));

    try {
      const result = await updateOS(dataToSave);
      if (result) {
        setIsEditing(false);
        setSelectedFiles([]);
        setPastedImages([]);
        // formData will be updated by the useEffect watching initialOs
        console.log('[OSDetailsView handleSave] OS salva com sucesso. Saindo do modo de edição.');
      } else {
        alert('Falha ao atualizar OS. Verifique os logs.');
        console.error('[OSDetailsView handleSave] updateOS do store retornou falsy.');
      }
    } catch (error) {
      console.error("[OSDetailsView handleSave] Erro ao salvar OS:", error);
      alert('Erro ao tentar salvar OS. Verifique os logs.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    // Re-sync with initialOs, which useEffect handles
    setSelectedFiles([]);
    setPastedImages([]);
  };

  const handleFinalizeOS = async () => {
    if (initialOs.status !== OSStatus.FINALIZADO) {
      setIsSaving(true);
      const success = await updateOSStatus(initialOs.id, OSStatus.FINALIZADO);
      setIsSaving(false);
      if (success) {
        console.log(`[OSDetailsView] OS ${initialOs.id} finalizada, redirecionando para dashboard.`);
        router.push('/dashboard');
      } else {
        alert('Falha ao finalizar OS. Verifique logs.');
      }
    }
  };

  const handleReopenOS = async () => {
    if (initialOs.status === OSStatus.FINALIZADO) {
      setIsSaving(true);
      const success = await updateOSStatus(initialOs.id, OSStatus.NA_FILA);
      setIsSaving(false);
      if (success) {
         console.log(`[OSDetailsView] OS ${initialOs.id} reaberta, redirecionando para dashboard.`);
        router.push('/dashboard');
      } else {
        alert('Falha ao reabrir OS. Verifique logs.');
      }
    }
  };

  const handleToggleTimer = async (action: 'play' | 'pause') => {
    setIsSaving(true);
    console.log(`[OSDetailsView] handleToggleTimer called with action: ${action} for OS ID: ${initialOs.id}. Current status: ${initialOs.status}, dataInicioProducaoAtual: ${initialOs.dataInicioProducaoAtual}`);
    await toggleProductionTimer(initialOs.id, action);
    setIsSaving(false);
  };

  const handlePrint = () => {
    window.print();
  };

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

  const isTimerCurrentlyRunning = initialOs.status === OSStatus.EM_PRODUCAO && !!initialOs.dataInicioProducaoAtual;
  const isFinalized = initialOs.status === OSStatus.FINALIZADO;


  return (
    <div className={`container-fluid os-details-print-container ${initialOs.isUrgent && !isEditing ? 'os-details-urgent' : ''}`}>
      <div className="mb-4 d-flex justify-content-between align-items-center flex-wrap gap-2 no-print">
        <Link href="/dashboard" className="btn btn-outline-secondary btn-sm">
          <ArrowLeft className="me-2" size={16} /> Voltar ao Painel
        </Link>
        <div className="d-flex gap-2 flex-wrap align-items-center">
          {isEditing ? (
            <>
              <button className="btn btn-outline-secondary btn-sm" onClick={handleCancel} disabled={isSaving}>
                Cancelar
              </button>
              <button className="btn btn-success btn-sm" onClick={handleSave} disabled={isSaving || !clientInput.trim() || !formData.projeto?.trim()}>
                {isSaving ? <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span> : <Save size={16} className="me-1" />}
                Salvar Alterações
              </button>
            </>
          ) : (
            !isFinalized && (
              <button className="btn btn-primary btn-sm" onClick={() => setIsEditing(true)}>
                <Edit size={16} className="me-1" />
                Editar OS
              </button>
            )
          )}
          {!isEditing && !isFinalized && (
            <button
              className="btn btn-info btn-sm"
              onClick={handleFinalizeOS}
              disabled={isSaving || isTimerCurrentlyRunning}
              title={isTimerCurrentlyRunning ? "Pause o timer primeiro para finalizar" : "Finalizar Ordem de Serviço"}
            >
              <CheckSquareIcon size={16} className="me-1" /> Finalizar OS
            </button>
          )}
          {!isEditing && isFinalized && (
            <button className="btn btn-warning btn-sm" onClick={handleReopenOS} disabled={isSaving} title="Re-abrir Ordem de Serviço">
              <RotateCcw size={16} className="me-1" /> Re-abrir OS
            </button>
          )}
          <button className="btn btn-outline-dark btn-sm" onClick={handlePrint} title="Imprimir Ordem de Serviço">
            <Printer size={16} className="me-1" /> Imprimir OS
          </button>
        </div>
      </div>

      <div className={`card shadow-lg mb-4`}>
        <div className={`card-header p-3 border-bottom d-flex justify-content-between align-items-start ${initialOs.isUrgent && !isEditing ? '' : getStatusHeaderClasses(initialOs.status, isEditing)}`}>
          <div>
            {isEditing ? (
              <input
                type="text"
                className="form-control form-control-lg mb-1 fw-bold"
                name="projeto"
                value={formData.projeto || ''}
                onChange={handleFormInputChange}
                placeholder="Nome do Projeto"
                style={{ fontSize: '1.25rem' }}
                required
              />
            ) : (
              <h1 className="card-title h4 mb-1 fw-bold">{initialOs.projeto}</h1>
            )}
            <p className="card-subtitle text-muted mb-0 small">
              Ordem de Serviço: {initialOs.numero}
            </p>
          </div>
          {initialOs.isUrgent && !isEditing && (
            <span className="badge bg-danger text-white fs-6 px-3 py-1 d-flex align-items-center shadow-sm">
              <AlertTriangle size={16} className="me-1" /> URGENTE
            </span>
          )}
           {isEditing && (
               <div className="form-check form-switch ms-auto">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      role="switch"
                      id="isUrgentSwitchHeader"
                      name="isUrgent"
                      checked={formData.isUrgent}
                      onChange={handleFormInputChange}
                    />
                    <label className="form-check-label small" htmlFor="isUrgentSwitchHeader">
                      Urgente
                    </label>
                </div>
           )}
        </div>
        <div className="card-body p-4">

          {initialOs.status !== OSStatus.FINALIZADO && (
            <div className="card bg-light-subtle p-2 mb-3 shadow-sm small">
              <h6 className="card-title text-primary mb-2 d-flex align-items-center">
                  <Clock3 size={18} className="me-2" /> Detalhes do Cronômetro
              </h6>
              <dl className="row mb-0" style={{ fontSize: '0.8rem' }}>
                  {initialOs.dataInicioProducao && (
                      <>
                          <dt className="col-sm-5 col-md-4 text-muted fw-medium">Primeiro Início Produção:</dt>
                          <dd className="col-sm-7 col-md-8 mb-1">{formatDateForDetailsSection(initialOs.dataInicioProducao)}</dd>
                      </>
                  )}
                  {isTimerCurrentlyRunning && initialOs.dataInicioProducaoAtual && (
                      <>
                          <dt className="col-sm-5 col-md-4 text-muted fw-medium">Início Sessão Atual:</dt>
                          <dd className="col-sm-7 col-md-8 mb-1">{formatDateForDetailsSection(initialOs.dataInicioProducaoAtual)}</dd>
                          <dt className="col-sm-5 col-md-4 text-muted fw-medium">Duração Sessão Atual:</dt>
                          <dd className="col-sm-7 col-md-8 mb-1"><CurrentSessionDuration startTimeISO={initialOs.dataInicioProducaoAtual} /></dd>
                      </>
                  )}
                   <dt className="col-sm-5 col-md-4 text-muted fw-medium">Tempo Total em Produção:</dt>
                   <dd className="col-sm-7 col-md-8 mb-0">
                      <ChronometerDisplay
                          startTimeISO={initialOs.dataInicioProducaoAtual}
                          accumulatedSeconds={initialOs.tempoGastoProducaoSegundos}
                          isRunningClientOverride={isTimerCurrentlyRunning}
                          osStatus={initialOs.status}
                      />
                   </dd>
              </dl>
              {!initialOs.dataInicioProducao && !isTimerCurrentlyRunning && initialOs.tempoGastoProducaoSegundos === 0 && (
                   <p className="text-muted fst-italic mt-2 mb-0" style={{ fontSize: '0.8rem' }}>O cronômetro ainda não foi iniciado para esta OS.</p>
              )}
            </div>
          )}

          <div className="row">
            <div className="col-md-6">
              <dl className="mb-0">
                <DetailItem
                  label="Cliente"
                  icon={<UserIconLucide size={16} className="me-2 text-primary" />}
                  name="cliente"
                  isEditableField={true}
                  value={isEditing ? clientInput : initialOs.cliente}
                  isEditingMode={isEditing}
                >
                  <div className="position-relative">
                    <input
                      ref={clientInputRef}
                      type="text"
                      className="form-control form-control-sm"
                      name="cliente"
                      value={clientInput}
                      onChange={handleClientInputChange}
                      onFocus={() => setShowClientSuggestions(!!clientInput && filteredClients.length > 0 && document.activeElement === clientInputRef.current)}
                      onBlur={() => setTimeout(() => setShowClientSuggestions(false), 150)}
                      autoComplete="off"
                      placeholder="Digite ou selecione um cliente"
                      disabled={!isEditing}
                      required
                    />
                    {isEditing && showClientSuggestions && filteredClients.length > 0 && (
                      <div ref={clientSuggestionsRef} className="list-group position-absolute w-100 mt-1" style={{ zIndex: 10, maxHeight: '150px', overflowY: 'auto', boxShadow: '0 .5rem 1rem rgba(0,0,0,.15)' }}>
                        {filteredClients.map(c => (
                          <button type="button" key={c.id} className="list-group-item list-group-item-action list-group-item-light py-1 px-2 small"
                            onMouseDown={(e) => { e.preventDefault(); handleClientSelect(c.name); }}>
                            {c.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </DetailItem>

                <DetailItem
                  label="Parceiro"
                  icon={<Users size={16} className="me-2 text-primary" />}
                  name="parceiro"
                  isEditableField={true}
                  value={isEditing ? partnerInput : initialOs.parceiro}
                  isEditingMode={isEditing}
                >
                  <div className="position-relative">
                    <input
                      ref={partnerInputRef}
                      type="text"
                      className="form-control form-control-sm"
                      name="parceiro"
                      value={partnerInput}
                      onChange={handlePartnerInputChange}
                      onFocus={() => setShowPartnerSuggestions(!!partnerInput && filteredPartners.length > 0 && document.activeElement === partnerInputRef.current)}
                      onBlur={() => setTimeout(() => setShowPartnerSuggestions(false), 150)}
                      autoComplete="off"
                      placeholder="Digite ou selecione um parceiro (opcional)"
                      disabled={!isEditing}
                    />
                    {isEditing && showPartnerSuggestions && filteredPartners.length > 0 && (
                      <div ref={partnerSuggestionsRef} className="list-group position-absolute w-100 mt-1" style={{ zIndex: 10, maxHeight: '150px', overflowY: 'auto', boxShadow: '0 .5rem 1rem rgba(0,0,0,.15)' }}>
                        {filteredPartners.map(p => (
                          <button type="button" key={p.id} className="list-group-item list-group-item-action list-group-item-light py-1 px-2 small"
                            onMouseDown={(e) => { e.preventDefault(); handlePartnerSelect(p.name); }}>
                            {p.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </DetailItem>

                <DetailItem
                  label="Status"
                  value={isEditing ? formData.status : initialOs.status}
                  icon={getStatusIcon(isEditing ? formData.status : initialOs.status)}
                  name="status"
                  isEditableField={true}
                  isEditingMode={isEditing}
                >
                  <select
                    className="form-select form-select-sm"
                    name="status"
                    value={formData.status}
                    onChange={handleFormInputChange}
                    disabled={!isEditing || isFinalized}
                  >
                    {ALL_OS_STATUSES.map(s => (
                      <option key={s} value={s} disabled={isFinalized && s !== OSStatus.FINALIZADO}>
                        {s}
                      </option>
                    ))}
                  </select>
                </DetailItem>

                <DetailItem
                  label="Data de Abertura"
                  value={initialOs.dataAbertura}
                  icon={<CalendarClock size={16} className="me-2 text-secondary" />}
                  name="dataAbertura"
                  isEditableField={false}
                  isEditingMode={isEditing}
                />

                <DetailItem
                  label="Programado Para"
                  value={isEditing ? formData.programadoPara : initialOs.programadoPara}
                  icon={<CalendarIcon size={16} className="me-2 text-info" />}
                  name="programadoPara"
                  isEditableField={true}
                  isEditingMode={isEditing}
                >
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    name="programadoPara"
                    value={formData.programadoPara || ''}
                    onChange={handleFormInputChange}
                    disabled={!isEditing}
                  />
                </DetailItem>

                {isFinalized && initialOs.dataFinalizacao && (
                  <DetailItem
                    label="Data de Finalização"
                    value={initialOs.dataFinalizacao}
                    icon={<CheckCircle2 size={16} className="me-2 text-success" />}
                    name="dataFinalizacao"
                    isEditableField={false}
                    isEditingMode={isEditing}
                  />
                )}
                 <DetailItem
                  label="Urgente"
                  value={isEditing ? formData.isUrgent : initialOs.isUrgent}
                  icon={<Flag size={16} className={`me-2 ${(isEditing ? formData.isUrgent : initialOs.isUrgent) ? 'text-danger' : 'text-secondary'}`} />}
                  name="isUrgent"
                  isEditableField={true}
                  isEditingMode={isEditing}
                >
                  <div className="form-check form-switch">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      role="switch"
                      id="isUrgentSwitch"
                      name="isUrgent"
                      checked={formData.isUrgent}
                      onChange={handleFormInputChange}
                      disabled={!isEditing}
                    />
                    <label className="form-check-label small visually-hidden" htmlFor="isUrgentSwitch">
                      {formData.isUrgent ? "Sim" : "Não"}
                    </label>
                  </div>
                </DetailItem>
                 <DetailItem
                    label="Tempo (Cronômetro)"
                    icon={<Clock3 size={16} className="me-2 text-secondary" />}
                    name="tempoTrabalhado" // Mantém o nome para o DetailItem, mas o conteúdo é diferente
                    isEditableField={false} // Não é editável diretamente aqui
                    isEditingMode={isEditing}
                    value={ // Exibe o ChronometerDisplay quando não está editando
                         !isEditing ? (
                            <ChronometerDisplay
                                startTimeISO={initialOs.dataInicioProducaoAtual}
                                accumulatedSeconds={initialOs.tempoGastoProducaoSegundos}
                                isRunningClientOverride={isTimerCurrentlyRunning}
                                osStatus={initialOs.status}
                            />
                        ) : (
                             <ChronometerDisplay
                                startTimeISO={initialOs.dataInicioProducaoAtual} // Mostrar o estado real do timer
                                accumulatedSeconds={initialOs.tempoGastoProducaoSegundos}
                                isRunningClientOverride={isTimerCurrentlyRunning}
                                osStatus={initialOs.status}
                            />
                        )
                    }
                    >
                    {/* Este filho não será renderizado se isEditableField for false */}
                 </DetailItem>


              </dl>
            </div>

            <div className="col-md-6">
              <dl className="mb-0">
                <div className="row py-2 border-bottom mb-2">
                  <dt className="col-sm-4 col-lg-3 text-muted d-flex align-items-center small fw-medium">
                     Controle Timer
                  </dt>
                  <dd className="col-sm-8 col-lg-9 mb-0 d-flex align-items-center">
                    {!isEditing && !isFinalized && (
                      <div className="ms-auto d-flex gap-2 no-print">
                        {isTimerCurrentlyRunning ? (
                          <button
                            className="btn btn-sm btn-warning"
                            onClick={() => handleToggleTimer('pause')}
                            disabled={isSaving}
                            title="Pausar cronômetro"
                          >
                            <Pause size={16} className="me-1" /> Pausar
                          </button>
                        ) : (
                          <button
                            className="btn btn-sm btn-success"
                            onClick={() => handleToggleTimer('play')}
                            disabled={isSaving}
                            title="Iniciar cronômetro (define status para Em Produção)"
                          >
                            <Play size={16} className="me-1" /> Iniciar
                          </button>
                        )}
                      </div>
                    )}
                    {(isEditing || isFinalized) && (
                        <span className="text-muted fst-italic small">Controles do timer desabilitados {isEditing ? 'enquanto edita.' : 'pois a OS está finalizada.'}</span>
                    )}
                  </dd>
                </div>

                <DetailItem
                  label="Tarefa Principal"
                  value={isEditing ? formData.tarefa : initialOs.tarefa}
                  icon={<Briefcase size={16} className="me-2 text-primary" />}
                  name="tarefa"
                  isEditableField={true}
                  isEditingMode={isEditing}
                >
                  <textarea
                    className="form-control form-control-sm"
                    name="tarefa"
                    rows={3}
                    value={formData.tarefa || ''}
                    onChange={handleFormInputChange}
                    disabled={!isEditing}
                    required={isEditing}
                  />
                </DetailItem>

                {/* Checklist display/edit section */}
                <div className="row py-2">
                    <dt className="col-sm-4 col-lg-3 text-muted d-flex align-items-center small fw-medium">
                        <CheckSquareIcon size={16} className="me-2 text-primary" />Checklist
                    </dt>
                    <dd className="col-sm-8 col-lg-9 mb-0">
                        {isEditing ? (
                            <div>
                                {editableChecklist.map((item, index) => (
                                    <div key={item.id} className="input-group input-group-sm mb-1">
                                        <div className="input-group-text">
                                            <input
                                                className="form-check-input mt-0"
                                                type="checkbox"
                                                checked={item.completed}
                                                onChange={() => handleToggleEditableChecklistItem(item.id)}
                                                aria-label={`Marcar item ${index + 1} do checklist`}
                                            />
                                        </div>
                                        <input
                                            type="text"
                                            className={`form-control form-control-sm editable-checklist-item-input ${item.completed ? 'text-decoration-line-through text-muted' : ''}`}
                                            placeholder={`Item ${index + 1}`}
                                            value={item.text}
                                            onChange={(e) => handleEditableChecklistItemChange(item.id, e.target.value)}
                                            onKeyDown={(e) => handleEditableChecklistKeyDown(item.id, e)}
                                        />
                                        <button
                                            className="btn btn-outline-danger btn-sm"
                                            type="button"
                                            onClick={() => handleRemoveEditableChecklistItem(item.id)}
                                            title="Remover item"
                                            disabled={editableChecklist.length === 1 && item.text.trim() === ''}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    className="btn btn-sm btn-success mt-1"
                                    onClick={handleAddEditableChecklistItem}
                                >
                                    <PlusCircle size={14} className="me-1" /> Adicionar Item ao Checklist
                                </button>
                            </div>
                        ) : (
                            initialOs.checklist && initialOs.checklist.length > 0 ? (
                                <ul className="list-unstyled mb-0 small">
                                    {initialOs.checklist.map((item) => (
                                        <li key={item.id} className={`d-flex align-items-center ${item.completed ? 'text-decoration-line-through text-muted' : ''}`}>
                                            {item.completed ? <CheckSquareIcon size={14} className="me-1 text-success flex-shrink-0"/> : <Square size={14} className="me-1 text-muted flex-shrink-0"/>}
                                            <span className="text-break">{item.text}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <span className="text-muted fst-italic small">Nenhum item no checklist.</span>
                            )
                        )}
                    </dd>
                </div>

                <DetailItem
                  label="Observações"
                  value={isEditing ? formData.observacoes : initialOs.observacoes}
                  icon={<MessageSquare size={16} className="me-2 text-primary" />}
                  name="observacoes"
                  isEditableField={true}
                  isEditingMode={isEditing}
                >
                  <textarea
                    className="form-control form-control-sm"
                    name="observacoes"
                    rows={isEditing ? 3 : 4}
                    value={formData.observacoes || ''}
                    onChange={handleFormInputChange}
                    onPaste={isEditing ? handlePasteInObservacoes : undefined}
                    disabled={!isEditing}
                  />
                  {isEditing && (
                    <div className="mt-2">
                      <input
                        type="file"
                        multiple
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        className="d-none"
                        id="fileUploadInput"
                        accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
                      />
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <UploadCloud size={14} className="me-1" /> Adicionar Arquivos
                      </button>
                      <small className="d-block text-muted mt-1 small">
                        Você também pode colar imagens (Ctrl+V) diretamente no campo de observações.
                      </small>
                      {selectedFiles.length > 0 && (
                        <div className="mt-2">
                          <strong className="small d-block mb-1">Arquivos selecionados:</strong>
                          <ul className="list-unstyled mb-0">
                            {selectedFiles.map((file, index) => (
                              <li key={index} className="small text-muted d-flex align-items-center">
                                <Paperclip size={12} className="me-1 flex-shrink-0" /> {file.name}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {pastedImages.length > 0 && (
                        <div className="mt-2">
                          <strong className="small d-block mb-1">Imagens coladas (pré-visualização):</strong>
                          <div className="d-flex flex-wrap gap-2 mt-1">
                            {pastedImages.map((image, index) => (
                              <img
                                key={index}
                                src={image.url}
                                alt={image.name}
                                style={{ maxHeight: '60px', maxWidth: '100px', border: '1px solid #ddd', borderRadius: '4px', objectFit: 'contain' }}
                                title={image.name}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </DetailItem>


              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
