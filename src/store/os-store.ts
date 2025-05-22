
import { create } from 'zustand';
import type { OS, CreateOSData, Client } from '@/lib/types';
import { OSStatus } from '@/lib/types';
import { parseISO, differenceInMinutes } from 'date-fns';
import { createOSInDB, getAllOSFromDB, updateOSStatusInDB } from '@/lib/actions/os-actions';
import { findOrCreateClientByName, getAllClientsFromDB } from '@/lib/actions/client-actions';
import { findOrCreatePartnerByName, getAllPartnersFromDB } from '@/lib/actions/partner-actions';


export interface Partner {
    id: string;
    name: string;
}

interface OSState {
  osList: OS[];
  partners: Partner[];
  clients: Client[];
  isStoreInitialized: boolean; 

  initializeStore: () => Promise<void>;

  addOS: (data: CreateOSData) => Promise<OS | null>; 
  updateOS: (updatedOS: OS) => Promise<void>; // Placeholder for full OS update
  updateOSStatus: (osId: string, newStatus: OSStatus) => Promise<boolean>; // Returns boolean for success
  getOSById: (osId: string) => OS | undefined;
  duplicateOS: (osId: string) => Promise<OS | null>;
  toggleUrgent: (osId: string) => Promise<void>; // Placeholder for DB update

  addPartner: (partnerData: { name: string }) => Promise<Partner | null>;
  updatePartner: (updatedPartner: Partner) => Promise<void>;
  deletePartner: (partnerId: string) => Promise<void>;
  getPartnerById: (partnerId: string) => Partner | undefined;
  getPartnerByName: (partnerName: string) => Partner | undefined;

  addClient: (clientData: { name: string }) => Promise<Client | null>;
  updateClient: (updatedClient: Client) => Promise<void>;
  deleteClient: (clientId: string) => Promise<void>;
  getClientById: (clientId: string) => Client | undefined;
  getClientByName: (clientName: string) => Client | undefined;
}


export const useOSStore = create<OSState>()(
    (set, get) => ({
      osList: [],
      partners: [],
      clients: [],
      isStoreInitialized: false,

      initializeStore: async () => {
        if (get().isStoreInitialized) {
            console.log('[Store initializeStore] Already initialized.');
            return;
        }
        try {
            console.log('[Store initializeStore] Initializing from database...');
            const [osList, clients, partners] = await Promise.all([
                getAllOSFromDB(),
                getAllClientsFromDB(),
                getAllPartnersFromDB()
            ]);
            set({
              osList,
              clients,
              partners,
              isStoreInitialized: true,
            });
            console.log('[Store initializeStore] Initialized successfully:', {
                osCount: osList.length,
                clientCount: clients.length,
                partnerCount: partners.length,
            });
        } catch (error) {
            console.error('[Store initializeStore] Failed to initialize from database:', error);
        }
      },

      addOS: async (data) => {
        console.log('[Store addOS] Data:', data);
        try {
          const newOS = await createOSInDB(data);
          if (newOS) {
            console.log('[Store addOS] OS created in DB:', newOS);
            set((state) => ({
              osList: [...state.osList, newOS].sort((a, b) => {
                if (a.isUrgent && !b.isUrgent) return -1;
                if (!a.isUrgent && b.isUrgent) return 1;
                return new Date(b.dataAbertura).getTime() - new Date(a.dataAbertura).getTime();
              }),
            }));

            const clientExists = get().clients.some(c => c.id === newOS.clientId);
            if (!clientExists) {
                console.log(`[Store addOS] Adding new client ${newOS.cliente} (ID: ${newOS.clientId}) locally.`);
                set(state => ({ clients: [...state.clients, { id: newOS.clientId, name: newOS.cliente }].sort((a,b) => a.name.localeCompare(b.name)) }));
            }
            if (newOS.partnerId && newOS.parceiro) {
              const partnerExists = get().partners.some(p => p.id === newOS.partnerId);
              if (!partnerExists) {
                console.log(`[Store addOS] Adding new partner ${newOS.parceiro} (ID: ${newOS.partnerId}) locally.`);
                set(state => ({ partners: [...state.partners, { id: newOS.partnerId!, name: newOS.parceiro! }].sort((a,b) => a.name.localeCompare(b.name)) }));
              }
            }
            return newOS;
          }
          console.error('[Store addOS] createOSInDB returned null.');
          return null;
        } catch (error) {
            console.error("[Store addOS] Error calling createOSInDB:", error);
            return null;
        }
      },

      updateOS: async (updatedOSData) => {
        console.warn('[Store updateOS] DB update pending. Optimistically updating client for OS ID:', updatedOSData.id);
        // TODO: Call server action to update full OS details in DB
        set((state) => ({
          osList: state.osList.map((os) =>
            os.id === updatedOSData.id ? { ...os, ...updatedOSData } : os
          ).sort((a, b) => {
            if (a.isUrgent && !b.isUrgent) return -1;
            if (!a.isUrgent && b.isUrgent) return 1;
            return new Date(b.dataAbertura).getTime() - new Date(a.dataAbertura).getTime();
          }),
        }));
      },

      updateOSStatus: async (osId, newStatus) => {
        const os = get().osList.find(o => o.id === osId);
        if (!os) {
          console.error(`[Store updateOSStatus] OS with ID ${osId} not found.`);
          return false;
        }

        const now = new Date().toISOString();
        let dataInicioProducao = os.dataInicioProducao;
        let tempoProducaoMinutos = os.tempoProducaoMinutos;
        let dataFinalizacao = os.dataFinalizacao;

        if (newStatus === OSStatus.EM_PRODUCAO && os.status !== OSStatus.EM_PRODUCAO && !dataInicioProducao) {
          dataInicioProducao = now;
        }

        if (newStatus === OSStatus.FINALIZADO && os.status !== OSStatus.FINALIZADO) {
          dataFinalizacao = now;
          const startProduction = dataInicioProducao || (os.status === OSStatus.EM_PRODUCAO ? os.dataInicioProducao : null);
          if (startProduction) {
              tempoProducaoMinutos = differenceInMinutes(parseISO(now), parseISO(startProduction));
          }
        }
        
        if (newStatus !== OSStatus.FINALIZADO && os.status === OSStatus.FINALIZADO) {
            dataFinalizacao = null; // Use null for DB
            tempoProducaoMinutos = null; // Use null for DB
        }

        const updatePayload = {
            dataFinalizacao: dataFinalizacao === undefined ? os.dataFinalizacao : dataFinalizacao, // keep existing if not changed
            dataInicioProducao: dataInicioProducao === undefined ? os.dataInicioProducao : dataInicioProducao,
            tempoProducaoMinutos: tempoProducaoMinutos === undefined ? os.tempoProducaoMinutos : tempoProducaoMinutos,
        };
        
        try {
          const success = await updateOSStatusInDB(osId, newStatus, updatePayload);
          if (success) {
            console.log(`[Store updateOSStatus] Successfully updated OS ${osId} to ${newStatus} in DB.`);
            set((state) => ({
              osList: state.osList.map((currentOs) =>
                currentOs.id === osId ? { ...currentOs, status: newStatus, ...updatePayload } : currentOs
              ).sort((a, b) => {
                if (a.isUrgent && !b.isUrgent) return -1;
                if (!a.isUrgent && b.isUrgent) return 1;
                return new Date(b.dataAbertura).getTime() - new Date(a.dataAbertura).getTime();
              }),
            }));
            return true;
          }
          console.error(`[Store updateOSStatus] Failed to update OS ${osId} in DB.`);
          return false;
        } catch (error) {
          console.error(`[Store updateOSStatus] Error updating OS ${osId} status:`, error);
          return false;
        }
      },

      getOSById: (osId) => {
        return get().osList.find((os) => os.id === osId);
      },

      duplicateOS: async (osId: string) => {
        const osToDuplicate = get().osList.find(os => os.id === osId);
        if (!osToDuplicate) {
            console.error(`[Store duplicateOS] OS ID ${osId} not found.`);
            return null;
        }
        const duplicatedOSData: CreateOSData = {
            cliente: osToDuplicate.cliente, 
            parceiro: osToDuplicate.parceiro, 
            projeto: `${osToDuplicate.projeto} (Cópia)`,
            tarefa: osToDuplicate.tarefa,
            observacoes: osToDuplicate.observacoes,
            tempoTrabalhado: '',
            status: OSStatus.NA_FILA,
            programadoPara: undefined,
            isUrgent: false,
        };
        return get().addOS(duplicatedOSData); // Reuse addOS logic which handles DB and state
      },

      toggleUrgent: async (osId: string) => {
        console.warn('[Store toggleUrgent] DB update pending. Optimistically updating client for OS ID:', osId);
        // TODO: Call server action to update isUrgent in DB
        // For now, just update local state
        const os = get().osList.find(o => o.id === osId);
        if (os) {
            const newUrgency = !os.isUrgent;
            // Hypothetical server action: await updateOSUrgencyInDB(osId, newUrgency);
            set((state) => ({
              osList: state.osList.map((currentOs) =>
                currentOs.id === osId ? { ...currentOs, isUrgent: newUrgency } : currentOs
              ).sort((a, b) => {
                if (a.isUrgent && !b.isUrgent) return -1;
                if (!a.isUrgent && b.isUrgent) return 1;
                return new Date(b.dataAbertura).getTime() - new Date(a.dataAbertura).getTime();
              }),
            }));
        }
      },

      getPartnerById: (partnerId) => get().partners.find(p => p.id === partnerId),
      getPartnerByName: (partnerName) => get().partners.find(p => p.name.toLowerCase() === partnerName.toLowerCase()),
      addPartner: async (partnerData) => {
        try {
            const newPartner = await findOrCreatePartnerByName(partnerData.name);
            if (newPartner) {
                const existing = get().partners.find(p => p.id === newPartner.id);
                if (!existing) {
                     set(state => ({ partners: [...state.partners, newPartner].sort((a,b) => a.name.localeCompare(b.name)) }));
                }
                return newPartner;
            }
            return null;
        } catch (error) {
            console.error("[Store addPartner] Error:", error);
            return null;
        }
      },
      updatePartner: async (updatedPartner) => {
        console.warn('[Store updatePartner] DB update pending for partner ID:', updatedPartner.id);
        set(state => ({
            partners: state.partners.map(p => p.id === updatedPartner.id ? updatedPartner : p).sort((a,b) => a.name.localeCompare(b.name))
        }));
      },
      deletePartner: async (partnerId) => {
        console.warn('[Store deletePartner] DB update pending for partner ID:', partnerId);
         set(state => ({
            partners: state.partners.filter(p => p.id !== partnerId)
        }));
      },

      getClientById: (clientId) => get().clients.find(c => c.id === clientId),
      getClientByName: (clientName) => get().clients.find(c => c.name.toLowerCase() === clientName.toLowerCase()),
      addClient: async (clientData) => {
        try {
            const newClient = await findOrCreateClientByName(clientData.name);
            if (newClient) {
                const existing = get().clients.find(c => c.id === newClient.id);
                if (!existing) {
                    set(state => ({ clients: [...state.clients, newClient].sort((a,b) => a.name.localeCompare(b.name)) }));
                }
                return newClient;
            }
             return null;
        } catch (error) {
            console.error("[Store addClient] Error:", error);
            return null;
        }
      },
      updateClient: async (updatedClient) => {
        console.warn('[Store updateClient] DB update pending for client ID:', updatedClient.id);
        set(state => ({
            clients: state.clients.map(c => c.id === updatedClient.id ? updatedClient : c).sort((a,b) => a.name.localeCompare(b.name))
        }));
      },
      deleteClient: async (clientId) => {
        console.warn('[Store deleteClient] DB update pending for client ID:', clientId);
        set(state => ({
            clients: state.clients.filter(c => c.id !== clientId)
        }));
      },
    })
);
