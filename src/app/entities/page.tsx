
'use client';

import React, { useEffect, useState } from 'react';
import AuthenticatedLayout from '@/components/layout/AuthenticatedLayout';
import Link from 'next/link';
import { ArrowLeft, Building, Users, PlusCircle, Edit, Trash2, ShieldCheck, ShieldOff, UserPlus, Link2 } from 'lucide-react';
import { useOSStore } from '@/store/os-store';
import type { Client } from '@/lib/types';
import type { Partner } from '@/store/os-store';
import dynamic from 'next/dynamic';

const AddEditClientModal = dynamic(() => import('@/components/entities/AddEditClientModal'), { ssr: false });
const AddEditPartnerModal = dynamic(() => import('@/components/entities/AddEditPartnerModal'), { ssr: false });

export default function EntitiesPage() {
  const { partners, clients, deleteClient, deletePartnerEntity } = useOSStore(state => ({
    partners: state.partners,
    clients: state.clients,
    deleteClient: state.deleteClient, // Renamed for clarity
    deletePartnerEntity: state.deletePartnerEntity,
  }));

  const [isHydrated, setIsHydrated] = useState(false);

  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const [isPartnerModalOpen, setIsPartnerModalOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
        setIsHydrated(true);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const openAddClientModal = () => {
    setSelectedClient(null);
    setIsClientModalOpen(true);
  };

  const openEditClientModal = (client: Client) => {
    setSelectedClient(client);
    setIsClientModalOpen(true);
  };

  const handleCloseClientModal = () => {
    setIsClientModalOpen(false);
    setSelectedClient(null);
  };

  const handleDeleteClient = async (client: Client) => {
    if (window.confirm(`Tem certeza que deseja excluir o cliente "${client.name}"? Esta ação não pode ser desfeita.`)) {
      try {
        await deleteClient(client.id); // Uses the renamed store action
        alert(`Cliente "${client.name}" excluído com sucesso.`);
      } catch (error: any) {
         alert(`Falha ao excluir cliente "${client.name}": ${error.message}`);
      }
    }
  };

  const openAddPartnerModal = () => {
    setSelectedPartner(null);
    setIsPartnerModalOpen(true);
  };

  const openEditPartnerModal = (partner: Partner) => {
    setSelectedPartner(partner);
    setIsPartnerModalOpen(true);
  };

  const handleClosePartnerModal = () => {
    setIsPartnerModalOpen(false);
    setSelectedPartner(null);
  };

  const handleDeletePartner = async (partner: Partner) => {
    if (window.confirm(`Tem certeza que deseja excluir o parceiro "${partner.name}"? Esta ação não pode ser desfeita.`)) {
      try {
        await deletePartnerEntity(partner.id);
        alert(`Parceiro "${partner.name}" excluído com sucesso.`);
      } catch (error: any) {
        alert(`Falha ao excluir parceiro "${partner.name}": ${error.message}`);
      }
    }
  };


  if (!isHydrated) {
     return (
       <AuthenticatedLayout>
         <div className="d-flex flex-column justify-content-center align-items-center text-center" style={{ minHeight: '400px' }}>
           <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
             <span className="visually-hidden">Carregando Entidades...</span>
           </div>
           <p className="text-muted">Carregando Entidades...</p>
         </div>
       </AuthenticatedLayout>
     );
   }

  return (
    <AuthenticatedLayout>
      <div className="transition-opacity">
          <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom">
            <h1 className="h3 mb-0">Gerenciamento de Entidades</h1>
            <Link href="/dashboard" className="btn btn-outline-secondary btn-sm">
              <ArrowLeft className="me-2" size={16} /> Voltar ao Painel
            </Link>
          </div>

          <div className="row">
            {/* Clients Column */}
            <div className="col-md-6">
              <div className="card shadow-sm mb-4 transition-all">
                <div className="card-header d-flex justify-content-between align-items-center">
                   <div className="d-flex align-items-center">
                        <Building size={18} className="me-2 text-success" />
                        <h2 className="h5 mb-0 card-title">Clientes</h2>
                   </div>
                   <button className="btn btn-sm btn-success" onClick={openAddClientModal}>
                       <UserPlus size={16} className="me-1" /> Adicionar Cliente
                   </button>
                </div>
                <div className="card-body">
                  {clients.length > 0 ? (
                      <ul className="list-group list-group-flush">
                        {clients.sort((a, b) => a.name.localeCompare(b.name)).map((client) => (
                          <li key={client.id} className="list-group-item">
                            <div className="d-flex justify-content-between align-items-center mb-1">
                                <span className="fw-medium">{client.name}</span>
                                <div className="btn-group btn-group-sm" role="group" aria-label="Ações do Cliente">
                                    <button className="btn btn-outline-secondary" onClick={() => openEditClientModal(client)} title="Editar Cliente">
                                        <Edit size={14} />
                                    </button>
                                    <button className="btn btn-outline-danger" onClick={() => handleDeleteClient(client)} title="Excluir Cliente">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                            {client.sourcePartnerName && (
                                <div className="small text-muted d-flex align-items-center" title={`Parceiro de Origem: ${client.sourcePartnerName}`}>
                                    <Link2 size={12} className="me-1 text-info" /> 
                                    <span>{client.sourcePartnerName}</span>
                                </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted text-center">Nenhum cliente adicionado ainda.</p>
                    )
                  }
                </div>
                <div className="card-footer text-muted small">
                  Gerencie seus clientes e seus parceiros de origem.
                </div>
              </div>
            </div>
            
            {/* Partners Column */}
            <div className="col-md-6">
              <div className="card shadow-sm mb-4 transition-all">
                <div className="card-header d-flex justify-content-between align-items-center">
                  <div className="d-flex align-items-center">
                    <Users size={18} className="me-2 text-primary" />
                    <h2 className="h5 mb-0 card-title">Parceiros</h2>
                  </div>
                   <button className="btn btn-sm btn-primary" onClick={openAddPartnerModal}>
                     <PlusCircle size={16} className="me-1" /> Adicionar Parceiro
                   </button>
                </div>
                <div className="card-body">
                  {partners.length > 0 ? (
                      <ul className="list-group list-group-flush">
                        {partners.sort((a, b) => a.name.localeCompare(b.name)).map((partner) => (
                          <li key={partner.id} className="list-group-item">
                            <div className="d-flex justify-content-between align-items-center mb-1">
                                <span className="fw-medium">{partner.name}</span>
                                <div className="btn-group btn-group-sm" role="group" aria-label="Ações do Parceiro">
                                    <button className="btn btn-outline-secondary" onClick={() => openEditPartnerModal(partner)} title="Editar Parceiro">
                                        <Edit size={14} />
                                    </button>
                                    <button className="btn btn-outline-danger" onClick={() => handleDeletePartner(partner)} title="Excluir Parceiro">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                            <div className="small text-muted">
                                {partner.username && <div>Usuário: {partner.username}</div>}
                                {partner.email && <div>Email: {partner.email}</div>}
                                {partner.contact_person && <div>Contato: {partner.contact_person}</div>}
                                <div>
                                    Status Login: {(partner.is_approved === undefined ? true : partner.is_approved) ? // Default to true if undefined for older data
                                        <span className="badge bg-success-subtle text-success-emphasis rounded-pill ms-1"><ShieldCheck size={12} className="me-1"/>Aprovado</span> : 
                                        <span className="badge bg-danger-subtle text-danger-emphasis rounded-pill ms-1"><ShieldOff size={12} className="me-1"/>Não Aprovado</span>}
                                </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted text-center">Nenhum parceiro adicionado ainda.</p>
                    )
                  }
                </div>
                <div className="card-footer text-muted small">
                  Gerencie os parceiros que podem criar e/ou executar OS.
                </div>
              </div>
            </div>

          </div>
      </div>

      {isHydrated && (
         <AddEditClientModal
            client={selectedClient}
            isOpen={isClientModalOpen}
            onClose={handleCloseClientModal}
        />
      )}

       {isHydrated && (
         <AddEditPartnerModal
            partner={selectedPartner}
            isOpen={isPartnerModalOpen}
            onClose={handleClosePartnerModal}
        />
      )}

    </AuthenticatedLayout>
  );
}
