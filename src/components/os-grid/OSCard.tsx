
'use client';

import Link from 'next/link';
import type { OS } from '@/lib/types';
import { OSStatus, ALL_OS_STATUSES } from '@/lib/types';
import { CalendarClock, Flag, Copy, AlertTriangle, CheckCircle2, Server, Users, FileText, User as UserIcon, Briefcase, Calendar as CalendarIcon, CheckSquare, Play, Pause, ClockIcon as Clock } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useOSStore } from '@/store/os-store';
import { useTheme } from '@/hooks/useTheme';
import React, { useMemo, useState } from 'react';
import ChronometerDisplay from '@/components/os/ChronometerDisplay';


interface OSCardProps {
  os: OS;
}

const getStatusClass = (status: OSStatus, isUrgent: boolean, theme: 'light' | 'dark'): string => {
  if (isUrgent) {
    return theme === 'dark' ? 'border-danger text-danger-emphasis bg-danger-subtle' : 'border-danger text-danger-emphasis bg-danger-subtle';
  }
  switch (status) {
    case OSStatus.NA_FILA: return 'border-secondary text-secondary-emphasis';
    case OSStatus.AGUARDANDO_CLIENTE: return 'border-warning text-warning-emphasis';
    case OSStatus.EM_PRODUCAO: return `border-info text-info-emphasis`;
    case OSStatus.AGUARDANDO_PARCEIRO: return `border-primary text-primary-emphasis`;
    case OSStatus.FINALIZADO: return 'border-success text-success-emphasis';
    default: return 'border-secondary text-secondary-emphasis';
  }
};

// getStatusIcon é usado pelo select, não precisa mudar
const getStatusIcon = (status: OSStatus) => {
  switch (status) {
    case OSStatus.NA_FILA: return <Clock size={14} className="me-1" />;
    case OSStatus.AGUARDANDO_CLIENTE: return <UserIcon size={14} className="me-1" />;
    case OSStatus.EM_PRODUCAO: return <Server size={14} className="me-1" />;
    case OSStatus.AGUARDANDO_PARCEIRO: return <Users size={14} className="me-1" />;
    case OSStatus.FINALIZADO: return <CheckCircle2 size={14} className="me-1" />;
    default: return <FileText size={14} className="me-1" />;
  }
};

export default function OSCard({ os }: OSCardProps) {
  const { updateOSStatus, toggleUrgent, duplicateOS, toggleProductionTimer } = useOSStore();
  const { theme } = useTheme();
  const [isUpdating, setIsUpdating] = useState(false); // For disabling buttons during async ops

  const statusThemeClasses = getStatusClass(os.status, os.isUrgent, theme);
  const cardClasses = `card h-100 shadow-sm border-start border-4 ${statusThemeClasses} transition-shadow duration-200 ease-in-out`;
  const hoverEffectClass = "hover-lift";

  const handleStatusChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = event.target.value as OSStatus;
    event.preventDefault(); 
    event.stopPropagation();
    setIsUpdating(true);
    try {
      console.log(`[OSCard] Status change initiated for OS ${os.id} to ${newStatus}`);
      await updateOSStatus(os.id, newStatus);
      console.log(`[OSCard] OS "${os.projeto}" status update call finished for ${newStatus}.`);
    } catch (error) {
      console.error(`[OSCard] Falha ao atualizar status da OS ${os.id}:`, error);
      // Add user feedback here if needed
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleUrgent = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setIsUpdating(true);
    console.log(`[OSCard] Toggling urgent for OS ${os.id}`);
    await toggleUrgent(os.id);
    setIsUpdating(false);
  };

  const handleDuplicateOS = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setIsUpdating(true);
    console.log(`[OSCard] Duplicating OS ${os.id}`);
    await duplicateOS(os.id);
    setIsUpdating(false);
  };

  const handleFinalizeOS = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (os.status !== OSStatus.FINALIZADO) {
      setIsUpdating(true);
      try {
        console.log(`[OSCard] Finalizing OS ${os.id} directly from card.`);
        await updateOSStatus(os.id, OSStatus.FINALIZADO);
      } catch (error) {
        console.error(`[OSCard] Falha ao finalizar OS ${os.id} do card:`, error);
      } finally {
        setIsUpdating(false);
      }
    }
  };

  const handleToggleTimer = async (e: React.MouseEvent, action: 'play' | 'pause') => {
    e.preventDefault(); e.stopPropagation();
    setIsUpdating(true);
    console.log(`[OSCard] Toggling timer for OS ${os.id}, action: ${action}`);
    await toggleProductionTimer(os.id, action);
    setIsUpdating(false);
  };

  const truncateText = (text: string | undefined | null, maxLength: number = 50): string => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  const formattedProgramadoPara = useMemo(() => {
      if (!os.programadoPara) return null;
      try {
          // Check if it's YYYY-MM-DD, then parse as UTC to avoid timezone shifts for date-only strings
          const date = /^\d{4}-\d{2}-\d{2}$/.test(os.programadoPara) 
            ? parseISO(os.programadoPara + 'T00:00:00Z') 
            : parseISO(os.programadoPara);

          if (isValid(date)) {
              return format(date, "dd/MM/yy", { locale: ptBR });
          }
      } catch (e) {
        console.warn(`[OSCard] Error parsing programadoPara date "${os.programadoPara}":`, e);
      }
      return os.programadoPara; // Fallback to original string if parsing fails
  }, [os.programadoPara]);

  const isTimerRunning = !!os.dataInicioProducaoAtual;

  return (
    <Link href={`/os/${os.id}`} passHref legacyBehavior>
        <a className={`text-decoration-none text-reset d-block h-100 ${hoverEffectClass}`}>
            <div className={cardClasses}>
                <div className={`card-header p-2 pb-1 d-flex justify-content-between align-items-center ${os.isUrgent && theme === 'light' ? 'bg-danger-subtle' : (os.isUrgent && theme === 'dark' ? 'bg-danger-subtle' : '')}`}>
                    <span className="fw-bold text-primary small font-monospace">OS: {os.numero}</span>
                    {os.isUrgent && (
                        <span className={`badge ${theme === 'dark' ? 'bg-danger text-white' : 'bg-danger text-white'} rounded-pill px-2 py-1 small d-flex align-items-center ms-auto`} style={{fontSize: '0.7em'}}>
                            <AlertTriangle size={12} className="me-1" /> URGENTE
                        </span>
                    )}
                </div>
                <div className={`card-body p-2 pt-1 pb-2 d-flex flex-column text-wrap ${os.isUrgent && theme === 'light' ? 'bg-danger-subtle' : (os.isUrgent && theme === 'dark' ? 'bg-danger-subtle' : '')}`}>
                    <div className="mb-1" title={`Cliente: ${os.cliente}`}>
                        <UserIcon size={14} className="me-1 text-muted align-middle" />
                        <span className="fw-medium small text-break">{truncateText(os.cliente, 30)}</span>
                    </div>
                    {os.parceiro && (
                        <div className="mb-1" title={`Parceiro: ${os.parceiro}`}>
                            <Users size={14} className="me-1 text-muted align-middle" />
                            <span className="text-muted small text-break">{truncateText(os.parceiro, 30)}</span>
                        </div>
                    )}
                    <div className="mb-2" title={`Tarefa: ${os.tarefa}`}>
                        <Briefcase size={14} className="me-1 text-muted align-middle" />
                        <span className="small text-muted fst-italic text-break">{truncateText(os.tarefa, 40)}</span>
                    </div>

                    <div className="mt-auto pt-1 border-top">
                        <div className="text-muted small d-flex align-items-center mb-1">
                             <CalendarClock size={14} className="me-1 flex-shrink-0" />
                             <span className="text-truncate" title={`Aberto em: ${isValid(parseISO(os.dataAbertura)) ? format(parseISO(os.dataAbertura), "dd/MM/yyyy HH:mm:ss", { locale: ptBR }) : 'Data inválida'}`}>
                                Aberto em: {isValid(parseISO(os.dataAbertura)) ? format(parseISO(os.dataAbertura), "dd/MM/yy HH:mm", { locale: ptBR }) : 'N/A'}
                             </span>
                        </div>
                        {formattedProgramadoPara && (
                            <div className="text-muted small d-flex align-items-center mb-2" title="Data programada">
                                <CalendarIcon size={14} className="me-1 flex-shrink-0 text-info" />
                                <span className="text-truncate">
                                    Programado: {formattedProgramadoPara}
                                </span>
                            </div>
                        )}
                         <div className="mb-2">
                            <ChronometerDisplay
                                startTimeISO={os.dataInicioProducaoAtual}
                                accumulatedSeconds={os.tempoGastoProducaoSegundos}
                                isRunningClientOverride={os.status === OSStatus.EM_PRODUCAO && !!os.dataInicioProducaoAtual}
                            />
                        </div>
                    </div>

                    <div className="mb-2">
                         <select
                            className={`form-select form-select-sm ${statusThemeClasses.replace('text-', 'border-').replace('bg-danger-subtle', '')}`}
                            value={os.status}
                            onChange={handleStatusChange}
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} 
                            aria-label="Mudar status da OS"
                            style={{ fontSize: '0.75rem' }}
                            disabled={isUpdating}
                        >
                            {ALL_OS_STATUSES.map(s => (
                            <option key={s} value={s}>
                                {s}
                            </option>
                            ))}
                        </select>
                    </div>
                </div>
                 <div className={`card-footer p-2 border-top ${theme === 'dark' ? 'bg-dark-subtle' : 'bg-light-subtle'}`}>
                    <div className="d-flex flex-column gap-1">
                        {os.status !== OSStatus.FINALIZADO && (
                             <button
                                className="btn btn-success btn-sm w-100 d-flex align-items-center justify-content-center"
                                onClick={handleFinalizeOS}
                                style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                                disabled={isUpdating}
                                title="Finalizar Ordem de Serviço"
                            >
                                <CheckSquare size={14} className="me-1" /> Finalizar OS
                            </button>
                        )}
                         <div className="d-flex gap-1 mb-1">
                            {isTimerRunning ? (
                                <button
                                    className="btn btn-warning btn-sm flex-grow-1 d-flex align-items-center justify-content-center"
                                    onClick={(e) => handleToggleTimer(e, 'pause')}
                                    disabled={isUpdating}
                                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                                    title="Pausar cronômetro de produção"
                                >
                                    <Pause size={14} className="me-1" /> Pausar Timer
                                </button>
                            ) : (
                                <button
                                    className="btn btn-info btn-sm flex-grow-1 d-flex align-items-center justify-content-center"
                                    onClick={(e) => handleToggleTimer(e, 'play')}
                                    disabled={isUpdating || os.status === OSStatus.FINALIZADO}
                                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                                    title="Iniciar cronômetro de produção (define status para Em Produção)"
                                >
                                    <Play size={14} className="me-1" /> Iniciar Timer
                                </button>
                            )}
                        </div>
                        <div className="d-flex gap-1">
                            <button
                                className={`btn ${os.isUrgent ? 'btn-danger' : 'btn-outline-danger'} btn-sm flex-grow-1 d-flex align-items-center justify-content-center`}
                                onClick={handleToggleUrgent}
                                style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                                disabled={isUpdating}
                                title={os.isUrgent ? "Desmarcar como Urgente" : "Marcar como Urgente"}
                            >
                                <Flag size={14} className="me-1" /> {os.isUrgent ? "Desm. Urgente" : "Marcar Urgente"}
                            </button>
                            <button
                                className="btn btn-outline-secondary btn-sm flex-grow-1 d-flex align-items-center justify-content-center"
                                onClick={handleDuplicateOS}
                                style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                                disabled={isUpdating}
                                title="Duplicar Ordem de Serviço"
                            >
                                <Copy size={14} className="me-1" /> Duplicar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </a>
    </Link>
  );
}
