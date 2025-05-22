
'use client';

import Link from 'next/link';
import type { OS } from '@/lib/types';
import { OSStatus, ALL_OS_STATUSES } from '@/lib/types';
import { CalendarClock, Flag, Copy, AlertTriangle, CheckCircle2, Clock, Server, Users, FileText, User as UserIcon, Briefcase, Calendar as CalendarIcon, CheckSquare } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useOSStore } from '@/store/os-store';
import { useTheme } from '@/hooks/useTheme';
import React, { useMemo } from 'react';

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
  const { updateOSStatus, toggleUrgent, duplicateOS } = useOSStore();
  const { theme } = useTheme();

  const statusThemeClasses = getStatusClass(os.status, os.isUrgent, theme);
  
  // Base card classes with transition for hover effect
  const cardClasses = `card h-100 shadow-sm border-start border-4 ${statusThemeClasses} transition-shadow duration-200 ease-in-out`;
  const hoverEffectClass = "hover-lift";

  const handleStatusChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = event.target.value as OSStatus;
    // Prevent default link navigation or other actions
    event.preventDefault(); 
    event.stopPropagation();
    try {
      await updateOSStatus(os.id, newStatus);
      console.log(`OS "${os.projeto}" movida para ${newStatus}.`);
    } catch (error) {
      console.error(`Falha ao atualizar status da OS ${os.id}:`, error);
      // TODO: Adicionar feedback visual para o usuário (ex: toast)
    }
  };

  const handleToggleUrgent = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await toggleUrgent(os.id);
  };

  const handleDuplicateOS = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await duplicateOS(os.id);
  };

  const handleFinalizeOS = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (os.status !== OSStatus.FINALIZADO) {
      try {
        await updateOSStatus(os.id, OSStatus.FINALIZADO);
        console.log(`OS "${os.numero}" finalizada diretamente do card.`);
      } catch (error) {
        console.error(`Falha ao finalizar OS ${os.id} do card:`, error);
      }
    }
  };

  const truncateText = (text: string | undefined | null, maxLength: number = 50): string => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  const formattedProgramadoPara = useMemo(() => {
      if (!os.programadoPara) return null;
      try {
          const date = os.programadoPara.length === 10 ? parseISO(os.programadoPara + 'T00:00:00Z') : parseISO(os.programadoPara);
          if (isValid(date)) {
              return format(date, "dd/MM/yy", { locale: ptBR });
          }
      } catch {}
      return null;
  }, [os.programadoPara]);


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
                             <span className="text-truncate" title={`Aberto em: ${format(parseISO(os.dataAbertura), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}`}>
                                Aberto em: {format(parseISO(os.dataAbertura), "dd/MM/yy HH:mm", { locale: ptBR })}
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
                    </div>

                    <div className="mb-2">
                         <select
                            className={`form-select form-select-sm ${statusThemeClasses.replace('text-', 'border-').replace('bg-danger-subtle', '')}`}
                            value={os.status}
                            onChange={handleStatusChange}
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                            aria-label="Mudar status da OS"
                            style={{ fontSize: '0.75rem' }}
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
                            >
                                <CheckSquare size={14} className="me-1" /> Finalizar OS
                            </button>
                        )}
                        <div className="d-flex gap-1">
                            <button
                                className={`btn ${os.isUrgent ? 'btn-danger' : 'btn-outline-warning'} btn-sm flex-grow-1 d-flex align-items-center justify-content-center`}
                                onClick={handleToggleUrgent}
                                style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                            >
                                <Flag size={14} className="me-1" /> {os.isUrgent ? "Urgente!" : "Marcar Urgente"}
                            </button>
                            <button
                                className="btn btn-secondary btn-sm flex-grow-1 d-flex align-items-center justify-content-center"
                                onClick={handleDuplicateOS}
                                style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
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
