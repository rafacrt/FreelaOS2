
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
        // SIMPLIFIED FOR DEBUGGING - NO DB CALLS
        console.warn('[Store initializeStore] DEBUG: Initializing with EMPTY data (DB calls disabled for debugging Studio login).');
        set({
          osList: [],
          clients: [],
          partners: [],
          isStoreInitialized: true,
        });
        console.log('[Store initializeStore] DEBUG: Initialized with EMPTY data.');

        // ORIGINAL LOGIC (re-enable after Studio login issue is resolved)
        // try {
        //     console.log('[Store initializeStore] Initializing from database...');
        //     const [osList, clients, partners] = await Promise.all([
        //         getAllOSFromDB(),
        //         getAllClientsFromDB(),
        //         getAllPartnersFromDB()
        //     ]);
        //     set({
        //       osList,
        //       clients,
        //       partners,
        //       isStoreInitialized: true,
        //     });
        //     console.log('[Store initializeStore] Initialized successfully:', {
        //         osCount: osList.length,
        //         clientCount: clients.length,
        //         partnerCount: partners.length,
        //     });
        // } catch (error) {
        //     console.error('[Store initializeStore] Failed to initialize from database:', error);
        //     // Set as initialized even on error to prevent repeated attempts, but with empty data.
        //     set({ osList: [], clients: [], partners: [], isStoreInitialized: true });
        // }
      },

      addOS: async (data) => {
        console.log('[Store addOS] Data:', data);
         // SIMPLIFIED FOR DEBUGGING - NO DB CALL
        console.warn('[Store addOS] DEBUG: Simulating OS creation locally (DB call disabled for debugging Studio login).');
        const tempId = `temp-os-${Date.now()}`;
        const maxNum = get().osList.reduce((max, os) => Math.max(max, parseInt(os.numero, 10) || 0), 0);
        const newOsNumero = String(maxNum + 1).padStart(6, '0');

        const tempClient: Client = get().clients.find(c => c.name === data.cliente) || { id: `temp-client-${Date.now()}`, name: data.cliente };
        let tempPartner: Partner | undefined = undefined;
        if (data.parceiro) {
            tempPartner = get().partners.find(p => p.name === data.parceiro) || { id: `temp-partner-${Date.now()}`, name: data.parceiro };
        }

        const newOS: OS = {
            id: tempId,
            numero: newOsNumero,
            cliente: tempClient.name,
            clientId: tempClient.id,
            parceiro: tempPartner?.name,
            partnerId: tempPartner?.id,
            projeto: data.projeto,
            tarefa: data.tarefa,
            observacoes: data.observacoes,
            tempoTrabalhado: data.tempoTrabalhado,
            status: data.status,
            dataAbertura: new Date().toISOString(),
            programadoPara: data.programadoPara,
            isUrgent: data.isUrgent,
        };
        set((state) => ({
            osList: [...state.osList, newOS].sort((a, b) => new Date(b.dataAbertura).getTime() - new Date(a.dataAbertura).getTime()),
            clients: state.clients.find(c => c.id === tempClient.id) ? state.clients : [...state.clients, tempClient].sort((a,b) => a.name.localeCompare(b.name)),
            partners: tempPartner && !state.partners.find(p => p.id === tempPartner!.id) ? [...state.partners, tempPartner].sort((a,b) => a.name.localeCompare(b.name)) : state.partners,
        }));
        return newOS;
        
        // ORIGINAL LOGIC (re-enable after Studio login issue is resolved)
        // try {
        //   const createdOS = await createOSInDB(data);
        //   if (createdOS) {
        //     console.log('[Store addOS] OS created in DB:', createdOS);
        //     set((state) => ({
        //       osList: [...state.osList, createdOS].sort((a, b) => {
        //         if (a.isUrgent && !b.isUrgent) return -1;
        //         if (!a.isUrgent && b.isUrgent) return 1;
        //         return new Date(b.dataAbertura).getTime() - new Date(a.dataAbertura).getTime();
        //       }),
        //     }));

        //     const clientExists = get().clients.some(c => c.id === createdOS.clientId);
        //     if (!clientExists) {
        //         console.log(`[Store addOS] Adding new client ${createdOS.cliente} (ID: ${createdOS.clientId}) locally.`);
        //         set(state => ({ clients: [...state.clients, { id: createdOS.clientId, name: createdOS.cliente }].sort((a,b) => a.name.localeCompare(b.name)) }));
        //     }
        //     if (createdOS.partnerId && createdOS.parceiro) {
        //       const partnerExists = get().partners.some(p => p.id === createdOS.partnerId);
        //       if (!partnerExists) {
        //         console.log(`[Store addOS] Adding new partner ${createdOS.parceiro} (ID: ${createdOS.partnerId}) locally.`);
        //         set(state => ({ partners: [...state.partners, { id: createdOS.partnerId!, name: createdOS.parceiro! }].sort((a,b) => a.name.localeCompare(b.name)) }));
        //       }
        //     }
        //     return createdOS;
        //   }
        //   console.error('[Store addOS] createOSInDB returned null.');
        //   return null;
        // } catch (error) {
        //     console.error("[Store addOS] Error calling createOSInDB:", error);
        //     return null;
        // }
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
            dataFinalizacao = null; 
            tempoProducaoMinutos = null;
        }

        const updatePayload = {
            status: newStatus, // Ensure status is part of the payload for optimistic update
            dataFinalizacao: dataFinalizacao === undefined ? os.dataFinalizacao : dataFinalizacao, 
            dataInicioProducao: dataInicioProducao === undefined ? os.dataInicioProducao : dataInicioProducao,
            tempoProducaoMinutos: tempoProducaoMinutos === undefined ? os.tempoProducaoMinutos : tempoProducaoMinutos,
        };
        
        // SIMPLIFIED FOR DEBUGGING - NO DB CALL
        console.warn(`[Store updateOSStatus] DEBUG: Simulating OS status update for ${osId} to ${newStatus} (DB call disabled).`);
        set((state) => ({
            osList: state.osList.map((currentOs) =>
                currentOs.id === osId ? { ...currentOs, ...updatePayload } : currentOs
            ).sort((a, b) => new Date(b.dataAbertura).getTime() - new Date(a.dataAbertura).getTime()),
        }));
        return true;

        // ORIGINAL LOGIC (re-enable after Studio login issue is resolved)
        // try {
        //   const success = await updateOSStatusInDB(osId, newStatus, updatePayload);
        //   if (success) {
        //     console.log(`[Store updateOSStatus] Successfully updated OS ${osId} to ${newStatus} in DB.`);
        //     set((state) => ({
        //       osList: state.osList.map((currentOs) =>
        //         currentOs.id === osId ? { ...currentOs, status: newStatus, ...updatePayload } : currentOs
        //       ).sort((a, b) => {
        //         if (a.isUrgent && !b.isUrgent) return -1;
        //         if (!a.isUrgent && b.isUrgent) return 1;
        //         return new Date(b.dataAbertura).getTime() - new Date(a.dataAbertura).getTime();
        //       }),
        //     }));
        //     return true;
        //   }
        //   console.error(`[Store updateOSStatus] Failed to update OS ${osId} in DB.`);
        //   return false;
        // } catch (error) {
        //   console.error(`[Store updateOSStatus] Error updating OS ${osId} status:`, error);
        //   return false;
        // }
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
            tempoTrabalhado: '', // Reset tempoTrabalhado for a new OS
            status: OSStatus.NA_FILA, // New OS starts in the queue
            programadoPara: undefined, // Reset programadoPara
            isUrgent: false, // New OS is not urgent by default
        };
        // This will use the simplified addOS for now if debugging Studio login
        return get().addOS(duplicatedOSData); 
      },

      toggleUrgent: async (osId: string) => {
        // SIMPLIFIED FOR DEBUGGING - NO DB CALL
        console.warn(`[Store toggleUrgent] DEBUG: Simulating urgency toggle for OS ${osId} (DB call disabled).`);
        const os = get().osList.find(o => o.id === osId);
        if (os) {
            const newUrgency = !os.isUrgent;
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

        // ORIGINAL LOGIC (re-enable later)
        // console.warn('[Store toggleUrgent] DB update pending. Optimistically updating client for OS ID:', osId);
        // const os = get().osList.find(o => o.id === osId);
        // if (os) {
        //     const newUrgency = !os.isUrgent;
        //     // Hypothetical server action: await updateOSUrgencyInDB(osId, newUrgency);
        //     set((state) => ({
        //       osList: state.osList.map((currentOs) =>
        //         currentOs.id === osId ? { ...currentOs, isUrgent: newUrgency } : currentOs
        //       ).sort((a, b) => {
        //         if (a.isUrgent && !b.isUrgent) return -1;
        //         if (!a.isUrgent && b.isUrgent) return 1;
        //         return new Date(b.dataAbertura).getTime() - new Date(a.dataAbertura).getTime();
        //       }),
        //     }));
        // }
      },

      getPartnerById: (partnerId) => get().partners.find(p => p.id === partnerId),
      getPartnerByName: (partnerName) => get().partners.find(p => p.name.toLowerCase() === partnerName.toLowerCase()),
      addPartner: async (partnerData) => {
        // SIMPLIFIED FOR DEBUGGING
        console.warn(`[Store addPartner] DEBUG: Simulating partner creation for ${partnerData.name} (DB call disabled).`);
        const tempId = `temp-partner-${Date.now()}`;
        const newPartner = { id: tempId, name: partnerData.name };
        set(state => ({ partners: [...state.partners, newPartner].sort((a,b) => a.name.localeCompare(b.name)) }));
        return newPartner;
        // ORIGINAL LOGIC
        // try {
        //     const newPartner = await findOrCreatePartnerByName(partnerData.name);
        //     if (newPartner) {
        //         const existing = get().partners.find(p => p.id === newPartner.id);
        //         if (!existing) {
        //              set(state => ({ partners: [...state.partners, newPartner].sort((a,b) => a.name.localeCompare(b.name)) }));
        //         }
        //         return newPartner;
        //     }
        //     return null;
        // } catch (error) {
        //     console.error("[Store addPartner] Error:", error);
        //     return null;
        // }
      },
      updatePartner: async (updatedPartner) => {
        // SIMPLIFIED FOR DEBUGGING
        console.warn('[Store updatePartner] DEBUG: Simulating partner update (DB call disabled).');
        set(state => ({
            partners: state.partners.map(p => p.id === updatedPartner.id ? updatedPartner : p).sort((a,b) => a.name.localeCompare(b.name))
        }));
      },
      deletePartner: async (partnerId) => {
        // SIMPLIFIED FOR DEBUGGING
        console.warn('[Store deletePartner] DEBUG: Simulating partner deletion (DB call disabled).');
         set(state => ({
            partners: state.partners.filter(p => p.id !== partnerId)
        }));
      },

      getClientById: (clientId) => get().clients.find(c => c.id === clientId),
      getClientByName: (clientName) => get().clients.find(c => c.name.toLowerCase() === clientName.toLowerCase()),
      addClient: async (clientData) => {
        // SIMPLIFIED FOR DEBUGGING
        console.warn(`[Store addClient] DEBUG: Simulating client creation for ${clientData.name} (DB call disabled).`);
        const tempId = `temp-client-${Date.now()}`;
        const newClient = { id: tempId, name: clientData.name };
        set(state => ({ clients: [...state.clients, newClient].sort((a,b) => a.name.localeCompare(b.name)) }));
        return newClient;
        // ORIGINAL LOGIC
        // try {
        //     const newClient = await findOrCreateClientByName(clientData.name);
        //     if (newClient) {
        //         const existing = get().clients.find(c => c.id === newClient.id);
        //         if (!existing) {
        //             set(state => ({ clients: [...state.clients, newClient].sort((a,b) => a.name.localeCompare(b.name)) }));
        //         }
        //         return newClient;
        //     }
        //      return null;
        // } catch (error) {
        //     console.error("[Store addClient] Error:", error);
        //     return null;
        // }
      },
      updateClient: async (updatedClient) => {
        // SIMPLIFIED FOR DEBUGGING
        console.warn('[Store updateClient] DEBUG: Simulating client update (DB call disabled).');
        set(state => ({
            clients: state.clients.map(c => c.id === updatedClient.id ? updatedClient : c).sort((a,b) => a.name.localeCompare(b.name))
        }));
      },
      deleteClient: async (clientId) => {
        // SIMPLIFIED FOR DEBUGGING
        console.warn('[Store deleteClient] DEBUG: Simulating client deletion (DB call disabled).');
        set(state => ({
            clients: state.clients.filter(c => c.id !== clientId)
        }));
      },
    })
);
