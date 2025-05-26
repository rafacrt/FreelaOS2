
import { create } from 'zustand';
import type { OS, CreateOSData, Client } from '@/lib/types';
import { OSStatus } from '@/lib/types';
// import { parseISO, differenceInSeconds, isValid } from 'date-fns'; // Not used directly here anymore for time calc
import { 
    createOSInDB, 
    getAllOSFromDB, 
    updateOSStatusInDB, 
    updateOSInDB as updateOSActionDB,
    toggleOSProductionTimerInDB
} from '@/lib/actions/os-actions';
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
  updateOS: (updatedOS: OS) => Promise<OS | null>;
  updateOSStatus: (osId: string, newStatus: OSStatus) => Promise<OS | null>; 
  getOSById: (osId: string) => OS | undefined;
  duplicateOS: (osId: string) => Promise<OS | null>;
  toggleUrgent: (osId: string) => Promise<void>;
  toggleProductionTimer: (osId: string, action: 'play' | 'pause') => Promise<OS | null>;

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
            console.log('[Store initializeStore] Store já inicializado.');
            return;
        }
        console.log('[Store initializeStore] Tentando inicializar o store a partir do DB...');
        try {
            const [osList, clients, partners] = await Promise.all([
                getAllOSFromDB(),
                getAllClientsFromDB(),
                getAllPartnersFromDB()
            ]);
            set({
              osList: osList || [], 
              clients: clients || [],
              partners: partners || [],
              isStoreInitialized: true,
            });
            console.log('[Store initializeStore] Store inicializado com sucesso do DB:', {
                osCount: osList?.length || 0,
                clientCount: clients?.length || 0,
                partnerCount: partners?.length || 0,
            });
        } catch (error) {
            console.error('[Store initializeStore] Falha ao inicializar store do DB:', error);
            set({ osList: [], clients: [], partners: [], isStoreInitialized: true }); 
        }
      },

      addOS: async (data) => {
        console.log('[Store addOS] Iniciando addOS com dados:', JSON.stringify(data, null, 2));
        try {
          const createdOS = await createOSInDB(data); 
          if (createdOS) {
            console.log('[Store addOS] OS criada no DB:', JSON.stringify(createdOS, null, 2));
            set((state) => ({
              osList: [...state.osList, { ...createdOS }].sort((a, b) => { // Ensure new reference
                if (a.isUrgent && !b.isUrgent) return -1;
                if (!a.isUrgent && b.isUrgent) return 1;
                return new Date(b.dataAbertura).getTime() - new Date(a.dataAbertura).getTime();
              }),
            }));

            const clientExists = get().clients.some(c => c.id === createdOS.clientId);
            if (!clientExists && createdOS.clientId && createdOS.cliente) {
                console.log(`[Store addOS] Adicionando novo cliente ${createdOS.cliente} (ID: ${createdOS.clientId}) localmente.`);
                set(state => ({ clients: [...state.clients, { id: createdOS.clientId, name: createdOS.cliente }].sort((a,b) => a.name.localeCompare(b.name)) }));
            }
            if (createdOS.partnerId && createdOS.parceiro) {
              const partnerExists = get().partners.some(p => p.id === createdOS.partnerId);
              if (!partnerExists) {
                console.log(`[Store addOS] Adicionando novo parceiro ${createdOS.parceiro} (ID: ${createdOS.partnerId}) localmente.`);
                set(state => ({ partners: [...state.partners, { id: createdOS.partnerId!, name: createdOS.parceiro! }].sort((a,b) => a.name.localeCompare(b.name)) }));
              }
            }
            console.log('[Store addOS] Estado do store atualizado com nova OS.');
            return createdOS;
          }
          console.error('[Store addOS] createOSInDB retornou null.');
          return null;
        } catch (error: any) {
            console.error("[Store addOS] Erro ao chamar createOSInDB:", error.message, error.stack);
            return null;
        }
      },

      updateOS: async (updatedOSData) => {
        console.log('[Store updateOS] Chamado com dados:', JSON.stringify(updatedOSData, null, 2));
        try {
            const savedOS = await updateOSActionDB(updatedOSData); 
            if (savedOS) {
                console.log('[Store updateOS] OS atualizada no DB retornada pela Action:', JSON.stringify(savedOS, null, 2));
                set((state) => ({
                    osList: state.osList.map((os) =>
                        os.id === savedOS.id ? { ...savedOS } : os // Ensure new reference
                    ).sort((a, b) => {
                        if (a.isUrgent && !b.isUrgent) return -1;
                        if (!a.isUrgent && b.isUrgent) return 1;
                        return new Date(b.dataAbertura).getTime() - new Date(a.dataAbertura).getTime();
                    }),
                }));
                 if (savedOS.clientId && savedOS.cliente && !get().clients.some(c => c.id === savedOS.clientId && c.name === savedOS.cliente)) {
                    console.log(`[Store updateOS] Cliente ${savedOS.cliente} (ID: ${savedOS.clientId}) parece ser novo ou atualizado, adicionando/atualizando localmente.`);
                    set(state => ({ clients: [...state.clients.filter(c => c.id !== savedOS.clientId), { id: savedOS.clientId, name: savedOS.cliente }].sort((a,b) => a.name.localeCompare(b.name)) }));
                }
                if (savedOS.partnerId && savedOS.parceiro && !get().partners.some(p => p.id === savedOS.partnerId && p.name === savedOS.parceiro)) {
                     console.log(`[Store updateOS] Parceiro ${savedOS.parceiro} (ID: ${savedOS.partnerId}) parece ser novo ou atualizado, adicionando/atualizando localmente.`);
                    set(state => ({ partners: [...state.partners.filter(p => p.id !== savedOS.partnerId), { id: savedOS.partnerId!, name: savedOS.parceiro! }].sort((a,b) => a.name.localeCompare(b.name)) }));
                }
                console.log('[Store updateOS] Estado do store atualizado com OS modificada.');
                return savedOS;
            }
            console.error('[Store updateOS] updateOSActionDB retornou null ou um erro ocorreu.');
            return null;
        } catch (error: any) {
            console.error("[Store updateOS] Erro ao chamar updateOSActionDB:", error.message, error.stack);
            return null; 
        }
      },

      updateOSStatus: async (osId, newStatus) => {
        console.log(`[Store updateOSStatus] Iniciando para OS ID: ${osId}, Novo Status: ${newStatus}`);
        try {
          const updatedOS = await updateOSStatusInDB(osId, newStatus);
          if (updatedOS) {
            console.log(`[Store updateOSStatus] Status da OS ${osId} atualizado com sucesso no DB. OS retornada:`, JSON.stringify(updatedOS, null, 2));
            set((state) => ({
              osList: state.osList.map((currentOs) =>
                currentOs.id === osId ? { ...updatedOS } : currentOs // Ensure new reference
              ).sort((a, b) => {
                if (a.isUrgent && !b.isUrgent) return -1;
                if (!a.isUrgent && b.isUrgent) return 1;
                return new Date(b.dataAbertura).getTime() - new Date(a.dataAbertura).getTime();
              }),
            }));
            console.log('[Store updateOSStatus] Estado do store atualizado.');
            return updatedOS;
          }
          console.error(`[Store updateOSStatus] Falha ao atualizar status da OS ${osId} no DB (updateOSStatusInDB retornou null).`);
          return null;
        } catch (error: any) {
          console.error(`[Store updateOSStatus] Erro ao atualizar status da OS ${osId}:`, error.message, error.stack);
          return null;
        }
      },
      
      toggleProductionTimer: async (osId: string, action: 'play' | 'pause') => {
        console.log(`[Store toggleProductionTimer] OS ID: ${osId}, Ação: ${action}`);
        try {
            const updatedOS = await toggleOSProductionTimerInDB(osId, action);
            if (updatedOS) {
                console.log(`[Store toggleProductionTimer] Timer da OS ${osId} atualizado no DB. OS retornada:`, JSON.stringify(updatedOS, null, 2));
                set((state) => ({
                    osList: state.osList.map((os) =>
                        os.id === osId ? { ...updatedOS } : os // Ensure new reference
                    ).sort((a, b) => { 
                        if (a.isUrgent && !b.isUrgent) return -1;
                        if (!a.isUrgent && b.isUrgent) return 1;
                        return new Date(b.dataAbertura).getTime() - new Date(a.dataAbertura).getTime();
                    }),
                }));
                console.log(`[Store toggleProductionTimer] Estado do store atualizado para OS ID: ${osId}.`);
                return updatedOS;
            }
            console.error(`[Store toggleProductionTimer] Falha ao alternar timer para OS ${osId} no DB.`);
            return null;
        } catch (error) {
            console.error(`[Store toggleProductionTimer] Erro ao alternar timer para OS ${osId}:`, error);
            return null;
        }
      },

      getOSById: (osId) => {
        const os = get().osList.find((os) => os.id === osId);
        console.log(`[Store getOSById] Buscando OS ID: ${osId}. Encontrada:`, !!os);
        return os;
      },

      duplicateOS: async (osId: string) => {
        console.log(`[Store duplicateOS] Tentando duplicar OS ID: ${osId}`);
        const osToDuplicate = get().osList.find(os => os.id === osId);
        if (!osToDuplicate) {
            console.error(`[Store duplicateOS] OS ID ${osId} não encontrada para duplicar.`);
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
        console.log('[Store duplicateOS] Dados para nova OS duplicada:', JSON.stringify(duplicatedOSData, null, 2));
        return get().addOS(duplicatedOSData);
      },

      toggleUrgent: async (osId: string) => {
        console.log(`[Store toggleUrgent] Tentando alternar urgência para OS ID: ${osId}`);
        const os = get().osList.find(o => o.id === osId);
        if (os) {
            const newUrgency = !os.isUrgent;
            const updatedOSWithUrgency: OS = { ...os, isUrgent: newUrgency };
            
            console.log(`[Store toggleUrgent] Tentando chamar updateOSActionDB para OS ID: ${osId} com urgência ${newUrgency}.`);
            const savedOS = await updateOSActionDB(updatedOSWithUrgency);
            
            if (savedOS) {
                console.log(`[Store toggleUrgent] Urgência da OS ID: ${osId} atualizada no DB para ${newUrgency}. OS retornada:`, JSON.stringify(savedOS, null, 2));
                set((state) => ({
                  osList: state.osList.map((currentOs) =>
                    currentOs.id === osId ? { ...savedOS } : currentOs // Ensure new reference
                  ).sort((a, b) => {
                    if (a.isUrgent && !b.isUrgent) return -1;
                    if (!a.isUrgent && b.isUrgent) return 1;
                    return new Date(b.dataAbertura).getTime() - new Date(a.dataAbertura).getTime();
                  }),
                }));
                console.log(`[Store toggleUrgent] Urgência alternada e estado local atualizado para OS ID: ${osId}.`);
            } else {
                 console.error(`[Store toggleUrgent] Falha ao atualizar urgência da OS ID ${osId} no DB (updateOSActionDB retornou null).`);
            }
        } else {
            console.error(`[Store toggleUrgent] OS ID ${osId} não encontrada.`);
        }
      },

      // --- Partner Actions ---
      getPartnerById: (partnerId) => {
          const partner = get().partners.find(p => p.id === partnerId);
          return partner;
      },
      getPartnerByName: (partnerName) => {
          const partner = get().partners.find(p => p.name.toLowerCase() === partnerName.toLowerCase());
          return partner;
      },
      addPartner: async (partnerData) => {
        console.log('[Store addPartner] Adicionando parceiro:', partnerData.name);
        try {
            const newPartner = await findOrCreatePartnerByName(partnerData.name); 
            if (newPartner) {
                const existing = get().partners.find(p => p.id === newPartner.id);
                if (!existing) {
                     set(state => ({ partners: [...state.partners, newPartner].sort((a,b) => a.name.localeCompare(b.name)) }));
                     console.log('[Store addPartner] Novo parceiro adicionado ao store local:', newPartner);
                } else {
                    console.log('[Store addPartner] Parceiro já existia no store local (ou foi encontrado no DB):', newPartner);
                }
                return newPartner;
            }
            console.error('[Store addPartner] findOrCreatePartnerByName retornou null.');
            return null;
        } catch (error: any) {
            console.error("[Store addPartner] Erro ao adicionar parceiro:", error.message, error.stack);
            return null;
        }
      },
      updatePartner: async (updatedPartner) => {
        // TODO: Implementar Server Action para updatePartnerInDB
        console.warn(`[Store updatePartner] ATENÇÃO: Atualização de parceiro no DB pendente para ID: ${updatedPartner.id}. Nome: ${updatedPartner.name}. Implementar Server Action.`);
        set(state => ({
            partners: state.partners.map(p => p.id === updatedPartner.id ? updatedPartner : p).sort((a,b) => a.name.localeCompare(b.name))
        }));
        console.log('[Store updatePartner] Parceiro atualizado localmente (sem persistência no DB).');
      },
      deletePartner: async (partnerId) => {
        // TODO: Implementar Server Action para deletePartnerInDB
        console.warn(`[Store deletePartner] ATENÇÃO: Deleção de parceiro no DB pendente para ID: ${partnerId}. Implementar Server Action.`);
         set(state => ({
            partners: state.partners.filter(p => p.id !== partnerId)
        }));
        console.log('[Store deletePartner] Parceiro deletado localmente (sem persistência no DB).');
      },

      // --- Client Actions ---
      getClientById: (clientId) => {
          const client = get().clients.find(c => c.id === clientId);
          return client;
        },
      getClientByName: (clientName) => {
          const client = get().clients.find(c => c.name.toLowerCase() === clientName.toLowerCase());
          return client;
      },
      addClient: async (clientData) => {
        console.log('[Store addClient] Adicionando cliente:', clientData.name);
        try {
            const newClient = await findOrCreateClientByName(clientData.name); 
            if (newClient) {
                const existing = get().clients.find(c => c.id === newClient.id);
                if (!existing) {
                    set(state => ({ clients: [...state.clients, newClient].sort((a,b) => a.name.localeCompare(b.name)) }));
                    console.log('[Store addClient] Novo cliente adicionado ao store local:', newClient);
                } else {
                    console.log('[Store addClient] Cliente já existia no store local (ou foi encontrado no DB):', newClient);
                }
                return newClient;
            }
            console.error('[Store addClient] findOrCreateClientByName retornou null.');
            return null;
        } catch (error: any) {
            console.error("[Store addClient] Erro ao adicionar cliente:", error.message, error.stack);
            return null;
        }
      },
      updateClient: async (updatedClient) => {
        // TODO: Implementar Server Action para updateClientInDB
        console.warn(`[Store updateClient] ATENÇÃO: Atualização de cliente no DB pendente para ID: ${updatedClient.id}. Nome: ${updatedClient.name}. Implementar Server Action.`);
        set(state => ({
            clients: state.clients.map(c => c.id === updatedClient.id ? updatedClient : c).sort((a,b) => a.name.localeCompare(b.name))
        }));
        console.log('[Store updateClient] Cliente atualizado localmente (sem persistência no DB).');
      },
      deleteClient: async (clientId) => {
        // TODO: Implementar Server Action para deleteClientInDB
        console.warn(`[Store deleteClient] ATENÇÃO: Deleção de cliente no DB pendente para ID: ${clientId}. Implementar Server Action.`);
        set(state => ({
            clients: state.clients.filter(c => c.id !== clientId)
        }));
        console.log('[Store deleteClient] Cliente deletado localmente (sem persistência no DB).');
      },
    })
);
