
'use client';

import Link from 'next/link';
import type { OS } from '@/lib/types';
import { OSStatus, ALL_OS_STATUSES } from '@/lib/types';
import { CalendarClock, Flag, Copy, AlertTriangle, CheckCircle2, Server, Users, FileText, User as UserIcon, Briefcase, Calendar as CalendarIcon, CheckSquare, Play, Pause, Clock, UserCheck, HelpCircle, AlertOctagon, ThumbsUp, ThumbsDown } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useOSStore } from '@/store/os-store';
import { useTheme } from '@/hooks/useTheme';
import { useSession } from '@/hooks/useSession';
import React, { useMemo, useState } from 'react';
import ChronometerDisplay from '@/components/os/ChronometerDisplay';
import { useSettingsStore } from '@/store/settings-store';


interface OSCardProps {
  os: OS;
  viewMode?: 'admin' | 'partner';
}

const getStatusClass = (status: OSStatus, isUrgent: boolean, theme: 'light' | 'dark'): string => {
  if (isUrgent && status !== OSStatus.AGUARDANDO_APROVACAO && status !== OSStatus.RECUSADA) {
    return 'border-danger bg-danger-subtle text-danger-emphasis';
  }
  switch (status) {
    case OSStatus.NA_FILA: return 'border-secondary bg-secondary-subtle text-secondary-emphasis';
    case OSStatus.AGUARDANDO_CLIENTE: return 'border-warning bg-warning-subtle text-warning-emphasis';
    case OSStatus.EM_PRODUCAO: return `border-info bg-info-subtle text-info-emphasis`;
    case OSStatus.AGUARDANDO_PARCEIRO: return `border-primary bg-primary-subtle text-primary-emphasis`;
    case OSStatus.AGUARDANDO_APROVACAO: return 'border-warning bg-warning-subtle text-warning-emphasis';
    case OSStatus.RECUSADA: return 'border-danger bg-danger-subtle text-danger-emphasis';
    case OSStatus.FINALIZADO: return 'border-success bg-success-subtle text-success-emphasis';
    default: return 'border-light bg-light text-dark';
  }
};

const getStatusSelectClasses = (status: OSStatus, isUrgent: boolean, theme: 'light' | 'dark'): string => {
  if (isUrgent && status !== OSStatus.AGUARDANDO_APROVACAO && status !== OSStatus.RECUSADA) {
    return 'border-danger text-danger-emphasis bg-danger-subtle';
  }
   switch (status) {
    case OSStatus.NA_FILA: return 'border-secondary text-secondary-emphasis bg-body';
    case OSStatus.AGUARDANDO_CLIENTE: return 'border-warning text-warning-emphasis bg-body';
    case OSStatus.EM_PRODUCAO: return `border-info text-info-emphasis bg-body`;
    case OSStatus.AGUARDANDO_PARCEIRO: return `border-primary text-primary-emphasis bg-body`;
    case OSStatus.AGUARDANDO_APROVACAO: return 'border-warning text-warning-emphasis bg-body';
    case OSStatus.RECUSADA: return 'border-danger text-danger-emphasis bg-body';
    case OSStatus.FINALIZADO: return 'border-success text-success-emphasis bg-body';
    default: return 'border-light text-dark bg-body';
  }
}

const getStatusIcon = (status: OSStatus) => {
  switch (status) {
    case OSStatus.NA_FILA: return <Clock size={14} className="me-1" />;
    case OSStatus.AGUARDANDO_CLIENTE: return <UserIcon size={14} className="me-1" />;
    case OSStatus.EM_PRODUCAO: return <Server size={14} className="me-1" />;
    case OSStatus.AGUARDANDO_PARCEIRO: return <Users size={14} className="me-1" />;
    case OSStatus.AGUARDANDO_APROVACAO: return <HelpCircle size={14} className="me-1 text-warning" />;
    case OSStatus.RECUSADA: return <AlertOctagon size={14} className="me-1 text-danger" />;
    case OSStatus.FINALIZADO: return <CheckCircle2 size={14} className="me-1" />;
    default: return <FileText size={14} className="me-1" />;
  }
};

export default function OSCard({ os, viewMode = 'admin' }: OSCardProps) {
  const { updateOSStatus, toggleUrgent, duplicateOS, toggleProductionTimer } = useOSStore();
  const { theme } = useTheme();
  const session = useSession();
  const { showChronometer } = useSettingsStore();
  const [isUpdating, setIsUpdating] = useState(false);

  const statusCardClasses = getStatusClass(os.status, os.isUrgent, theme);
  const statusSelectClasses = getStatusSelectClasses(os.status, os.isUrgent, theme);

  const cardClasses = `card h-100 shadow-sm border-start border-4 ${statusCardClasses} transition-shadow duration-200 ease-in-out`;
  const hoverEffectClass = "hover-lift";

  const handleStatusChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = event.target.value as OSStatus;
    event.preventDefault();
    event.stopPropagation();
    setIsUpdating(true);
    try {
      const adminUsername = session && session.sessionType === 'admin' ? session.username : undefined;
      await updateOSStatus(os.id, newStatus, adminUsername);
    } catch (error) {
    } finally {
      setIsUpdating(false);
    }
  };

  const handleApprovalAction = async (e: React.MouseEvent, approved: boolean) => {
    e.preventDefault(); e.stopPropagation();
    if (os.status !== OSStatus.AGUARDANDO_APROVACAO || !session || session.sessionType !== 'admin') return;
    setIsUpdating(true);
    try {
        const newStatus = approved ? OSStatus.NA_FILA : OSStatus.RECUSADA;
        await updateOSStatus(os.id, newStatus, session.username);
    } finally {
        setIsUpdating(false);
    }
  };


  const handleToggleUrgent = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setIsUpdating(true);
    try {
        await toggleUrgent(os.id);
    } finally {
        setIsUpdating(false);
    }
  };

  const handleDuplicateOS = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!session || session.sessionType !== 'admin') return;
    setIsUpdating(true);
    try {
        await duplicateOS(os.id, session.username);
    } finally {
        setIsUpdating(false);
    }
  };

  const handleFinalizeOS = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (os.status !== OSStatus.FINALIZADO && os.status !== OSStatus.AGUARDANDO_APROVACAO && os.status !== OSStatus.RECUSADA) {
      setIsUpdating(true);
      try {
        const adminUsername = session && session.sessionType === 'admin' ? session.username : undefined;
        await updateOSStatus(os.id, OSStatus.FINALIZADO, adminUsername);
      } catch (error) {
      } finally {
        setIsUpdating(false);
      }
    }
  };

  const handleToggleTimer = async (e: React.MouseEvent, action: 'play' | 'pause') => {
    e.preventDefault(); e.stopPropagation();
    if (os.status === OSStatus.AGUARDANDO_APROVACAO || os.status === OSStatus.RECUSADA || os.status === OSStatus.FINALIZADO) return;
    setIsUpdating(true);
    try {
        await toggleProductionTimer(os.id, action);
    } finally {
        setIsUpdating(false);
    }
  };

  const truncateText = (text: string | undefined | null, maxLength: number = 50): string => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  const formattedProgramadoPara = useMemo(() => {
      if (!os.programadoPara) return null;
      try {
          const date = /^\d{4}-\d{2}-\d{2}$/.test(os.programadoPara)
            ? parseISO(os.programadoPara + 'T00:00:00Z')
            : parseISO(os.programadoPara);

          if (isValid(date)) {
              return format(date, "dd/MM/yy", { locale: ptBR });
          }
      } catch (e) {
      }
      return os.programadoPara;
  }, [os.programadoPara]);

  const isTimerRunning = !!os.dataInicioProducaoAtual;
  const isFinalized = os.status === OSStatus.FINALIZADO;
  const isAwaitingApproval = os.status === OSStatus.AGUARDANDO_APROVACAO;
  const isRefused = os.status === OSStatus.RECUSADA;

  const osNumeroColorClass = (os.isUrgent && !isAwaitingApproval && !isRefused) ? 'text-danger-emphasis' : 'text-primary';
  const headerBgClass = () => {
    if (os.isUrgent && !isAwaitingApproval && !isRefused) return 'bg-danger-subtle';
    if (isAwaitingApproval) return 'bg-warning-subtle';
    if (isRefused) return 'bg-danger-subtle';
    if (os.status === OSStatus.EM_PRODUCAO) return 'bg-info-subtle';
    if (os.status === OSStatus.AGUARDANDO_PARCEIRO) return 'bg-primary-subtle';
    return 'bg-light';
  };


  return (
    <Link href={`/os/${os.id}`} passHref legacyBehavior>
        <a className={`text-decoration-none d-block h-100 ${hoverEffectClass}`}>
            <div className={cardClasses}>
                <div className={`card-header p-2 pb-1 d-flex justify-content-between align-items-center ${headerBgClass()}`}>
                    <div className="d-flex flex-column" style={{ minWidth: 0 }}>
                        <span className={`fw-bold small font-monospace text-truncate ${osNumeroColorClass}`} title={`OS: ${os.numero} - ${os.projeto}`}>
                            OS: {os.numero} - {os.projeto}
                        </span>
                    </div>
                    {viewMode === 'admin' && os.isUrgent && !isAwaitingApproval && !isRefused && (
                        <span className={`badge bg-danger text-white rounded-pill px-2 py-1 small d-flex align-items-center ms-auto`} style={{fontSize: '0.7em'}}>
                            <AlertTriangle size={12} className="me-1" /> URGENTE
                        </span>
                    )}
                     {viewMode === 'partner' && os.isUrgent && !isAwaitingApproval && !isRefused && (
                        <span className={`badge bg-danger-subtle text-danger-emphasis rounded-pill px-2 py-1 small d-flex align-items-center ms-auto`} style={{fontSize: '0.7em'}}>
                            <AlertTriangle size={12} className="me-1" /> URGENTE
                        </span>
                    )}
                </div>
                <div className={`card-body p-2 pt-1 pb-2 d-flex flex-column text-wrap`}>
                    <div className="mb-1" title={`Cliente: ${os.cliente}`}>
                        <UserIcon size={14} className="me-1 text-muted align-middle" />
                        <span className="fw-medium small text-break">{truncateText(os.cliente, 30)}</span>
                    </div>
                    {os.parceiro && viewMode === 'admin' && (
                        <div className="mb-1" title={`Parceiro: ${os.parceiro}`}>
                            <Users size={14} className="me-1 text-muted align-middle" />
                            <span className="text-muted small text-break">{truncateText(os.parceiro, 30)}</span>
                        </div>
                    )}
                    <div className="mb-2" title={`Tarefa: ${os.tarefa}`}>
                        <FileText size={14} className="me-1 text-muted align-middle" />
                        <span className="small text-muted text-break">{truncateText(os.tarefa, 40)}</span>
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
                        {showChronometer && (
                            <div className="mb-2">
                                <ChronometerDisplay
                                    startTimeISO={os.dataInicioProducaoAtual}
                                    accumulatedSeconds={os.tempoGastoProducaoSegundos}
                                    isRunningClientOverride={os.status === OSStatus.EM_PRODUCAO && !!os.dataInicioProducaoAtual}
                                    osStatus={os.status}
                                />
                            </div>
                        )}
                    </div>

                    {viewMode === 'admin' ? (
                        <div className="mb-2">
                            <select
                                className={`form-select form-select-sm ${statusSelectClasses}`}
                                value={os.status}
                                onChange={handleStatusChange}
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                aria-label="Mudar status da OS"
                                style={{ fontSize: '0.75rem' }}
                                disabled={isUpdating || isFinalized || isAwaitingApproval || isRefused}
                            >
                                {ALL_OS_STATUSES
                                  .filter(s => s !== OSStatus.AGUARDANDO_APROVACAO && s !== OSStatus.RECUSADA || s === os.status) // Só mostra Aguardando/Recusada se for o status atual
                                  .map(s => (
                                <option key={s} value={s} disabled={(isFinalized && s !== OSStatus.FINALIZADO) || ((isAwaitingApproval || isRefused) && s !== os.status)}>
                                    {s}
                                </option>
                                ))}
                            </select>
                        </div>
                    ) : (
                         <div className="mb-2">
                            <div className={`form-control form-control-sm text-center disabled ${statusSelectClasses}`} style={{ fontSize: '0.75rem' }}>
                                {getStatusIcon(os.status)} {os.status}
                            </div>
                        </div>
                    )}
                </div>
                 {viewMode === 'admin' && (
                    <div className={`card-footer p-2 border-top ${theme === 'dark' ? 'bg-dark-subtle' : headerBgClass()}`}>
                        <div className="d-flex flex-column gap-1">
                            {isAwaitingApproval && (
                                <div className="d-flex gap-1 mb-1">
                                    <button
                                        className="btn btn-success btn-sm flex-grow-1 d-flex align-items-center justify-content-center"
                                        onClick={(e) => handleApprovalAction(e, true)}
                                        disabled={isUpdating}
                                        style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                                        title="Aprovar OS"
                                    >
                                        <ThumbsUp size={14} className="me-1" /> Aprovar
                                    </button>
                                    <button
                                        className="btn btn-danger btn-sm flex-grow-1 d-flex align-items-center justify-content-center"
                                        onClick={(e) => handleApprovalAction(e, false)}
                                        disabled={isUpdating}
                                        style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                                        title="Recusar OS"
                                    >
                                        <ThumbsDown size={14} className="me-1" /> Recusar
                                    </button>
                                </div>
                            )}
                            {!isFinalized && !isAwaitingApproval && !isRefused &&(
                                <button
                                    className="btn btn-info btn-sm w-100 d-flex align-items-center justify-content-center"
                                    onClick={handleFinalizeOS}
                                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                                    disabled={isUpdating || (isTimerRunning && showChronometer)}
                                    title={(isTimerRunning && showChronometer) ? "Pause o timer para finalizar" : "Finalizar Ordem de Serviço"}
                                >
                                    <CheckSquare size={14} className="me-1" /> Finalizar OS
                                </button>
                            )}
                            {showChronometer && !isFinalized && !isAwaitingApproval && !isRefused && (
                                <div className="d-flex gap-1 mb-1">
                                    {isTimerRunning ? (
                                        <button
                                            className="btn btn-warning btn-sm flex-grow-1 d-flex align-items-center justify-content-center"
                                            onClick={(e) => handleToggleTimer(e, 'pause')}
                                            disabled={isUpdating}
                                            style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                                            title="Pausar cronômetro de produção"
                                        >
                                            <Pause size={14} className="me-1" /> Pausar
                                        </button>
                                    ) : (
                                        <button
                                            className="btn btn-success btn-sm flex-grow-1 d-flex align-items-center justify-content-center"
                                            onClick={(e) => handleToggleTimer(e, 'play')}
                                            disabled={isUpdating}
                                            style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                                            title="Iniciar cronômetro de produção (define status para Em Produção)"
                                        >
                                            <Play size={14} className="me-1" /> Iniciar
                                        </button>
                                    )}
                                </div>
                            )}
                            <div className="d-flex gap-1">
                                <button
                                    className={`btn ${os.isUrgent && !isAwaitingApproval && !isRefused ? 'btn-danger' : 'btn-outline-danger'} btn-sm flex-grow-1 d-flex align-items-center justify-content-center`}
                                    onClick={handleToggleUrgent}
                                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                                    disabled={isUpdating || isAwaitingApproval || isRefused}
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
                 )}
            </div>
        </a>
    </Link>
  );
}
