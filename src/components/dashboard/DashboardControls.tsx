
'use client';

import React, { useState } from 'react';
import type { OSStatus } from '@/lib/types';
import { ALL_OS_STATUSES } from '@/lib/types';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, Filter, Search, SortAsc, X } from 'lucide-react'; // Icons

// Updated SortKey to include 'dataAberturaAsc' for "Mais Antigo"
export type SortKey = 'dataAberturaDesc' | 'dataAberturaAsc' | 'numero' | 'cliente' | 'projeto';

interface DashboardControlsProps {
  filterStatus: OSStatus | 'all';
  setFilterStatus: (status: OSStatus | 'all') => void;
  sortBy: SortKey;
  setSortBy: (key: SortKey) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  selectedDate: Date | undefined;
  setSelectedDate: (date: Date | undefined) => void;
}

export default function DashboardControls({
  filterStatus,
  setFilterStatus,
  sortBy,
  setSortBy,
  searchTerm,
  setSearchTerm,
  selectedDate,
  setSelectedDate,
}: DashboardControlsProps) {
  const [showCalendar, setShowCalendar] = useState(false);

  const handleDayClick = (day: Date | undefined) => {
    setSelectedDate(day);
    setShowCalendar(false); // Hide calendar after selection
  };

  const statusFilterOptions: (OSStatus | 'all')[] = ['all', ...ALL_OS_STATUSES];

  return (
    <div className="mb-4 p-3 border rounded bg-light shadow-sm transition-all"> {/* Added transition */}
        {/* Status Filter Buttons */}
        <div className="mb-3">
            <label className="form-label form-label-sm fw-medium d-block mb-1">
                 <Filter size={14} className="me-1" /> Filtrar Status
            </label>
            <div className="btn-group flex-wrap" role="group" aria-label="Filtro de Status">
                {statusFilterOptions.map(statusValue => (
                    <button
                        key={statusValue}
                        type="button"
                        // Added transition-colors class
                        className={`btn btn-sm ${filterStatus === statusValue ? 'btn-primary' : 'btn-outline-secondary'} m-1 transition-colors`}
                        onClick={() => setFilterStatus(statusValue)}
                    >
                        {statusValue === 'all' ? 'Ver Todos Ativos' : statusValue}
                    </button>
                ))}
            </div>
        </div>

      {/* Row for Sort, Search, and Date filters */}
      <div className="row g-2 align-items-end">
        {/* Sort By */}
        <div className="col-md-4 col-lg-3">
          <label htmlFor="sortBy" className="form-label form-label-sm fw-medium">
             <SortAsc size={14} className="me-1" /> Ordenar Por
          </label>
          <select
            id="sortBy"
            className="form-select form-select-sm"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
          >
            <option value="dataAberturaDesc">Mais Recente</option>
            <option value="dataAberturaAsc">Mais Antigo</option> {/* New Option */}
            <option value="numero">Número da OS</option>
            <option value="cliente">Nome do Cliente</option>
            <option value="projeto">Nome do Projeto</option>
          </select>
        </div>

        {/* Search Input */}
        <div className="col-md-4 col-lg-5"> {/* Adjusted columns */}
          <label htmlFor="searchTerm" className="form-label form-label-sm fw-medium">
            <Search size={14} className="me-1" /> Buscar OS
          </label>
          <input
            type="search"
            id="searchTerm"
            className="form-control form-control-sm"
            placeholder="Cliente, projeto, nº OS, parceiro..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Calendar Filter */}
        <div className="col-md-4 col-lg-4 position-relative"> {/* Adjusted columns */}
           <label className="form-label form-label-sm fw-medium">
             <CalendarIcon size={14} className="me-1" /> Filtrar por Data Programada
           </label>
           <div className="input-group input-group-sm"> {/* Use input group for clear button */}
                <button
                    className="btn btn-sm btn-outline-secondary w-100 d-flex justify-content-between align-items-center"
                    onClick={() => setShowCalendar(!showCalendar)}
                    style={{textAlign: 'left'}} // Ensure text aligns left
                >
                    {selectedDate ? selectedDate.toLocaleDateString('pt-BR') : "Selecionar Data"}
                    <CalendarIcon size={14} />
                </button>
                 {selectedDate && (
                    <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => setSelectedDate(undefined)}
                        aria-label="Limpar data"
                        style={{ zIndex: 5, padding: '0.1rem 0.3rem', lineHeight: 1 }}
                     >
                       <X size={12} />
                     </button>
                 )}
           </div>


           {showCalendar && (
             <div
               className="position-absolute bg-body border rounded shadow p-2 mt-1 transition-opacity" // Use bg-body, added transition
               style={{ zIndex: 1000, top: '100%', right: 0, minWidth: '280px' }}
               onMouseLeave={() => setShowCalendar(false)} // Optional: hide on mouse leave
             >
               <DayPicker
                 mode="single"
                 selected={selectedDate}
                 onSelect={handleDayClick}
                 locale={ptBR}
                 showOutsideDays
                 fixedWeeks
                 captionLayout="dropdown-buttons" // Add dropdowns for month/year
                 fromYear={2020}             // Example range
                 toYear={new Date().getFullYear() + 1} // Example range
                 // Custom styles for better Bootstrap integration if needed
                 classNames={{
                    caption_label: 'fs-6 fw-medium',
                    nav_button: 'btn btn-sm btn-outline-secondary border-0',
                    day: 'btn btn-sm border-0 rounded-circle transition-colors', // Added transition
                    day_today: 'fw-bold text-primary',
                    day_selected: 'bg-primary text-white rounded-circle',
                    // ... other classes
                 }}
               />
                <button className="btn btn-sm btn-secondary w-100 mt-2" onClick={() => setShowCalendar(false)}>Fechar Calendário</button>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
