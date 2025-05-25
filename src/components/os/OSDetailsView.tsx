
'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { OS } from '@/lib/types';
import { isValidDate } from '@/lib/types'; // Import helper
import Link from 'next/link';
import { ArrowLeft, CalendarClock, CheckCircle2, FileText, Flag, Server, User as UserIcon, Users, Briefcase, MessageSquare, Clock3, Save, Edit, Calendar as CalendarIcon, Printer, CheckSquare, Play, Pause, Clock } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
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
}

const DetailItem = ({ label, value, icon, name, isEditableField, children, className, isEditingMode }: DetailItemProps) => {
  let displayValue: string | React.ReactNode = value;
  if ((name === 'programadoPara' || name === 'dataAbertura' || name === 'dataFinalizacao' || name === 'dataInicioProducao' || name === 'dataInicioProducaoAtual') && typeof value === 'string' && value) {
    try {
      const dateStr = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value;
      const date = parseISO(dateStr);
      if (isValidDate(date)) { 
        const formatString = (name === 'programadoPara' && value.length === 10) ? "dd/MM/yyyy" : "dd/MM/yyyy 'às' HH:mm";
        displayValue = format(date, formatString, { locale: ptBR });
      } else {
        displayValue = value; 
      }
    } catch {
      displayValue = value; 
    }
  } else if (typeof value === 'boolean') {
    displayValue = value ? 'Sim' : 'Não';
  } else if (name === 'tempoProducaoMinutos' && typeof value === 'number' && value >= 0) { // Deprecated, but keep for safety if data exists
      const hours = Math.floor(value / 60);
      const minutes = value % 60;
      displayValue = `${hours}h ${minutes}m`;
  }


  return (
    <div className={`row py-2 ${className || ''}`}>
      <dt className="col-sm-3 text-muted d-flex align-items-center small fw-medium">{icon}{label}</dt>
      <dd className="col-sm-9 mb-0">
        {isEditingMode && isEditableField ? (
          children
        ) : (
          <span className={`form-control-plaintext p-0 text-break`}>
              {displayValue === undefined || displayValue === null || displayValue === '' ? <span className="text-muted fst-italic">N/A</span> : displayValue}
          </span>
        )}
      </dd>
    </div>
  );
};


interface OSDetailsViewProps {
  os: OS;
}

export default function OSDetailsView({ os: initialOs }: OSDetailsViewProps) {
  const { updateOS, updateOSStatus, partners, clients, toggleProductionTimer } = useOSStore();

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const formatProgramadoParaForInput = useCallback((isoDate?: string) => {
    if (!isoDate) return '';
    try {
      if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate; // Already YYYY-MM-DD
      const date = parseISO(isoDate);
      return isValidDate(date) ? format(date, 'yyyy-MM-dd') : '';
    } catch {
      return ''; 
    }
  }, []);

  // Initialize formData based on initialOs
  const [formData, setFormData] = useState<OS>({ 
    ...initialOs, 
    programadoPara: formatProgramadoParaForInput(initialOs.programadoPara) 
  });

  // State for controlled inputs for client and partner
  const [clientInput, setClientInput] = useState(initialOs.cliente || '');
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const clientInputRef = useRef<HTMLInputElement>(null);
  const clientSuggestionsRef = useRef<HTMLDivElement>(null);

  const [partnerInput, setPartnerInput] = useState(initialOs.parceiro || '');
  const [showPartnerSuggestions, setShowPartnerSuggestions] = useState(false);
  const partnerInputRef = useRef<HTMLInputElement>(null);
  const partnerSuggestionsRef = useRef<HTMLDivElement>(null);

  // Effect to update formData and inputs when initialOs prop changes (e.g., after save/timer toggle)
  useEffect(() => {
    console.log('[OSDetailsView useEffect] Updating formData from initialOs. ID:', initialOs.id);
    console.log('[OSDetailsView useEffect] initialOs.dataInicioProducaoAtual:', initialOs.dataInicioProducaoAtual);
    console.log('[OSDetailsView useEffect] initialOs.tempoGastoProducaoSegundos:', initialOs.tempoGastoProducaoSegundos);

    setFormData({ 
      ...initialOs, 
      programadoPara: formatProgramadoParaForInput(initialOs.programadoPara) 
    });
    setClientInput(initialOs.cliente || '');
    setPartnerInput(initialOs.parceiro || '');
  }, [initialOs, formatProgramadoParaForInput]);


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
      // Update suggestions visibility immediately
      const newFilteredClients = clients.filter(c => c.name.toLowerCase().includes(value.toLowerCase()));
      setShowClientSuggestions(!!value && newFilteredClients.length > 0 && document.activeElement === clientInputRef.current);
    } else if (name === 'parceiro') {
      setPartnerInput(value);
      const newFilteredPartners = partners.filter(p => p.name.toLowerCase().includes(value.toLowerCase()));
      setShowPartnerSuggestions(!!value && newFilteredPartners.length > 0 && document.activeElement === partnerInputRef.current);
    } else {
      // For other fields, update formData directly
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : (name === 'programadoPara' ? (value || undefined) : value)
      }));
    }
  };
  
  const handleClientSelect = (clientName: string) => {
    setClientInput(clientName); 
    setShowClientSuggestions(false);
    // Optionally, could also update formData.cliente here if needed for validation or other logic
    // setFormData(prev => ({ ...prev, cliente: clientName })); 
  };

  const handlePartnerSelect = (partnerName: string) => {
    setPartnerInput(partnerName); 
    setShowPartnerSuggestions(false);
    // setFormData(prev => ({ ...prev, parceiro: partnerName }));
  };

  const handleSave = async () => {
    console.log('[OSDetailsView handleSave] Attempting to save OS...');
    setIsSaving(true);
    
    // Construct the OS object to save using the latest state values
    const dataToSave: OS = {
      ...formData, // Start with existing formData (includes status, programadoPara, etc.)
      cliente: clientInput.trim(), // Use trimmed value from clientInput state
      parceiro: partnerInput.trim() || undefined, // Use trimmed value from partnerInput state
      // Ensure other fields like tarefa, observacoes, etc., are taken from formData
      tarefa: formData.tarefa || '', 
      observacoes: formData.observacoes || '',
      tempoTrabalhado: formData.tempoTrabalhado || '',
      isUrgent: formData.isUrgent || false,
      // Timer related fields are part of formData and should be passed as is
      // They are updated by the server and then reflected back in initialOs -> formData
    };
    console.log('[OSDetailsView handleSave] Data prepared for updateOS:', JSON.stringify(dataToSave, null, 2));

    try {
      const result = await updateOS(dataToSave); 
      if (result) {
        console.log(`[OSDetailsView handleSave] OS updated successfully:`, result);
        setIsEditing(false); 
      } else {
        console.error("[OSDetailsView handleSave] updateOS returned null or error from store.");
        alert('Falha ao atualizar OS. Verifique os logs.');
      }
    } catch (error) {
      console.error("[OSDetailsView handleSave] Exception during updateOS call:", error);
      alert('Erro ao tentar salvar OS. Verifique os logs.');
    } finally {
      setIsSaving(false);
      console.log('[OSDetailsView handleSave] Save operation finished.');
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    // Reset form data to initialOs values (useEffect will also handle this, but explicit reset is good)
    setFormData({ ...initialOs, programadoPara: formatProgramadoParaForInput(initialOs.programadoPara) });
    setClientInput(initialOs.cliente || '');
    setPartnerInput(initialOs.parceiro || '');
    setShowClientSuggestions(false);
    setShowPartnerSuggestions(false);
  };

  const handleFinalizeOS = async () => {
    console.log(`[OSDetailsView handleFinalizeOS] Attempting to finalize OS ID: ${formData.id}`);
    if (formData.status !== OSStatus.FINALIZADO) {
        setIsSaving(true); 
        const success = await updateOSStatus(formData.id, OSStatus.FINALIZADO);
        if (success) {
            console.log(`[OSDetailsView handleFinalizeOS] OS ${formData.numero} finalized successfully.`);
            // formData will be updated via useEffect when initialOs (from store) changes
        } else {
            console.error(`[OSDetailsView handleFinalizeOS] Failed to finalize OS ${formData.numero}.`);
            alert('Falha ao finalizar OS. Verifique logs.');
        }
        setIsSaving(false);
    } else {
        console.log(`[OSDetailsView handleFinalizeOS] OS ${formData.numero} is already finalized.`);
    }
  };

  const handleToggleTimer = async (action: 'play' | 'pause') => {
    setIsSaving(true);
    console.log(`[OSDetailsView handleToggleTimer] Action: ${action} for OS ID: ${formData.id}`);
    await toggleProductionTimer(formData.id, action);
    // formData will be updated via useEffect when initialOs (from store) changes
    setIsSaving(false);
  };

  const handlePrint = () => {
    console.log('[OSDetailsView handlePrint] Triggering window.print()');
    window.print();
  };

  // Click outside listener for suggestion boxes
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

  // Determine if the timer is considered "running" for UI purposes
  const isTimerEffectivelyRunning = !!formData.dataInicioProducaoAtual;
  const isFinalized = formData.status === OSStatus.FINALIZADO;

  return (
    <div className={`container-fluid os-details-print-container ${formData.isUrgent && !isEditing ? 'os-details-urgent' : ''}`}>
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
            <button className="btn btn-primary btn-sm" onClick={() => setIsEditing(true)} disabled={isFinalized}>
              <Edit size={16} className="me-1" />
              Editar OS
            </button>
          )}
           {!isEditing && !isFinalized && (
             <button className="btn btn-info btn-sm" onClick={handleFinalizeOS} disabled={isSaving} title="Finalizar Ordem de Serviço">
               <CheckSquare size={16} className="me-1" /> Finalizar OS
             </button>
           )}
          <button className="btn btn-outline-dark btn-sm" onClick={handlePrint} title="Imprimir Ordem de Serviço">
            <Printer size={16} className="me-1" /> Imprimir OS
          </button>
        </div>
      </div>

      <div className={`card shadow-lg mb-4`}>
        <div className={`card-header p-3 border-bottom d-flex justify-content-between align-items-start ${formData.isUrgent && !isEditing ? '' : 'bg-light'}`}>
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
                disabled={!isEditing}
              />
            ) : (
              <h1 className="card-title h4 mb-1 fw-bold">{formData.projeto}</h1>
            )}
            <p className="card-subtitle text-muted mb-0">
              Ordem de Serviço: {initialOs.numero}
            </p>
          </div>
          {formData.isUrgent && !isEditing && (
            <span className="badge bg-danger text-white fs-6 px-3 py-1 d-flex align-items-center shadow-sm">
              <Flag size={16} className="me-1" /> URGENTE
            </span>
          )}
        </div>
        <div className="card-body p-4">
          <dl className="mb-0">
            {/* Timer Controls and Display */}
            <div className="row py-2 border-bottom mb-3">
                <dt className="col-sm-3 text-muted d-flex align-items-center small fw-medium">
                    <Clock3 size={16} className="me-2 text-primary" />
                    Tempo em Produção
                </dt>
                <dd className="col-sm-9 mb-0 d-flex align-items-center">
                    <ChronometerDisplay 
                        startTimeISO={formData.dataInicioProducaoAtual} 
                        accumulatedSeconds={formData.tempoGastoProducaoSegundos}
                        isRunningClientOverride={isTimerEffectivelyRunning} // Use effective running state
                    />
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
                </dd>
            </div>

            <DetailItem
              label="Cliente"
              icon={<UserIcon size={16} className="me-2 text-primary" />}
              name="cliente"
              isEditableField={true}
              value={clientInput} 
              isEditingMode={isEditing}
            >
              <div className="position-relative">
                <input
                  ref={clientInputRef}
                  type="text"
                  className="form-control form-control-sm"
                  name="cliente" // Not strictly needed as clientInput is separate, but good for consistency
                  value={clientInput} 
                  onChange={handleInputChange} 
                  onFocus={() => setShowClientSuggestions(!!clientInput && filteredClients.length > 0)}
                  // onBlur handled by clickOutside listener
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
              value={partnerInput} 
              isEditingMode={isEditing}
            >
              <div className="position-relative">
                <input
                  ref={partnerInputRef}
                  type="text"
                  className="form-control form-control-sm"
                  name="parceiro" // Not strictly needed
                  value={partnerInput} 
                  onChange={handleInputChange} 
                  onFocus={() => setShowPartnerSuggestions(!!partnerInput && filteredPartners.length > 0)}
                  // onBlur handled by clickOutside listener
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
              value={formData.status}
              icon={getStatusIcon(formData.status)}
              name="status"
              isEditableField={true}
              isEditingMode={isEditing}
            >
              <select
                className="form-select form-select-sm"
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                disabled={!isEditing || isFinalized} // Disable if OS is finalized, even in edit mode
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
              value={initialOs.dataAbertura} // Always show original opening date
              icon={<CalendarClock size={16} className="me-2 text-secondary" />}
              name="dataAbertura"
              isEditableField={false}
              isEditingMode={isEditing}
            />

            <DetailItem
              label="Programado Para"
              value={formData.programadoPara} 
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
                onChange={handleInputChange}
                disabled={!isEditing}
              />
            </DetailItem>
            
            { (formData.dataInicioProducao || initialOs.dataInicioProducao ) &&
                <DetailItem
                  label="Primeiro Início Produção"
                  value={formData.dataInicioProducao || initialOs.dataInicioProducao}
                  icon={<Clock3 size={16} className="me-2 text-info" />}
                  name="dataInicioProducao" 
                  isEditableField={false}
                  isEditingMode={isEditing}
                />
            }

            {(formData.status === OSStatus.FINALIZADO || initialOs.dataFinalizacao) && (
              <DetailItem
                label="Data de Finalização"
                value={formData.dataFinalizacao || initialOs.dataFinalizacao}
                icon={<CheckCircle2 size={16} className="me-2 text-success" />}
                name="dataFinalizacao"
                isEditableField={false}
                isEditingMode={isEditing}
              />
            )}
            
            <DetailItem
              label="Tarefa Principal"
              value={formData.tarefa}
              icon={<Briefcase size={16} className="me-2 text-primary" />}
              name="tarefa"
              isEditableField={true}
              isEditingMode={isEditing}
              className="border-top pt-3 mt-3"
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
              value={formData.observacoes}
              icon={<MessageSquare size={16} className="me-2 text-primary" />}
              name="observacoes"
              isEditableField={true}
              isEditingMode={isEditing}
            >
              <textarea
                className="form-control form-control-sm"
                name="observacoes"
                rows={4}
                value={formData.observacoes || ''}
                onChange={handleInputChange}
                disabled={!isEditing}
              />
            </DetailItem>

            <DetailItem
              label="Tempo Trabalhado (Manual)"
              value={formData.tempoTrabalhado}
              icon={<Clock3 size={16} className="me-2 text-secondary" />}
              name="tempoTrabalhado"
              isEditableField={true}
              isEditingMode={isEditing}
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

            <DetailItem
              label="Urgente"
              value={formData.isUrgent}
              icon={<Flag size={16} className={`me-2 ${formData.isUrgent ? 'text-danger' : 'text-secondary'}`} />}
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
      </div>
    </div>
  );
}
