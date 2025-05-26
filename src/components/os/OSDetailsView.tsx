
'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { OS } from '@/lib/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CalendarClock, CheckCircle2, FileText, Flag, Server, User as UserIcon, Users, Briefcase, MessageSquare, Clock3, Save, Edit, Calendar as CalendarIcon, Printer, CheckSquare, Play, Pause, RotateCcw, UploadCloud, Paperclip, Clock, AlertTriangle } from 'lucide-react';
import { format, parseISO, isValid, differenceInSeconds, formatDistanceStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useOSStore } from '@/store/os-store';
import { OSStatus, ALL_OS_STATUSES } from '@/lib/types';
import ChronometerDisplay from './ChronometerDisplay';

const getStatusIcon = (status: OSStatus) => {
  switch (status) {
    case OSStatus.NA_FILA: return <Clock size={16} className="me-2" />;
    case OSStatus.AGUARDANDO_CLIENTE: return <UserIcon size={16} className="me-2" />;
    case OSStatus.EM_PRODUCAO: return <Server size={16} className="me-2" />;
    case OSStatus.AGUARDANDO_PARCEIRO: return <Users size={16} className="me-2" />;
    case OSStatus.FINALIZADO: return <CheckCircle2 size={16} className="me-2" />;
    default: return <FileText size={16} className="me-2" />;
  }
};

interface DetailItemProps {
  label: string;
  value?: string | null | boolean | number;
  icon?: React.ReactNode;
  name?: keyof OS;
  isEditableField: boolean;
  children?: React.ReactNode;
  className?: string;
  isEditingMode: boolean;
  os?: OS;
}

const DetailItem = ({ label, value, icon, name, isEditableField, children, className, isEditingMode, os }: DetailItemProps) => {
  let displayValue: string | React.ReactNode = value;

  if (name === 'programadoPara' && typeof value === 'string' && value) {
    try {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseISO(value + 'T00:00:00Z') : parseISO(value);
      if (isValid(date)) {
        displayValue = format(date, "dd/MM/yyyy", { locale: ptBR });
      }
    } catch { /* fallback to original value */ }
  } else if ((name === 'dataAbertura' || name === 'dataFinalizacao' || name === 'dataInicioProducao' || name === 'dataInicioProducaoAtual') && typeof value === 'string' && value) {
    try {
      const date = parseISO(value);
      if (isValid(date)) {
        displayValue = format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
      }
    } catch { /* fallback to original value */ }
  } else if (typeof value === 'boolean') {
    displayValue = value ? 'Sim' : 'Não';
  }

  return (
    <div className={`row py-2 ${className || ''}`}>
      <dt className="col-sm-4 col-lg-3 text-muted d-flex align-items-center small fw-medium">{icon}{label}</dt>
      <dd className="col-sm-8 col-lg-9 mb-0">
        {isEditingMode && isEditableField ? (
          children
        ) : (
          <span className={`form-control-plaintext p-0 text-break ${name === 'observacoes' ? 'text-pre-wrap' : ''}`}>
            {displayValue === undefined || displayValue === null || (typeof displayValue === 'string' && displayValue.trim() === '') ? (
              <span className="text-muted fst-italic">N/A</span>
            ) : (
              displayValue
            )}
          </span>
        )}
      </dd>
    </div>
  );
};

// Helper para formatar datas na seção de detalhes do cronômetro
const formatDetailedDate = (dateString?: string | null): string | React.ReactNode => {
    if (!dateString) return <span className="text-muted fst-italic">N/A</span>;
    try {
        const date = parseISO(dateString);
        if (isValid(date)) {
            return format(date, "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR });
        }
    } catch (e) { /* fallback */ }
    return <span className="text-muted fst-italic">Data inválida</span>;
};

// Componente para exibir a duração da sessão atual do cronômetro
const CurrentSessionDuration: React.FC<{ startTimeISO: string | null }> = ({ startTimeISO }) => {
    const [duration, setDuration] = useState<string>('0s');

    useEffect(() => {
        let intervalId: NodeJS.Timeout | undefined;
        if (startTimeISO) {
            const startDate = parseISO(startTimeISO);
            if (isValid(startDate)) {
                const updateDuration = () => {
                    const now = new Date();
                    const seconds = differenceInSeconds(now, startDate);
                    setDuration(formatDistanceStrict(now, startDate, { locale: ptBR, unit: seconds < 60 ? 's' : (seconds < 3600 ? 'm' : 'h'), addSuffix: false }) || '0s');
                };
                updateDuration(); // Initial call
                intervalId = setInterval(updateDuration, 1000);
            } else {
                setDuration('Início inválido');
            }
        } else {
            setDuration('0s'); // Reset if no start time
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
      return isValid(date) ? format(date, 'yyyy-MM-dd') : '';
    } catch {
      return '';
    }
  }, []);

  const [formData, setFormData] = useState<OS>({
    ...initialOs,
    programadoPara: formatProgramadoParaForInput(initialOs.programadoPara)
  });

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

  useEffect(() => {
    if (!isEditing) {
        setFormData({
            ...initialOs,
            programadoPara: formatProgramadoParaForInput(initialOs.programadoPara),
        });
        setClientInput(initialOs.cliente || '');
        setPartnerInput(initialOs.parceiro || '');
        setSelectedFiles([]);
        setPastedImages([]);
    } else {
        // Quando entra em modo de edição, inicializa o formData com os dados atuais da OS
        // Isso é importante se initialOs foi atualizado pelo store enquanto não estava editando
        setFormData({
            ...initialOs,
            programadoPara: formatProgramadoParaForInput(initialOs.programadoPara),
        });
        setClientInput(initialOs.cliente || '');
        setPartnerInput(initialOs.parceiro || '');
        // Não limpa selectedFiles e pastedImages aqui, para que o usuário não perca o que já adicionou na sessão de edição atual
    }
  }, [initialOs, isEditing, formatProgramadoParaForInput]);


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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (name === 'cliente') {
      setClientInput(value);
      setShowClientSuggestions(!!value && clients.filter(c => c.name.toLowerCase().includes(value.toLowerCase())).length > 0 && document.activeElement === clientInputRef.current);
    } else if (name === 'parceiro') {
      setPartnerInput(value);
      setShowPartnerSuggestions(!!value && partners.filter(p => p.name.toLowerCase().includes(value.toLowerCase())).length > 0 && document.activeElement === partnerInputRef.current);
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : (name === 'programadoPara' ? (value || undefined) : value)
      }));
    }
  };

  const handleClientSelect = (clientName: string) => {
    setClientInput(clientName);
    setShowClientSuggestions(false);
  };

  const handlePartnerSelect = (partnerName: string) => {
    setPartnerInput(partnerName);
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


  const handleSave = async () => {
    setIsSaving(true);
    const dataToSave: OS = {
      ...initialOs, 
      projeto: formData.projeto,
      tarefa: formData.tarefa,
      observacoes: formData.observacoes,
      tempoTrabalhado: formData.tempoTrabalhado,
      status: formData.status,
      programadoPara: formData.programadoPara,
      isUrgent: formData.isUrgent,
      cliente: clientInput.trim(),
      parceiro: partnerInput.trim() || undefined,
      clientId: clients.find(c => c.name === clientInput.trim())?.id || initialOs.clientId,
      partnerId: partners.find(p => p.name === partnerInput.trim())?.id || initialOs.partnerId,
      dataInicioProducaoAtual: initialOs.dataInicioProducaoAtual, 
      tempoGastoProducaoSegundos: initialOs.tempoGastoProducaoSegundos,
      dataInicioProducao: initialOs.dataInicioProducao,
    };
    console.log('[OSDetailsView handleSave] Data para updateOS:', JSON.stringify(dataToSave, null, 2));

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
      console.error("Erro ao salvar OS:", error);
      alert('Erro ao tentar salvar OS. Verifique os logs.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    // O useEffect já lida com o reset do formData para initialOs
  };

  const handleFinalizeOS = async () => {
    if (initialOs.status !== OSStatus.FINALIZADO) {
      setIsSaving(true);
      const success = await updateOSStatus(initialOs.id, OSStatus.FINALIZADO);
      setIsSaving(false);
      if (success) {
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
        router.push('/dashboard');
      } else {
        alert('Falha ao reabrir OS. Verifique logs.');
      }
    }
  };

  const handleToggleTimer = async (action: 'play' | 'pause') => {
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

  useEffect(() => setupClickListener(clientInputRef, clientSuggestionsRef, setShowClientSuggestions), [clientInputRef, clientSuggestionsRef, setupClickListener]);
  useEffect(() => setupClickListener(partnerInputRef, partnerSuggestionsRef, setShowPartnerSuggestions), [partnerInputRef, partnerSuggestionsRef, setupClickListener]);

  const isTimerEffectivelyRunning = initialOs.status === OSStatus.EM_PRODUCAO && !!initialOs.dataInicioProducaoAtual;
  const isFinalized = initialOs.status === OSStatus.FINALIZADO;

  const displayStatus = isEditing ? formData.status : initialOs.status;
  const displayProject = isEditing ? formData.projeto : initialOs.projeto;


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
            <button className="btn btn-info btn-sm" onClick={handleFinalizeOS} disabled={isSaving} title="Finalizar Ordem de Serviço">
              <CheckSquare size={16} className="me-1" /> Finalizar OS
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
        <div className={`card-header p-3 border-bottom d-flex justify-content-between align-items-start ${initialOs.isUrgent && !isEditing ? '' : 'bg-light'}`}>
          <div>
            {isEditing ? (
              <input
                type="text"
                className="form-control form-control-lg mb-1 fw-bold"
                name="projeto"
                value={formData.projeto || ''}
                onChange={handleInputChange}
                placeholder="Nome do Projeto"
                style={{ fontSize: '1.25rem' }}
                required
              />
            ) : (
              <h1 className="card-title h4 mb-1 fw-bold">{initialOs.projeto}</h1>
            )}
            <p className="card-subtitle text-muted mb-0">
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
                      onChange={handleInputChange}
                    />
                    <label className="form-check-label small" htmlFor="isUrgentSwitchHeader">
                      Urgente
                    </label>
                </div>
           )}
        </div>
        <div className="card-body p-4">
          {/* Seção de Detalhes do Cronômetro */}
          <div className="card bg-light-subtle p-3 mb-4 shadow-sm small" style={{ fontSize: '0.85rem' }}>
            <h6 className="card-title text-primary mb-2 d-flex align-items-center">
                <Clock3 size={18} className="me-2" /> Detalhes do Cronômetro
            </h6>
            <dl className="row mb-0">
                {initialOs.dataInicioProducao && (
                    <>
                        <dt className="col-sm-5 text-muted fw-medium">Primeiro Início Produção:</dt>
                        <dd className="col-sm-7 mb-1">{formatDetailedDate(initialOs.dataInicioProducao)}</dd>
                    </>
                )}
                {isTimerEffectivelyRunning && initialOs.dataInicioProducaoAtual && (
                    <>
                        <dt className="col-sm-5 text-muted fw-medium">Início Sessão Atual:</dt>
                        <dd className="col-sm-7 mb-1">{formatDetailedDate(initialOs.dataInicioProducaoAtual)}</dd>
                        <dt className="col-sm-5 text-muted fw-medium">Duração Sessão Atual:</dt>
                        <dd className="col-sm-7 mb-1"><CurrentSessionDuration startTimeISO={initialOs.dataInicioProducaoAtual} /></dd>
                    </>
                )}
                 <dt className="col-sm-5 text-muted fw-medium">Tempo Total em Produção:</dt>
                 <dd className="col-sm-7 mb-0">
                    <ChronometerDisplay
                        startTimeISO={initialOs.dataInicioProducaoAtual}
                        accumulatedSeconds={initialOs.tempoGastoProducaoSegundos}
                        isRunningClientOverride={isTimerEffectivelyRunning}
                    />
                 </dd>
            </dl>
            {!initialOs.dataInicioProducao && !isTimerEffectivelyRunning && initialOs.tempoGastoProducaoSegundos === 0 && (
                 <p className="text-muted fst-italic mt-2 mb-0">O cronômetro ainda não foi iniciado para esta OS.</p>
            )}
             <p className="text-muted fst-italic mt-2 mb-0" style={{ fontSize: '0.75rem' }}>
                Nota: O sistema registra o tempo total acumulado em produção. O histórico detalhado de cada período individual de play/pause não é armazenado.
             </p>
          </div>

          <div className="row">
            <div className="col-md-6">
              <dl className="mb-0">
                <DetailItem
                  label="Cliente"
                  icon={<UserIcon size={16} className="me-2 text-primary" />}
                  name="cliente"
                  isEditableField={true}
                  value={isEditing ? clientInput : initialOs.cliente}
                  isEditingMode={isEditing}
                  os={initialOs}
                >
                  <div className="position-relative">
                    <input
                      ref={clientInputRef}
                      type="text"
                      className="form-control form-control-sm"
                      name="cliente"
                      value={clientInput}
                      onChange={handleInputChange}
                      onFocus={() => setShowClientSuggestions(!!clientInput && filteredClients.length > 0)}
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
                  os={initialOs}
                >
                  <div className="position-relative">
                    <input
                      ref={partnerInputRef}
                      type="text"
                      className="form-control form-control-sm"
                      name="parceiro"
                      value={partnerInput}
                      onChange={handleInputChange}
                      onFocus={() => setShowPartnerSuggestions(!!partnerInput && filteredPartners.length > 0)}
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
                  value={displayStatus}
                  icon={getStatusIcon(displayStatus)}
                  name="status"
                  isEditableField={true}
                  isEditingMode={isEditing}
                  os={initialOs}
                >
                  <select
                    className="form-select form-select-sm"
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
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
                  os={initialOs}
                />

                <DetailItem
                  label="Programado Para"
                  value={isEditing ? formData.programadoPara : initialOs.programadoPara}
                  icon={<CalendarIcon size={16} className="me-2 text-info" />}
                  name="programadoPara"
                  isEditableField={true}
                  isEditingMode={isEditing}
                  os={initialOs}
                >
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    name="programadoPara"
                    value={formData.programadoPara || ''}
                    onChange={handleInputChange}
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
                    os={initialOs}
                  />
                )}
                 <DetailItem
                  label="Urgente"
                  value={isEditing ? formData.isUrgent : initialOs.isUrgent}
                  icon={<Flag size={16} className={`me-2 ${(isEditing ? formData.isUrgent : initialOs.isUrgent) ? 'text-danger' : 'text-secondary'}`} />}
                  name="isUrgent"
                  isEditableField={true}
                  isEditingMode={isEditing}
                  os={initialOs}
                >
                  <div className="form-check form-switch">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      role="switch"
                      id="isUrgentSwitch"
                      name="isUrgent"
                      checked={formData.isUrgent}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                    />
                    <label className="form-check-label small visually-hidden" htmlFor="isUrgentSwitch">
                      {formData.isUrgent ? "Sim" : "Não"}
                    </label>
                  </div>
                </DetailItem>
              </dl>
            </div>
            <div className="col-md-6">
              <dl className="mb-0">
                <div className="row py-2 border-bottom mb-3">
                  <dt className="col-sm-4 col-lg-3 text-muted d-flex align-items-center small fw-medium">
                     Controle do Timer
                  </dt>
                  <dd className="col-sm-8 col-lg-9 mb-0 d-flex align-items-center">
                    {!isEditing && !isFinalized && (
                      <div className="ms-auto d-flex gap-2 no-print">
                        {isTimerEffectivelyRunning ? (
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
                        <span className="text-muted fst-italic">Controles do timer desabilitados em modo de edição ou OS finalizada.</span>
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
                  os={initialOs}
                >
                  <textarea
                    className="form-control form-control-sm"
                    name="tarefa"
                    rows={3}
                    value={formData.tarefa || ''}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    required={isEditing}
                  />
                </DetailItem>

                <DetailItem
                  label="Observações"
                  value={isEditing ? formData.observacoes : initialOs.observacoes}
                  icon={<MessageSquare size={16} className="me-2 text-primary" />}
                  name="observacoes"
                  isEditableField={true}
                  isEditingMode={isEditing}
                  os={initialOs}
                >
                  <textarea
                    className="form-control form-control-sm"
                    name="observacoes"
                    rows={4}
                    value={formData.observacoes || ''}
                    onChange={handleInputChange}
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
                      />
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={!isEditing}
                      >
                        <UploadCloud size={14} className="me-1" /> Adicionar Arquivos
                      </button>
                      <small className="d-block text-muted mt-1">
                        Você também pode colar imagens (Ctrl+V) diretamente no campo de observações.
                      </small>
                      {selectedFiles.length > 0 && (
                        <div className="mt-2">
                          <strong className="small">Arquivos selecionados:</strong>
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
                          <strong className="small">Imagens coladas:</strong>
                          <div className="d-flex flex-wrap gap-2 mt-1">
                            {pastedImages.map((image, index) => (
                              <img
                                key={index}
                                src={image.url}
                                alt={image.name}
                                style={{ maxHeight: '80px', maxWidth: '120px', border: '1px solid #ddd', borderRadius: '4px', objectFit: 'contain' }}
                                title={image.name}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </DetailItem>

                <DetailItem
                  label="Tempo Trabalhado"
                  value={isEditing ? formData.tempoTrabalhado : initialOs.tempoTrabalhado}
                  icon={<Clock3 size={16} className="me-2 text-secondary" />}
                  name="tempoTrabalhado"
                  isEditableField={true}
                  isEditingMode={isEditing}
                  os={initialOs}
                >
                  <textarea
                    className="form-control form-control-sm"
                    name="tempoTrabalhado"
                    rows={3}
                    value={formData.tempoTrabalhado || ''}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    placeholder="Ex: 1h reunião (15/05)&#10;3h código (16/05)&#10;2h ajustes (17/05)"
                  />
                </DetailItem>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

