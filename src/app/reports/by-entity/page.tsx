
'use client';

import React, { useMemo, useState, useEffect } from 'react';
import AuthenticatedLayout from '@/components/layout/AuthenticatedLayout';
import { useOSStore } from '@/store/os-store';
import type { OS, Client } from '@/lib/types';
import { OSStatus, ALL_OS_STATUSES } from '@/lib/types';
import type { Partner } from '@/store/os-store';
import Link from 'next/link';
import { ArrowLeft, Users as UsersIcon, Filter, List, ArrowDown, ArrowUp, CalendarDays, CheckCircle2, ClockIcon } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type ReportOSStatusFilter = 'all' | 'active' | 'completed' | OSStatus;
type SortKey = 'dataAbertura' | 'numero' | 'cliente' | 'projeto' | 'status' | 'programadoPara' | 'dataFinalizacao';
type SortDirection = 'asc' | 'desc';

// Use ALL_OS_STATUSES from types.ts for consistency
const statusOptions: { value: ReportOSStatusFilter; label: string }[] = [
  { value: 'all', label: 'Todas as OS' },
  { value: 'active', label: 'OS Ativas (Não Finalizadas/Recusadas/Aguardando Aprovação)' },
  { value: 'completed', label: 'OS Finalizadas' },
  ...ALL_OS_STATUSES.map(status => ({ value: status, label: status })),
];

export default function ReportByEntityPage() {
  const { osList, clients, partners } = useOSStore(state => ({
    osList: state.osList,
    clients: state.clients,
    partners: state.partners,
  }));

  const [isHydrated, setIsHydrated] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>('all');
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<ReportOSStatusFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [sortBy, setSortBy] = useState<SortKey>('dataAbertura');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    const timer = setTimeout(() => setIsHydrated(true), 300);
    return () => clearTimeout(timer);
  }, []);

  const filteredAndSortedOS = useMemo(() => {
    let tempOSList = [...osList];

    if (selectedClientId !== 'all') {
      tempOSList = tempOSList.filter(os => os.clientId === selectedClientId);
    }

    if (selectedPartnerId !== 'all') {
      tempOSList = tempOSList.filter(os => os.partnerId === selectedPartnerId);
    }

    if (selectedStatusFilter === 'active') {
      tempOSList = tempOSList.filter(os => 
        os.status !== OSStatus.FINALIZADO && 
        os.status !== OSStatus.RECUSADA &&
        os.status !== OSStatus.AGUARDANDO_APROVACAO
      );
    } else if (selectedStatusFilter === 'completed') {
      tempOSList = tempOSList.filter(os => os.status === OSStatus.FINALIZADO);
    } else if (selectedStatusFilter !== 'all') {
      tempOSList = tempOSList.filter(os => os.status === selectedStatusFilter);
    }
    
    if (searchTerm.trim() !== '') {
        const lowerSearchTerm = searchTerm.toLowerCase();
        tempOSList = tempOSList.filter(os =>
            os.numero.toLowerCase().includes(lowerSearchTerm) ||
            os.projeto.toLowerCase().includes(lowerSearchTerm)
        );
    }

    tempOSList.sort((a, b) => {
      let compareResult = 0;
      const valA = getSortValue(a, sortBy);
      const valB = getSortValue(b, sortBy);

      if (sortBy === 'dataAbertura' || sortBy === 'programadoPara' || sortBy === 'dataFinalizacao') {
        const timeA = valA && typeof valA === 'string' ? (isValid(parseISO(valA)) ? parseISO(valA).getTime() : 0) : 0;
        const timeB = valB && typeof valB === 'string' ? (isValid(parseISO(valB)) ? parseISO(valB).getTime() : 0) : 0;
        compareResult = timeA - timeB;
      } else if (sortBy === 'numero') {
        compareResult = parseInt(valA as string || '0', 10) - parseInt(valB as string || '0', 10);
      } else if (sortBy === 'cliente' || sortBy === 'projeto' || sortBy === 'status') {
        compareResult = (valA as string || '').localeCompare(valB as string || '');
      }

      return sortDirection === 'asc' ? compareResult : -compareResult;
    });

    return tempOSList;
  }, [osList, selectedClientId, selectedPartnerId, selectedStatusFilter, searchTerm, sortBy, sortDirection]);

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
    return sortDirection === 'asc' ? <ArrowUp size={12} className="ms-1" /> : <ArrowDown size={12} className="ms-1" />;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(dateString) ? parseISO(dateString + 'T00:00:00Z') : parseISO(dateString);
      if (isValid(date)) {
        return format(date, dateString.length === 10 ? 'dd/MM/yyyy' : 'dd/MM/yyyy HH:mm', { locale: ptBR });
      }
    } catch (e) { /* fall through */ }
    return dateString; 
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
      <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom">
        <h1 className="h3 mb-0 d-flex align-items-center">
          <UsersIcon className="me-2 text-info" /> Relatório de OS por Cliente / Parceiro
        </h1>
        <Link href="/reports" className="btn btn-outline-secondary btn-sm">
          <ArrowLeft className="me-2" size={16} /> Voltar para Central de Relatórios
        </Link>
      </div>

      <div className="card shadow-sm mb-4">
        <div className="card-header bg-light">
          <Filter size={16} className="me-1" /> Filtros do Relatório
        </div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-3">
              <label htmlFor="clientFilter" className="form-label form-label-sm">Cliente</label>
              <select
                id="clientFilter"
                className="form-select form-select-sm"
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
              >
                <option value="all">Todos os Clientes</option>
                {clients.sort((a,b) => a.name.localeCompare(b.name)).map(client => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label htmlFor="partnerFilter" className="form-label form-label-sm">Parceiro</label>
              <select
                id="partnerFilter"
                className="form-select form-select-sm"
                value={selectedPartnerId}
                onChange={(e) => setSelectedPartnerId(e.target.value)}
              >
                <option value="all">Todos os Parceiros</option>
                {partners.sort((a,b) => a.name.localeCompare(b.name)).map(partner => (
                  <option key={partner.id} value={partner.id}>{partner.name}</option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label htmlFor="statusFilter" className="form-label form-label-sm">Status da OS</label>
              <select
                id="statusFilter"
                className="form-select form-select-sm"
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value as ReportOSStatusFilter)}
              >
                {statusOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
                 <label htmlFor="searchTerm" className="form-label form-label-sm">Buscar Nº OS / Projeto</label>
                 <input
                    type="search"
                    id="searchTerm"
                    className="form-control form-control-sm"
                    placeholder="Digite para buscar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
          </div>
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="card-header bg-light d-flex justify-content-between align-items-center">
          <span><List size={16} className="me-1" /> Resultados</span>
          <span className="badge bg-secondary rounded-pill">{filteredAndSortedOS.length} OS encontradas</span>
        </div>
        <div className="card-body p-0">
          {filteredAndSortedOS.length === 0 ? (
            <p className="text-center text-muted p-4">Nenhuma Ordem de Serviço encontrada com os filtros selecionados.</p>
          ) : (
            <div className="table-responsive">
              <table className="table table-striped table-hover table-sm mb-0">
                <thead className="table-light">
                  <tr>
                    <th onClick={() => handleSort('numero')} style={{ cursor: 'pointer' }}>Nº OS {renderSortIcon('numero')}</th>
                    <th onClick={() => handleSort('cliente')} style={{ cursor: 'pointer' }}>Cliente {renderSortIcon('cliente')}</th>
                    <th onClick={() => handleSort('parceiro')} style={{ cursor: 'pointer' }}>Parceiro {renderSortIcon('parceiro')}</th>
                    <th onClick={() => handleSort('projeto')} style={{ cursor: 'pointer' }}>Projeto {renderSortIcon('projeto')}</th>
                    <th onClick={() => handleSort('status')} style={{ cursor: 'pointer' }}>Status {renderSortIcon('status')}</th>
                    <th onClick={() => handleSort('dataAbertura')} style={{ cursor: 'pointer' }}>
                        <ClockIcon size={12} className="me-1"/>Abertura {renderSortIcon('dataAbertura')}
                    </th>
                    <th onClick={() => handleSort('programadoPara')} style={{ cursor: 'pointer' }}>
                        <CalendarDays size={12} className="me-1"/>Programada {renderSortIcon('programadoPara')}
                    </th>
                    <th onClick={() => handleSort('dataFinalizacao')} style={{ cursor: 'pointer' }}>
                        <CheckCircle2 size={12} className="me-1"/>Finalização {renderSortIcon('dataFinalizacao')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedOS.map(os => (
                    <tr key={os.id}>
                      <td className="font-monospace">{os.numero}</td>
                      <td>{os.cliente}</td>
                      <td>{os.parceiro || <span className="text-muted fst-italic">N/A</span>}</td>
                      <td>{os.projeto}</td>
                      <td><span className={`badge ${getStatusBadgeClass(os.status)}`}>{os.status}</span></td>
                      <td>{formatDate(os.dataAbertura)}</td>
                      <td>{formatDate(os.programadoPara)}</td>
                      <td>{formatDate(os.dataFinalizacao)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="card-footer text-muted small">
            Total de {filteredAndSortedOS.length} OS exibidas.
        </div>
      </div>
    </AuthenticatedLayout>
  );
}

function getSortValue<T, K extends keyof T>(obj: T | null | undefined, key: K): T[K] | null {
    return obj ? obj[key] : null;
}

const getStatusBadgeClass = (status: OSStatus): string => {
  switch (status) {
    case OSStatus.NA_FILA: return 'bg-secondary-subtle text-secondary-emphasis';
    case OSStatus.AGUARDANDO_CLIENTE: return 'bg-warning-subtle text-warning-emphasis';
    case OSStatus.EM_PRODUCAO: return 'bg-info-subtle text-info-emphasis';
    case OSStatus.AGUARDANDO_PARCEIRO: return 'bg-primary-subtle text-primary-emphasis';
    case OSStatus.AGUARDANDO_APROVACAO: return 'bg-warning-subtle text-warning-emphasis';
    case OSStatus.RECUSADA: return 'bg-danger-subtle text-danger-emphasis';
    case OSStatus.FINALIZADO: return 'bg-success-subtle text-success-emphasis';
    default: return 'bg-light text-dark';
  }
};
