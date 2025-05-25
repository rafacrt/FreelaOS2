
'use client';

import React, { useMemo, useState, useEffect } from 'react';
import AuthenticatedLayout from '@/components/layout/AuthenticatedLayout';
import { useOSStore } from '@/store/os-store';
import { OSStatus } from '@/lib/types';
import Link from 'next/link';
import { ArrowLeft, FileText as ReportIcon, CheckCircle2, Clock, ArrowDown, ArrowUp } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Helper to format seconds into a human-readable time string
const formatSecondsToReadableTime = (totalSeconds: number | undefined | null): string | React.ReactNode => {
    if (totalSeconds === undefined || totalSeconds === null || totalSeconds < 0 || isNaN(totalSeconds)) {
        return <span className="text-muted fst-italic">N/D</span>;
    }
    if (totalSeconds === 0) return "0s";

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60); // Use Math.floor for seconds too

    let parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || (hours === 0 && minutes === 0)) parts.push(`${seconds}s`);

    return parts.join(' ') || <span className="text-muted fst-italic">0s</span>;
};

type SortKey = 'dataFinalizacao' | 'tempoGastoProducaoSegundos' | 'numero' | 'cliente' | 'projeto';
type SortDirection = 'asc' | 'desc';

export default function ProductionTimeReportPage() {
  const osList = useOSStore((state) => state.osList);
  const [isHydrated, setIsHydrated] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>('dataFinalizacao');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    const timer = setTimeout(() => {
        setIsHydrated(true);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const completedOS = useMemo(() => {
    let filtered = osList.filter(os => os.status === OSStatus.FINALIZADO);

    filtered.sort((a, b) => {
        let compareResult = 0;
        const valA = getSortValue(a, sortBy);
        const valB = getSortValue(b, sortBy);

        if (sortBy === 'dataFinalizacao') {
            const timeA = valA && typeof valA === 'string' ? parseISO(valA as string).getTime() : 0;
            const timeB = valB && typeof valB === 'string' ? parseISO(valB as string).getTime() : 0;
            compareResult = timeA - timeB;
        } else if (sortBy === 'tempoGastoProducaoSegundos') {
            const timeA = (valA as number) ?? -1;
            const timeB = (valB as number) ?? -1;
            compareResult = timeA - timeB;
        } else if (sortBy === 'numero') {
            compareResult = parseInt(valA as string || '0', 10) - parseInt(valB as string || '0', 10);
        } else if (sortBy === 'cliente' || sortBy === 'projeto') {
            compareResult = (valA as string || '').localeCompare(valB as string || '');
        }

        return sortDirection === 'asc' ? compareResult : -compareResult;
    });

    return filtered;
  }, [osList, sortBy, sortDirection]);

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortBy !== key) return null;
    return sortDirection === 'asc' ? <ArrowUp size={14} className="ms-1" /> : <ArrowDown size={14} className="ms-1" />;
  };

  if (!isHydrated) {
     return (
       <AuthenticatedLayout>
         <div className="d-flex flex-column justify-content-center align-items-center text-center" style={{ minHeight: '400px' }}>
           <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
             <span className="visually-hidden">Carregando relatório...</span>
           </div>
           <p className="text-muted">Carregando relatório...</p>
         </div>
       </AuthenticatedLayout>
     );
   }

  return (
    <AuthenticatedLayout>
      <div className="transition-opacity">
          <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom">
            <h1 className="h3 mb-0 d-flex align-items-center">
                <Clock className="me-2 text-primary" /> Relatório de Tempo de Produção (OS Finalizadas)
            </h1>
            <Link href="/reports" className="btn btn-outline-secondary btn-sm">
              <ArrowLeft className="me-2" size={16} /> Voltar para Central de Relatórios
            </Link>
          </div>
          <p className="text-muted small mb-3">
            Este relatório detalha o tempo gasto em Ordens de Serviço que foram finalizadas.
            O tempo em produção é calculado desde o primeiro momento que a OS entra em "Em Produção" até ser "Finalizada", incluindo pausas.
          </p>

          <div className="card shadow-sm transition-all">
            <div className="card-header bg-light">
              Ordens de Serviço Finalizadas
            </div>
            <div className="card-body p-0">
              {completedOS.length === 0 ? (
                <div className="text-center p-4 text-muted">
                  Nenhuma Ordem de Serviço finalizada encontrada.
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-striped table-hover mb-0">
                    <thead className="table-light">
                      <tr>
                        <th scope="col" onClick={() => handleSort('numero')} style={{ cursor: 'pointer' }} className="text-nowrap">
                            Nº OS {renderSortIcon('numero')}
                        </th>
                        <th scope="col" onClick={() => handleSort('cliente')} style={{ cursor: 'pointer' }}>
                            Cliente {renderSortIcon('cliente')}
                        </th>
                        <th scope="col" onClick={() => handleSort('projeto')} style={{ cursor: 'pointer' }}>
                            Projeto {renderSortIcon('projeto')}
                        </th>
                        <th scope="col" onClick={() => handleSort('dataFinalizacao')} style={{ cursor: 'pointer' }} className="text-nowrap">
                             <CheckCircle2 size={14} className="me-1" /> Data Finalização {renderSortIcon('dataFinalizacao')}
                        </th>
                        <th scope="col" onClick={() => handleSort('tempoGastoProducaoSegundos')} style={{ cursor: 'pointer' }} className="text-nowrap">
                             <Clock size={14} className="me-1" /> Tempo em Produção {renderSortIcon('tempoGastoProducaoSegundos')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {completedOS.map(os => (
                        <tr key={os.id}>
                          <td className="font-monospace small">{os.numero}</td>
                          <td>{os.cliente}</td>
                          <td>{os.projeto}</td>
                          <td>
                            {os.dataFinalizacao ? format(parseISO(os.dataFinalizacao), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '-'}
                          </td>
                          <td>{formatSecondsToReadableTime(os.tempoGastoProducaoSegundos)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
             <div className="card-footer text-muted small">
                Tempo total em produção é o acumulado de todos os períodos em que a OS esteve com o cronômetro ativo.
            </div>
          </div>
       </div>
    </AuthenticatedLayout>
  );
}

function getSortValue<T, K extends keyof T>(obj: T | null | undefined, key: K): T[K] | null {
    return obj ? obj[key] : null;
}
