
'use client';

import React, { useState, useMemo, useEffect } from 'react';
// import AuthenticatedLayout from '@/components/layout/AuthenticatedLayout'; // Removido
import Link from 'next/link';
import { ArrowLeft, CheckCircle, Clock, Square, Circle } from 'lucide-react';
import { DayPicker, type DayProps, type Modifiers } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { format, parseISO, startOfMonth, isSameDay, isValid, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useOSStore } from '@/store/os-store';
import type { OS } from '@/lib/types';
import { OSStatus } from '@/lib/types';

const getStatusTextColorClass = (status: OSStatus): string => {
  switch (status) {
    case OSStatus.NA_FILA: return 'text-secondary-emphasis';
    case OSStatus.AGUARDANDO_CLIENTE: return 'text-warning-emphasis';
    case OSStatus.EM_PRODUCAO: return 'text-info-emphasis';
    case OSStatus.AGUARDANDO_PARCEIRO: return 'text-primary-emphasis';
    case OSStatus.FINALIZADO: return 'text-success-emphasis';
    default: return 'text-muted';
  }
};

const getStatusBorderColorClass = (status: OSStatus): string => {
    switch (status) {
        case OSStatus.NA_FILA: return 'border-secondary';
        case OSStatus.AGUARDANDO_CLIENTE: return 'border-warning';
        case OSStatus.EM_PRODUCAO: return 'border-info';
        case OSStatus.AGUARDANDO_PARCEIRO: return 'border-primary';
        case OSStatus.FINALIZADO: return 'border-success';
        default: return 'border-secondary'; 
    }
};


export default function CalendarPage() {
  const osList = useOSStore((state) => state.osList);
  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(new Date()));
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
        setIsHydrated(true);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const { scheduledDates, finalizedDates, osByDate } = useMemo(() => {
    const scheduled = new Set<string>();
    const finalized = new Set<string>();
    const osMap = new Map<string, OS[]>();

    osList.forEach(os => {
      const addOsToMap = (dateStr: string, osToAdd: OS) => {
        if (!osMap.has(dateStr)) osMap.set(dateStr, []);
        if (!osMap.get(dateStr)?.some(existing => existing.id === osToAdd.id)) {
          osMap.get(dateStr)?.push(osToAdd);
        }
      };

      if (os.programadoPara) {
        try {
            const dateStr = os.programadoPara; 
            const date = parseISO(dateStr + "T00:00:00Z"); 
            if (isValid(date)) {
                scheduled.add(dateStr);
                addOsToMap(dateStr, os);
            }
        } catch (e) {
        }
      }
      if (os.dataFinalizacao) {
        try {
          const date = parseISO(os.dataFinalizacao);
          if (isValid(date)) {
            const dateStr = format(date, 'yyyy-MM-dd');
            finalized.add(dateStr);
            addOsToMap(dateStr, os);
          }
        } catch (e) {
        }
      }
    });
    
    const parseDateStrings = (dateStrSet: Set<string>): Date[] => {
        return Array.from(dateStrSet).map(dStr => parseISO(dStr + "T00:00:00Z")).filter(isValid);
    };

    return {
      scheduledDates: parseDateStrings(scheduled),
      finalizedDates: parseDateStrings(finalized),
      osByDate: osMap,
    };
  }, [osList]);

  const DayContent = (props: DayProps) => {
    const dateStr = format(props.date, 'yyyy-MM-dd');
    const dayOS = osByDate.get(dateStr) || [];
    const isSelected = props.displayMonth === currentMonth && props.modifiers.selected;

     const sortedDayOS = dayOS.sort((a, b) => {
        const aIsScheduled = a.programadoPara === dateStr;
        const bIsScheduled = b.programadoPara === dateStr;
        if (aIsScheduled && !bIsScheduled) return -1;
        if (!aIsScheduled && bIsScheduled) return 1;
        return parseInt(a.numero, 10) - parseInt(b.numero, 10);
     });

    return (
        <div className={`d-flex flex-column h-100 position-relative p-1 ${isSelected ? 'bg-primary-subtle' : ''}`} style={{ minHeight: '120px' }}>
            <span className={`position-absolute top-0 end-0 p-1 small ${isToday(props.date) ? 'bg-primary text-white rounded-circle lh-1 d-inline-flex justify-content-center align-items-center' : ''}`}
                  style={isToday(props.date) ? { width: '1.5rem', height: '1.5rem'} : {}}
            >
                {format(props.date, 'd')}
            </span>
            <div className="mt-3 small flex-grow-1 overflow-auto" style={{ fontSize: '0.7rem' }}>
             {sortedDayOS.slice(0, 4).map(os => {
               const isThisDayScheduled = os.programadoPara === dateStr;
               const isThisDayFinalized = os.dataFinalizacao && format(parseISO(os.dataFinalizacao), 'yyyy-MM-dd') === dateStr;
               const textColorClass = getStatusTextColorClass(os.status);
               const borderColorClass = getStatusBorderColorClass(os.status);
               
               let icon = <Clock size={10} className="me-1 flex-shrink-0"/>; 
               if (isThisDayFinalized) {
                   icon = <CheckCircle size={10} className="me-1 flex-shrink-0 text-success-emphasis"/>;
               }

               return (
                   <Link key={os.id} href={`/os/${os.id}`} className={`d-block text-decoration-none mb-1 p-1 rounded border-start border-3 ${borderColorClass} bg-light-subtle shadow-sm transition-transform`}>
                     <div className={`d-flex align-items-center ${textColorClass}`}>
                       {icon}
                       <span className="text-truncate fw-medium" title={`${os.numero}: ${os.projeto}`}>
                         <strong className="text-dark">{os.numero}</strong>: {truncateText(os.projeto, 20)}
                       </span>
                     </div>
                   </Link>
               );
             })}
             {sortedDayOS.length > 4 && (
                 <div className="text-muted text-center mt-1">+{sortedDayOS.length - 4} mais</div>
             )}
            </div>
        </div>
     );
  };

  const modifiers: Modifiers = useMemo(() => ({
    scheduled: scheduledDates,
    finalized: finalizedDates,
  }), [scheduledDates, finalizedDates]);

  const modifiersStyles = {
  };


  if (!isHydrated) {
    return (
        <div className="d-flex flex-column justify-content-center align-items-center text-center" style={{ minHeight: '400px' }}>
          <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Carregando calendário...</span>
          </div>
          <p className="text-muted">Carregando calendário...</p>
        </div>
    );
  }

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">Calendário de OS</h1>
        <Link href="/dashboard" className="btn btn-outline-secondary btn-sm">
          <ArrowLeft className="me-2" size={16} /> Voltar ao Painel
        </Link>
      </div>
       <p className="text-muted small mb-3">
        O calendário exibe as Ordens de Serviço com base na data em que foram <strong className="text-primary">Programadas</strong> ou <strong className="text-success">Finalizadas</strong>.
        A funcionalidade para exibir OSs em todos os dias em que estiveram em produção não está disponível no momento.
      </p>

      <div className="border rounded shadow-sm overflow-hidden transition-all">
         <DayPicker
           mode="single"
           month={currentMonth}
           onMonthChange={setCurrentMonth}
           locale={ptBR}
           showOutsideDays
           fixedWeeks
           modifiers={modifiers}
           modifiersStyles={modifiersStyles}
           components={{ DayContent }}
           captionLayout="dropdown-buttons"
           fromYear={2020}
           toYear={new Date().getFullYear() + 2}
           className="w-100 border-0"
           classNames={{
               root: 'p-3 bg-body',
               table: 'border-top border-start w-100 table-fixed',
               head_row: 'bg-light',
               head_cell: 'text-muted small fw-medium text-center border-end border-bottom py-2',
               row: '',
               cell: 'border-end border-bottom p-0 align-top',
               day: 'd-block w-100 h-100',
               day_today: '',
               day_outside: 'text-muted opacity-50',
               day_selected: '',
               caption: 'px-3 pt-2',
               caption_label: 'fs-5 fw-bold',
               nav_button: 'btn btn-sm btn-outline-secondary border-0',
               dropdown_month: 'form-select form-select-sm d-inline-block w-auto mx-1',
               dropdown_year: 'form-select form-select-sm d-inline-block w-auto mx-1',
           }}
       />
         <div className="p-2 border-top text-muted small d-flex align-items-center justify-content-center gap-3 bg-light">
             <span className="d-inline-flex align-items-center"><Clock size={12} className="me-1 text-primary-emphasis"/> Programada</span>
             <span className="d-inline-flex align-items-center"><CheckCircle size={12} className="me-1 text-success-emphasis"/> Finalizada no Dia</span>
         </div>
       </div>
    </>
  );
}

function truncateText(text: string | undefined | null, maxLength: number): string {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}
