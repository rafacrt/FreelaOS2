
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import type { OS } from '@/lib/types';
import { OSStatus } from '@/lib/types';
import { useOSStore } from '@/store/os-store';
import OSCard from './OSCard';
import DashboardControls, { type SortKey } from '@/components/dashboard/DashboardControls'; // Import SortKey
import { parseISO, isSameDay } from 'date-fns';

export default function OSGrid() {
  const osList = useOSStore((state) => state.osList);
  const [isHydrated, setIsHydrated] = useState(false);

  // Filter, Sort, Search State
  const [filterStatus, setFilterStatus] = useState<OSStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortKey>('dataAberturaDesc'); // Default to Mais Recente
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const filteredAndSortedOS = useMemo(() => {
    let tempOSList = [...osList];

    // 1. Filter by Selected Date (programadoPara)
    if (selectedDate) {
      tempOSList = tempOSList.filter(os => {
        if (os.programadoPara) {
          try {
            const programadoDate = parseISO(os.programadoPara.split('T')[0]);
            return isSameDay(programadoDate, selectedDate);
          } catch {
            console.warn(`Invalid programadoPara date format for OS ${os.numero}: ${os.programadoPara}`);
            return false;
          }
        }
        return false;
      });
    }

    // 2. Filter by Search Term
    if (searchTerm.trim() !== '') {
      const lowerSearchTerm = searchTerm.toLowerCase();
      tempOSList = tempOSList.filter(os =>
        os.cliente.toLowerCase().includes(lowerSearchTerm) ||
        os.projeto.toLowerCase().includes(lowerSearchTerm) ||
        os.numero.includes(searchTerm) ||
        (os.parceiro && os.parceiro.toLowerCase().includes(lowerSearchTerm)) ||
        os.tarefa.toLowerCase().includes(lowerSearchTerm)
      );
    }

    // 3. Filter by Status
    if (filterStatus === OSStatus.FINALIZADO) {
      tempOSList = tempOSList.filter(os => os.status === OSStatus.FINALIZADO);
    } else if (filterStatus === 'all') { // "all" means all *active* (non-finalized) OS
      tempOSList = tempOSList.filter(os => os.status !== OSStatus.FINALIZADO);
    } else {
      // Specific active status selected
      tempOSList = tempOSList.filter(os => os.status === filterStatus);
    }

    // 4. Sort Logic for Active OSs
    if (filterStatus !== OSStatus.FINALIZADO) {
      const awaitingStatus = [OSStatus.AGUARDANDO_CLIENTE, OSStatus.AGUARDANDO_PARCEIRO];
      
      const notAwaitingOS = tempOSList.filter(os => !awaitingStatus.includes(os.status));
      const awaitingOS = tempOSList.filter(os => awaitingStatus.includes(os.status));

      const sortFunction = (a: OS, b: OS) => {
        // Primary: Urgency
        if (a.isUrgent && !b.isUrgent) return -1;
        if (!a.isUrgent && b.isUrgent) return 1;

        // Secondary: Chosen sort key
        if (sortBy === 'dataAberturaDesc') { // Mais Recente
          return parseISO(b.dataAbertura).getTime() - parseISO(a.dataAbertura).getTime();
        }
        if (sortBy === 'dataAberturaAsc') { // Mais Antigo
          return parseISO(a.dataAbertura).getTime() - parseISO(b.dataAbertura).getTime();
        }
        if (sortBy === 'numero') {
          return parseInt(a.numero, 10) - parseInt(b.numero, 10);
        }
        if (sortBy === 'cliente') {
          return a.cliente.localeCompare(b.cliente);
        }
        if (sortBy === 'projeto') {
          return a.projeto.localeCompare(b.projeto);
        }
        return 0;
      };

      notAwaitingOS.sort(sortFunction);
      awaitingOS.sort(sortFunction);
      
      tempOSList = [...notAwaitingOS, ...awaitingOS];

    } else { // For Finalized OS, simple sort by chosen key (urgency is less relevant)
        tempOSList.sort((a, b) => {
            if (sortBy === 'dataAberturaDesc') {
                return parseISO(b.dataAbertura).getTime() - parseISO(a.dataAbertura).getTime();
            }
            if (sortBy === 'dataAberturaAsc') {
                return parseISO(a.dataAbertura).getTime() - parseISO(b.dataAbertura).getTime();
            }
            if (sortBy === 'numero') {
                return parseInt(a.numero, 10) - parseInt(b.numero, 10);
            }
            // Add other sort keys for finalized if needed, e.g., dataFinalizacao
            return (a.dataFinalizacao && b.dataFinalizacao) 
                   ? parseISO(b.dataFinalizacao).getTime() - parseISO(a.dataFinalizacao).getTime() // Default sort for finalized: by finalization date desc
                   : parseISO(b.dataAbertura).getTime() - parseISO(a.dataAbertura).getTime(); // Fallback
        });
    }


    return tempOSList;
  }, [osList, filterStatus, sortBy, searchTerm, selectedDate]);

  if (!isHydrated) {
    return (
      <div className="container-fluid mt-4">
        <div className="mb-4 p-3 border rounded bg-light placeholder-glow dashboard-controls-container">
          <div className="mb-3">
            <span className="placeholder col-3 mb-2 d-block"></span>
            <span className="placeholder col-2 me-1"></span>
            <span className="placeholder col-2 me-1"></span>
            <span className="placeholder col-2 me-1"></span>
            <span className="placeholder col-2"></span>
          </div>
          <div className="row g-2 align-items-end">
            <div className="col-md-4 col-lg-3"><span className="placeholder col-12"></span></div>
            <div className="col-md-4 col-lg-5"><span className="placeholder col-12"></span></div>
            <div className="col-md-4 col-lg-4"><span className="placeholder col-12"></span></div>
          </div>
        </div>
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '300px' }}>
          <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Carregando Ordens de Serviço...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="d-flex flex-column h-100">
      <DashboardControls
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        sortBy={sortBy}
        setSortBy={setSortBy}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
      />

      {filteredAndSortedOS.length === 0 ? (
        <div className="flex-grow-1 d-flex flex-column align-items-center justify-content-center text-center mt-5 p-4 rounded bg-light">
          <p className="fs-5 text-muted fw-medium">Nenhuma Ordem de Serviço encontrada.</p>
          <p className="text-muted small">
            Tente ajustar os filtros ou {searchTerm ? `limpar o termo de busca "${searchTerm}".` : 'crie uma nova OS.'}
            {selectedDate && ` (Data programada filtrada: ${selectedDate.toLocaleDateString('pt-BR')})`}
          </p>
          {selectedDate && (
            <button className="btn btn-sm btn-outline-secondary mt-2" onClick={() => setSelectedDate(undefined)}>
              Limpar Filtro de Data
            </button>
          )}
          {(filterStatus !== 'all' || searchTerm) && (
            <button
              className="btn btn-sm btn-outline-secondary mt-2 ms-2"
              onClick={() => {
                setFilterStatus('all');
                setSearchTerm('');
                setSelectedDate(undefined);
              }}
            >
              Limpar Todos os Filtros
            </button>
          )}
        </div>
      ) : (
        <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-xl-4 g-3 pb-4 flex-grow-1 os-grid-container">
          {filteredAndSortedOS.map((os) => (
            <div className="col os-grid-item" key={os.id}>
              <OSCard os={os} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
