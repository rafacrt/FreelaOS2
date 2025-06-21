
'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { OS, ChecklistItem } from '@/lib/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft, CalendarClock, CheckCircle2, FileText, Flag, Server, User as UserIconLucide, UserCheck,
    Users, Briefcase, MessageSquare, Clock3, Save, Edit, Calendar as CalendarIcon, Printer, HelpCircle, AlertOctagon, ThumbsUp, ThumbsDown,
    CheckSquare as CheckSquareIcon, Square, Play, Pause, RotateCcw, UploadCloud, Paperclip, AlertTriangle, Clock,
    PlusCircle, Trash2
} from 'lucide-react';
import { format, parseISO, isValid, differenceInSeconds, formatDistanceStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useOSStore } from '@/store/os-store';
import { OSStatus, ALL_OS_STATUSES } from '@/lib/types';
import ChronometerDisplay from './ChronometerDisplay';

const getStatusHeaderClasses = (status: OSStatus, isEditing: boolean, isUrgentGlobal: boolean): string => {
  if (isUrgentGlobal && !isEditing && status !== OSStatus.AGUARDANDO_APROVACAO && status !== OSStatus.RECUSADA) return 'bg-danger-subtle text-danger-emphasis'; 
  if (isEditing) return 'bg-light text-dark';
  switch (status) {
    case OSStatus.NA_FILA: return 'bg-secondary-subtle text-secondary-emphasis';
    case OSStatus.AGUARDANDO_CLIENTE: return 'bg-warning-subtle text-warning-emphasis';
    case OSStatus.EM_PRODUCAO: return 'bg-info-subtle text-info-emphasis';
    case OSStatus.AGUARDANDO_PARCEIRO: return 'bg-primary-subtle text-primary-emphasis';
    case OSStatus.AGUARDANDO_APROVACAO: return 'bg-warning-subtle text-warning-emphasis border border-warning'; // Destaque para aguardando aprovação
    case OSStatus.RECUSADA: return 'bg-danger-subtle text-danger-emphasis border border-danger'; // Destaque para recusada
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
    case OSStatus.AGUARDANDO_APROVACAO: return <HelpCircle size={16} className="me-2 text-warning" />;
    case OSStatus.RECUSADA: return <AlertOctagon size={16} className="me-2 text-danger" />;
    case OSStatus.FINALIZADO: return <CheckCircle2 size={16} className="me-2" />;
    default: return <FileText size={16} className="me-2" />;
  }
};

interface DetailItemProps {
  label: string;
  value?: string | null | boolean | number | React.ReactNode;
  icon?: React.ReactNode;
  name?: keyof OS | string;
  isEditableField: boolean;
  children?: React.ReactNode;
  className?: string;
  isEditingMode: boolean;
  viewMode: 'admin' | 'partner';
  currentOsStatus?: OSStatus; // Pass current OS status to conditionally disable fields
}

const DetailItem = ({ label, value, icon, name, isEditableField, children, className, isEditingMode, viewMode, currentOsStatus }: DetailItemProps) => {
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
  const isPendingOrRefused = currentOsStatus === OSStatus.AGUARDANDO_APROVACAO || currentOsStatus === OSStatus.RECUSADA;
  const canEditThisField = isEditingMode && viewMode === 'admin' && isEditableField && !isPendingOrRefused;

  return (
    <div className={`row py-2 ${className || ''}`}>
      <dt className="col-sm-4 col-lg-3 text-muted d-flex align-items-center small fw-medium">{icon}{label}</dt>
      <dd className="col-sm-8 col-lg-9 mb-0">
        {canEditThisField ? (
          (children && React.isValidElement(children))
            ? React.cloneElement(children, { disabled: (children.props.disabled || isPendingOrRefused) })
            : children
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
  viewMode: 'admin' | 'partner';
}

export default function OSDetailsView({ initialOs, viewMode }: OSDetailsViewProps) {
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

  useEffect(() => {
    if (!isEditing || initialOs.id !== formData.id) { 
      setFormData({
        ...initialOs,
        programadoPara: formatProgramadoParaForInput(initialOs.programadoPara),
        checklist: initialOs.checklist ? [...initialOs.checklist.map(item => ({...item}))] : [],
      });
      setClientInput(initialOs.cliente || '');
      setPartnerInput(initialOs.parceiro || '');
      setSelectedFiles([]);
      setPastedImages([]);
      setEditableChecklist(initialOs.checklist ? initialOs.checklist.map(item => ({...item})) : [{id: `item-${Date.now()}`, text: '', completed: false}]);
    } else if (isEditing && initialOs.id === formData.id) {
       setEditableChecklist(initialOs.checklist ? initialOs.checklist.map(item => ({...item})) : [{id: `item-${Date.now()}`, text: '', completed: false}]);
    }
  }, [initialOs, isEditing, formatProgramadoParaForInput, formData.id]);


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
    if (viewMode !== 'admin') return;
    setIsSaving(true);
    const finalChecklist = isEditing ? editableChecklist.filter(item => item.text.trim() !== '') : initialOs.checklist;

    const dataToSave: OS = {
      ...formData,
      cliente: clientInput.trim(),
      parceiro: partnerInput.trim() || undefined,
      id: initialOs.id,
      numero: initialOs.numero,
      dataAbertura: initialOs.dataAbertura,
      status: formData.status, // Status será atualizado via updateOSStatus se necessário
      dataInicioProducao: formData.dataInicioProducao,
      dataInicioProducaoAtual: formData.dataInicioProducaoAtual,
      tempoGastoProducaoSegundos: formData.tempoGastoProducaoSegundos,
      dataFinalizacao: formData.dataFinalizacao,
      clientId: clients.find(c => c.name === clientInput.trim())?.id || initialOs.clientId,
      partnerId: partners.find(p => p.name === partnerInput.trim())?.id || initialOs.partnerId,
      checklist: finalChecklist,
    };
    try {
      const result = await updateOS(dataToSave);
      if (result) {
        setIsEditing(false);
        setSelectedFiles([]);
        setPastedImages([]);
      } else {
        alert('Falha ao atualizar OS. Verifique os logs.');
      }
    } catch (error) {
      alert('Erro ao tentar salvar OS. Verifique os logs.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setSelectedFiles([]);
    setPastedImages([]);
  };

  const handleApprovalAction = async (approved: boolean) => {
    if (viewMode !== 'admin' || initialOs.status !== OSStatus.AGUARDANDO_APROVACAO) return;
    setIsSaving(true);
    const newStatus = approved ? OSStatus.NA_FILA : OSStatus.RECUSADA;
    const success = await updateOSStatus(initialOs.id, newStatus);
    setIsSaving(false);
    if (!success) {
      alert(`Falha ao ${approved ? 'aprovar' : 'recusar'} OS. Verifique os logs.`);
    }
    // A OS será atualizada no store e a view re-renderizará
  };

  const handleFinalizeOS = async () => {
    if (viewMode !== 'admin' || initialOs.status === OSStatus.FINALIZADO || initialOs.status === OSStatus.AGUARDANDO_APROVACAO || initialOs.status === OSStatus.RECUSADA) return;
    setIsSaving(true);
    const success = await updateOSStatus(initialOs.id, OSStatus.FINALIZADO);
    setIsSaving(false);
    if (success) {
      router.push('/dashboard');
    } else {
      alert('Falha ao finalizar OS. Verifique logs.');
    }
  };

  const handleReopenOS = async () => {
    if (viewMode !== 'admin' || initialOs.status !== OSStatus.FINALIZADO) return;
    setIsSaving(true);
    const success = await updateOSStatus(initialOs.id, OSStatus.NA_FILA); // Reabre para "Na Fila"
    setIsSaving(false);
    if (success) {
      // router.push('/dashboard'); // Não precisa redirecionar, apenas atualiza a OS
    } else {
      alert('Falha ao reabrir OS. Verifique logs.');
    }
  };

  const handleToggleTimer = async (action: 'play' | 'pause') => {
    if (viewMode !== 'admin' || initialOs.status === OSStatus.AGUARDANDO_APROVACAO || initialOs.status === OSStatus.RECUSADA || initialOs.status === OSStatus.FINALIZADO) return;
    setIsSaving(true);
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
  const isAwaitingApproval = initialOs.status === OSStatus.AGUARDANDO_APROVACAO;
  const isRefused = initialOs.status === OSStatus.RECUSADA;
  const canAdminEditFields = viewMode === 'admin' && !isFinalized && !isAwaitingApproval && !isRefused;


  return (
    <div className={`container-fluid os-details-print-container ${initialOs.isUrgent && !isEditing ? 'os-details-urgent' : ''}`}>
      <div className="mb-4 d-flex justify-content-between align-items-center flex-wrap gap-2 no-print">
        <Link href={viewMode === 'admin' ? "/dashboard" : "/partner/dashboard"} className="btn btn-outline-secondary btn-sm">
          <ArrowLeft className="me-2" size={16} /> Voltar ao Painel
        </Link>
        <div className="d-flex gap-2 flex-wrap align-items-center">
          {viewMode === 'admin' && isEditing && (
            <>
              <button className="btn btn-outline-secondary btn-sm" onClick={handleCancel} disabled={isSaving}>
                Cancelar
              </button>
              <button className="btn btn-success btn-sm" onClick={handleSave} disabled={isSaving || !clientInput.trim() || !formData.projeto?.trim()}>
                {isSaving ? <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span> : <Save size={16} className="me-1" />}
                Salvar Alterações
              </button>
            </>
          )}
          {viewMode === 'admin' && !isEditing && canAdminEditFields && (
              <button className="btn btn-primary btn-sm" onClick={() => setIsEditing(true)}>
                <Edit size={16} className="me-1" />
                Editar OS
              </button>
          )}
           {viewMode === 'admin' && !isEditing && isAwaitingApproval && (
            <>
              <button className="btn btn-success btn-sm" onClick={() => handleApprovalAction(true)} disabled={isSaving}>
                <ThumbsUp size={16} className="me-1" /> Aprovar OS
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => handleApprovalAction(false)} disabled={isSaving}>
                <ThumbsDown size={16} className="me-1" /> Recusar OS
              </button>
            </>
          )}
          {viewMode === 'admin' && !isEditing && !isFinalized && !isAwaitingApproval && !isRefused &&(
            <button
              className="btn btn-info btn-sm"
              onClick={handleFinalizeOS}
              disabled={isSaving || isTimerCurrentlyRunning}
              title={isTimerCurrentlyRunning ? "Pause o timer primeiro para finalizar" : "Finalizar Ordem de Serviço"}
            >
              <CheckSquareIcon size={16} className="me-1" /> Finalizar OS
            </button>
          )}
          {viewMode === 'admin' && !isEditing && (isFinalized || isRefused) && (
            <button className="btn btn-warning btn-sm" onClick={handleReopenOS} disabled={isSaving} title="Re-abrir Ordem de Serviço (para Na Fila)">
              <RotateCcw size={16} className="me-1" /> Re-abrir OS
            </button>
          )}
          <button className="btn btn-outline-dark btn-sm" onClick={handlePrint} title="Imprimir Ordem de Serviço">
            <Printer size={16} className="me-1" /> Imprimir OS
          </button>
        </div>
      </div>

      <div className={`card shadow-lg mb-4`}>
        <div className={`card-header p-3 border-bottom d-flex justify-content-between align-items-start ${getStatusHeaderClasses(initialOs.status, isEditing, initialOs.isUrgent)}`}>
          <div>
            {isEditing && viewMode === 'admin' ? (
              <input
                type="text"
                className="form-control form-control-lg mb-1 fw-bold"
                name="projeto"
                value={formData.projeto || ''}
                onChange={handleFormInputChange}
                placeholder="Nome do Projeto"
                style={{ fontSize: '1.25rem' }}
                required
                disabled={!canAdminEditFields && isEditing}
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
           {isEditing && viewMode === 'admin' && (
               <div className="form-check form-switch ms-auto">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      role="switch"
                      id="isUrgentSwitchHeader"
                      name="isUrgent"
                      checked={formData.isUrgent}
                      onChange={handleFormInputChange}
                      disabled={!canAdminEditFields && isEditing}
                    />
                    <label className="form-check-label small" htmlFor="isUrgentSwitchHeader">
                      Urgente
                    </label>
                </div>
           )}
        </div>
        <div className="card-body p-4">

          {viewMode === 'admin' && initialOs.status !== OSStatus.FINALIZADO && initialOs.status !== OSStatus.AGUARDANDO_APROVACAO && initialOs.status !== OSStatus.RECUSADA && (
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
                  value={isEditing && viewMode === 'admin' ? clientInput : initialOs.cliente}
                  isEditingMode={isEditing}
                  viewMode={viewMode}
                  currentOsStatus={initialOs.status}
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
                      disabled={!canAdminEditFields && isEditing}
                      required
                    />
                    {isEditing && viewMode === 'admin' && showClientSuggestions && filteredClients.length > 0 && (
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
                  value={isEditing && viewMode === 'admin' ? partnerInput : initialOs.parceiro}
                  isEditingMode={isEditing}
                  viewMode={viewMode}
                  currentOsStatus={initialOs.status}
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
                      disabled={!canAdminEditFields && isEditing}
                    />
                    {isEditing && viewMode === 'admin' && showPartnerSuggestions && filteredPartners.length > 0 && (
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
                  value={isEditing && viewMode === 'admin' ? formData.status : initialOs.status}
                  icon={getStatusIcon(isEditing && viewMode === 'admin' ? formData.status : initialOs.status)}
                  name="status"
                  isEditableField={true}
                  isEditingMode={isEditing}
                  viewMode={viewMode}
                  currentOsStatus={initialOs.status}
                >
                  <select
                    className="form-select form-select-sm"
                    name="status"
                    value={formData.status}
                    onChange={handleFormInputChange}
                    disabled={!canAdminEditFields && isEditing || isFinalized || isAwaitingApproval || isRefused}
                  >
                    {ALL_OS_STATUSES.filter(s => s !== OSStatus.AGUARDANDO_APROVACAO && s !== OSStatus.RECUSADA || s === initialOs.status).map(s => (
                      <option key={s} value={s} disabled={(isFinalized && s !== OSStatus.FINALIZADO) || ((isAwaitingApproval || isRefused) && s !== initialOs.status)}>
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
                  viewMode={viewMode}
                  currentOsStatus={initialOs.status}
                />

                <DetailItem
                  label="Programado Para"
                  value={isEditing && viewMode === 'admin' ? formData.programadoPara : initialOs.programadoPara}
                  icon={<CalendarIcon size={16} className="me-2 text-info" />}
                  name="programadoPara"
                  isEditableField={true}
                  isEditingMode={isEditing}
                  viewMode={viewMode}
                  currentOsStatus={initialOs.status}
                >
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    name="programadoPara"
                    value={formData.programadoPara || ''}
                    onChange={handleFormInputChange}
                    disabled={!canAdminEditFields && isEditing}
                  />
                </DetailItem>

                {(isFinalized || isRefused) && initialOs.dataFinalizacao && (
                  <DetailItem
                    label="Data de Finalização/Recusa"
                    value={initialOs.dataFinalizacao}
                    icon={<CheckCircle2 size={16} className="me-2 text-success" />}
                    name="dataFinalizacao"
                    isEditableField={false}
                    isEditingMode={isEditing}
                    viewMode={viewMode}
                    currentOsStatus={initialOs.status}
                  />
                )}
                 <DetailItem
                  label="Urgente"
                  value={isEditing && viewMode === 'admin' ? formData.isUrgent : initialOs.isUrgent}
                  icon={<Flag size={16} className={`me-2 ${(isEditing && viewMode === 'admin' ? formData.isUrgent : initialOs.isUrgent) ? 'text-danger' : 'text-secondary'}`} />}
                  name="isUrgent"
                  isEditableField={true}
                  isEditingMode={isEditing}
                  viewMode={viewMode}
                  currentOsStatus={initialOs.status}
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
                      disabled={!canAdminEditFields && isEditing}
                    />
                    <label className="form-check-label small visually-hidden" htmlFor="isUrgentSwitch">
                      {formData.isUrgent ? "Sim" : "Não"}
                    </label>
                  </div>
                </DetailItem>
                 <DetailItem
                    label="Tempo (Cronômetro)"
                    icon={<Clock3 size={16} className="me-2 text-secondary" />}
                    name="tempoTrabalhado"
                    isEditableField={false}
                    isEditingMode={isEditing}
                    viewMode={viewMode}
                    value={
                        <ChronometerDisplay
                            startTimeISO={initialOs.dataInicioProducaoAtual}
                            accumulatedSeconds={initialOs.tempoGastoProducaoSegundos}
                            isRunningClientOverride={isTimerCurrentlyRunning}
                            osStatus={initialOs.status}
                        />
                    }
                    currentOsStatus={initialOs.status}
                    />
              </dl>
            </div>

            <div className="col-md-6">
              <dl className="mb-0">
                {viewMode === 'admin' && !isFinalized && !isAwaitingApproval && !isRefused && (
                  <div className="row py-2 border-bottom mb-2">
                    <dt className="col-sm-4 col-lg-3 text-muted d-flex align-items-center small fw-medium">
                       Controle Timer
                    </dt>
                    <dd className="col-sm-8 col-lg-9 mb-0 d-flex align-items-center">
                      {!isEditing && (
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
                      {isEditing && (
                          <span className="text-muted fst-italic small">Controles do timer desabilitados enquanto edita.</span>
                      )}
                    </dd>
                  </div>
                )}

                <DetailItem
                  label="Tarefa Principal"
                  value={isEditing && viewMode === 'admin' ? formData.tarefa : initialOs.tarefa}
                  icon={<Briefcase size={16} className="me-2 text-primary" />}
                  name="tarefa"
                  isEditableField={true}
                  isEditingMode={isEditing}
                  viewMode={viewMode}
                  currentOsStatus={initialOs.status}
                >
                  <textarea
                    className="form-control form-control-sm"
                    name="tarefa"
                    rows={3}
                    value={formData.tarefa || ''}
                    onChange={handleFormInputChange}
                    disabled={!canAdminEditFields && isEditing}
                    required={isEditing && viewMode === 'admin'}
                  />
                </DetailItem>

                <div className="row py-2">
                    <dt className="col-sm-4 col-lg-3 text-muted d-flex align-items-center small fw-medium">
                        <CheckSquareIcon size={16} className="me-2 text-primary" />Checklist
                    </dt>
                    <dd className="col-sm-8 col-lg-9 mb-0">
                        {isEditing && viewMode === 'admin' && canAdminEditFields ? (
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
                  value={isEditing && viewMode === 'admin' ? formData.observacoes : initialOs.observacoes}
                  icon={<MessageSquare size={16} className="me-2 text-primary" />}
                  name="observacoes"
                  isEditableField={true}
                  isEditingMode={isEditing}
                  viewMode={viewMode}
                  currentOsStatus={initialOs.status}
                >
                  <textarea
                    className="form-control form-control-sm"
                    name="observacoes"
                    rows={isEditing && viewMode === 'admin' ? 3 : 4}
                    value={formData.observacoes || ''}
                    onChange={handleFormInputChange}
                    onPaste={isEditing && viewMode === 'admin' && canAdminEditFields ? handlePasteInObservacoes : undefined}
                    disabled={!canAdminEditFields && isEditing}
                  />
                  {isEditing && viewMode === 'admin' && canAdminEditFields && (
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
        <div className="card-footer text-muted small text-center">
            OS criada por {initialOs.creatorName || 'N/A'} ({initialOs.creatorType === 'admin' ? 'Admin' : 'Parceiro'}) em {isValidDate(parseISO(initialOs.dataAbertura)) ? format(parseISO(initialOs.dataAbertura), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : 'Data inválida'}
        </div>
      </div>
    </div>
  );
}
