
'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { OS } from '@/lib/types';
import Link from 'next/link';
import { ArrowLeft, CalendarClock, CheckCircle2, Clock, FileText, Flag, Server, User as UserIcon, Users, Briefcase, MessageSquare, Clock3, Save, Edit, Calendar as CalendarIcon, Printer, CheckSquare } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useOSStore } from '@/store/os-store';
// Client and Partner types are imported by useOSStore or OS type
import { OSStatus, ALL_OS_STATUSES } from '@/lib/types';

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
  if ((name === 'programadoPara' || name === 'dataAbertura' || name === 'dataFinalizacao' || name === 'dataInicioProducao') && typeof value === 'string' && value) {
    try {
      // Ensure the date string is treated as UTC if no timezone info is present, especially for YYYY-MM-DD
      const dateStr = value.includes('T') ? value : (value.length === 10 ? `${value}T00:00:00Z` : value);
      const date = parseISO(dateStr);
      if (isValid(date)) {
        // For programadoPara (YYYY-MM-DD), only show date. Otherwise, show date and time.
        const formatString = (name === 'programadoPara' && value.length === 10) ? "dd/MM/yyyy" : "dd/MM/yyyy 'às' HH:mm";
        displayValue = format(date, formatString, { locale: ptBR });
      } else {
        displayValue = value; // Display as is if not a valid date string
      }
    } catch {
      displayValue = value; // Fallback
    }
  } else if (typeof value === 'boolean') {
    displayValue = value ? 'Sim' : 'Não';
  } else if (name === 'tempoProducaoMinutos' && typeof value === 'number' && value >= 0) {
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
  const updateOS = useOSStore((state) => state.updateOS);
  const updateOSStatus = useOSStore((state) => state.updateOSStatus);
  const partners = useOSStore((state) => state.partners);
  const clients = useOSStore((state) => state.clients);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Ensure programadoPara is always YYYY-MM-DD for the date input
  const formatProgramadoParaForInput = (isoDate?: string) => {
    if (!isoDate) return '';
    try {
      return format(parseISO(isoDate), 'yyyy-MM-dd');
    } catch {
      return ''; // Or handle error, return original if not parsable
    }
  };

  const [formData, setFormData] = useState<OS>({ ...initialOs, programadoPara: formatProgramadoParaForInput(initialOs.programadoPara) });

  const [clientInput, setClientInput] = useState(initialOs.cliente || '');
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const clientInputRef = useRef<HTMLInputElement>(null);

  const [partnerInput, setPartnerInput] = useState(initialOs.parceiro || '');
  const [showPartnerSuggestions, setShowPartnerSuggestions] = useState(false);
  const partnerInputRef = useRef<HTMLInputElement>(null);


  useEffect(() => {
    // This effect updates the form when initialOs changes (e.g., after a save or if navigating between OS pages)
    // or when toggling edit mode to reset to initialOs values.
    console.log('[OSDetailsView useEffect] Updating formData. isEditing:', isEditing, 'initialOs.id:', initialOs.id);
    setFormData({ ...initialOs, programadoPara: formatProgramadoParaForInput(initialOs.programadoPara) });
    setClientInput(initialOs.cliente || '');
    setPartnerInput(initialOs.parceiro || '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOs]); // Removed isEditing from deps to prevent reset just on mode toggle if initialOs hasn't changed.
                  // Re-added initialOs to re-populate form if the underlying OS data changes from store.


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
    console.log(`[OSDetailsView handleInputChange] Name: ${name}, Value: ${value}, Type: ${type}`);

    setFormData(prev => {
      let newValue: any = value;
      if (type === 'checkbox') {
        newValue = (e.target as HTMLInputElement).checked;
      } else if (name === 'cliente') {
        setClientInput(value); // Update clientInput for suggestions
        // Do not set formData.cliente here directly, it will be set by handleClientSelect or on save
         setShowClientSuggestions(!!value && clients.filter(c => c.name.toLowerCase().includes(value.toLowerCase())).length > 0 && document.activeElement === clientInputRef.current);
      } else if (name === 'parceiro') {
        setPartnerInput(value); // Update partnerInput for suggestions
        // Do not set formData.parceiro here directly
        setShowPartnerSuggestions(!!value && partners.filter(p => p.name.toLowerCase().includes(value.toLowerCase())).length > 0 && document.activeElement === partnerInputRef.current);
        newValue = value || undefined; // Keep this for formData if needed, but prefer partnerInput for save
      } else if (name === 'programadoPara') {
        newValue = value || undefined; // Store YYYY-MM-DD
      }
      return { ...prev, [name]: newValue };
    });
  };

  const handleClientSelect = (clientName: string) => {
    console.log(`[OSDetailsView handleClientSelect] Selected: ${clientName}`);
    setClientInput(clientName); // This will be used on save
    setFormData(prev => ({ ...prev, cliente: clientName })); // Also update formData for visual consistency if needed
    setShowClientSuggestions(false);
  };

  const handlePartnerSelect = (partnerName: string) => {
    console.log(`[OSDetailsView handlePartnerSelect] Selected: ${partnerName}`);
    setPartnerInput(partnerName); // This will be used on save
    setFormData(prev => ({ ...prev, parceiro: partnerName })); // Also update formData for visual consistency
    setShowPartnerSuggestions(false);
  };

  const handleSave = async () => {
    console.log('[OSDetailsView handleSave] Attempting to save OS...');
    setIsSaving(true);
    
    const dataToSave: OS = {
      ...formData,
      cliente: clientInput.trim(), // Use the latest from clientInput
      parceiro: partnerInput.trim() || undefined, // Use the latest from partnerInput
      // programadoPara should already be in YYYY-MM-DD from formData state
    };
    console.log('[OSDetailsView handleSave] Data being sent to store updateOS:', JSON.stringify(dataToSave, null, 2));

    try {
      const result = await updateOS(dataToSave); 
      if (result) {
        console.log(`[OSDetailsView handleSave] OS successfully updated via store. Result:`, JSON.stringify(result,null,2));
        setIsEditing(false);
      } else {
        console.error("[OSDetailsView handleSave] Store updateOS returned null or error.");
        alert('Falha ao atualizar OS. Verifique os logs do console e do servidor.');
      }
    } catch (error) {
      console.error("[OSDetailsView handleSave] Exception during store updateOS call:", error);
      alert('Erro ao tentar salvar OS. Verifique os logs.');
    } finally {
      setIsSaving(false);
      console.log('[OSDetailsView handleSave] Save operation finished.');
    }
  };

  const handleCancel = () => {
    console.log('[OSDetailsView handleCancel] Cancelling edit.');
    // Reset form to initialOs values
    setFormData({ ...initialOs, programadoPara: formatProgramadoParaForInput(initialOs.programadoPara) });
    setClientInput(initialOs.cliente || '');
    setPartnerInput(initialOs.parceiro || '');
    setShowClientSuggestions(false);
    setShowPartnerSuggestions(false);
    setIsEditing(false);
  };

  const handleFinalizeOS = async () => {
    console.log(`[OSDetailsView handleFinalizeOS] Attempting to finalize OS ID: ${formData.id}`);
    if (formData.status !== OSStatus.FINALIZADO) {
        setIsSaving(true); // Indicate an operation is in progress
        const success = await updateOSStatus(formData.id, OSStatus.FINALIZADO);
        if (success) {
            console.log(`[OSDetailsView handleFinalizeOS] OS ${formData.numero} finalized successfully via store.`);
            // State should update via store subscription after successful DB update
            // setIsEditing(false); // Optionally exit edit mode if finalizing
        } else {
            console.error(`[OSDetailsView handleFinalizeOS] Failed to finalize OS ${formData.numero} via store.`);
            alert('Falha ao finalizar OS. Verifique o console e os logs do servidor.');
        }
        setIsSaving(false);
    } else {
        console.log(`[OSDetailsView handleFinalizeOS] OS ${formData.numero} is already finalized.`);
    }
  };

  const handlePrint = () => {
    console.log('[OSDetailsView handlePrint] Triggering window.print()');
    window.print();
  };

  // Click outside listener for suggestion boxes
  const setupClickListener = (
    inputRef: React.RefObject<HTMLInputElement>,
    suggestionBoxRef: React.RefObject<HTMLDivElement>, // Ref for the suggestion box itself
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
  };

  const clientSuggestionsRef = useRef<HTMLDivElement>(null);
  const partnerSuggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => setupClickListener(clientInputRef, clientSuggestionsRef, setShowClientSuggestions), [clientInputRef, clientSuggestionsRef]);
  useEffect(() => setupClickListener(partnerInputRef, partnerSuggestionsRef, setShowPartnerSuggestions), [partnerInputRef, partnerSuggestionsRef]);


  return (
    <div className={`container-fluid os-details-print-container ${formData.isUrgent && !isEditing ? 'os-details-urgent' : ''}`}>
      <div className="mb-4 d-flex justify-content-between align-items-center flex-wrap gap-2 no-print">
        <Link href="/dashboard" className="btn btn-outline-secondary btn-sm">
          <ArrowLeft className="me-2" size={16} /> Voltar ao Painel
        </Link>
        <div className="d-flex gap-2 flex-wrap">
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
            <button className="btn btn-primary btn-sm" onClick={() => setIsEditing(true)}>
              <Edit size={16} className="me-1" />
              Editar OS
            </button>
          )}
           {!isEditing && formData.status !== OSStatus.FINALIZADO && (
             <button className="btn btn-info btn-sm" onClick={handleFinalizeOS} disabled={isSaving}>
               <CheckSquare size={16} className="me-1" /> Finalizar OS
             </button>
           )}
          <button className="btn btn-outline-dark btn-sm" onClick={handlePrint}>
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
            <DetailItem
              label="Cliente"
              icon={<UserIcon size={16} className="me-2 text-primary" />}
              name="cliente"
              isEditableField={true}
              value={isEditing ? clientInput : formData.cliente} // Show clientInput while editing for suggestions
              isEditingMode={isEditing}
            >
              <div className="position-relative">
                <input
                  ref={clientInputRef}
                  type="text"
                  className="form-control form-control-sm"
                  name="cliente"
                  value={clientInput} // Controlled by clientInput state
                  onChange={handleInputChange} // Will update clientInput
                  onFocus={() => setShowClientSuggestions(!!clientInput && filteredClients.length > 0)}
                  // onBlurCapture handled by document mousedown listener
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
              value={isEditing ? partnerInput : formData.parceiro} // Show partnerInput while editing
              isEditingMode={isEditing}
            >
              <div className="position-relative">
                <input
                  ref={partnerInputRef}
                  type="text"
                  className="form-control form-control-sm"
                  name="parceiro"
                  value={partnerInput} // Controlled by partnerInput state
                  onChange={handleInputChange} // Will update partnerInput
                  onFocus={() => setShowPartnerSuggestions(!!partnerInput && filteredPartners.length > 0)}
                  // onBlurCapture handled by document mousedown listener
                  autoComplete="off"
                  placeholder="Digite ou selecione um parceiro"
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
                disabled={!isEditing}
              >
                {ALL_OS_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
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
              value={formData.programadoPara} // This is already YYYY-MM-DD for input, or formatted ISO for display
              icon={<CalendarIcon size={16} className="me-2 text-info" />}
              name="programadoPara"
              isEditableField={true}
              isEditingMode={isEditing}
            >
              <input
                type="date"
                className="form-control form-control-sm"
                name="programadoPara"
                value={formData.programadoPara || ''} // Should be YYYY-MM-DD
                onChange={handleInputChange}
                disabled={!isEditing}
              />
            </DetailItem>

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
            {((formData.status === OSStatus.EM_PRODUCAO || formData.status === OSStatus.FINALIZADO) && (formData.dataInicioProducao || initialOs.dataInicioProducao)) && (
                <DetailItem
                  label="Início Produção"
                  value={formData.dataInicioProducao || initialOs.dataInicioProducao}
                  icon={<Clock3 size={16} className="me-2 text-info" />}
                  name="dataInicioProducao"
                  isEditableField={false}
                  isEditingMode={isEditing}
                />
            )}
            {formData.status === OSStatus.FINALIZADO && (formData.tempoProducaoMinutos !== undefined && formData.tempoProducaoMinutos >= 0) && (
                <DetailItem
                  label="Tempo de Produção"
                  value={formData.tempoProducaoMinutos}
                  icon={<Clock3 size={16} className="me-2 text-success" />}
                  name="tempoProducaoMinutos"
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
                required={isEditing} // Only required if editing
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
              label="Tempo Trabalhado"
              value={formData.tempoTrabalhado}
              icon={<Clock3 size={16} className="me-2 text-primary" />}
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
