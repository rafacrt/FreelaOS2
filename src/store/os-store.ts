
import { create } from 'zustand';
import type { OS, CreateOSData, Client, ChecklistItem } from '@/lib/types';
import { OSStatus } from '@/lib/types';
import { 
    createOSInDB, 
    getAllOSFromDB, 
    updateOSStatusInDB, 
    updateOSInDB as updateOSActionDB,
    toggleOSProductionTimerInDB
} from '@/lib/actions/os-actions';
import { findOrCreateClientByName, getAllClientsFromDB } from '@/lib/actions/client-actions';
import { 
    getAllPartnersFromDB, 
    createPartner as createPartnerAction, 
    updatePartnerDetails as updatePartnerDetailsAction, 
    deletePartnerById as deletePartnerByIdAction,
    type CreatePartnerData,
    type UpdatePartnerDetailsData
} from '@/lib/actions/partner-actions';


export interface Partner {
    id: string;
    name: string;
    username?: string;
    email?: string;
    contact_person?: string;
    is_approved?: boolean;
}

interface OSState {
  osList: OS[];
  partners: Partner[];
  clients: Client[];
  isStoreInitialized: boolean;

  initializeStore: () => Promise<void>;

  addOS: (data: CreateOSData, createdByPartnerId?: string) => Promise<OS | null>;
  updateOS: (updatedOS: OS) => Promise<OS | null>;
  updateOSStatus: (osId: string, newStatus: OSStatus) => Promise<OS | null>; 
  getOSById: (osId: string) => OS | undefined;
  duplicateOS: (osId: string) => Promise<OS | null>;
  toggleUrgent: (osId: string) => Promise<void>;
  toggleProductionTimer: (osId: string, action: 'play' | 'pause') => Promise<OS | null>;

  addPartnerEntity: (partnerData: CreatePartnerData) => Promise<Partner | null>; 
  updatePartnerEntity: (updatedPartnerData: UpdatePartnerDetailsData) => Promise<Partner | null>; 
  deletePartnerEntity: (partnerId: string) => Promise<boolean>; 
  getPartnerEntityById: (partnerId: string) => Partner | undefined;
  getPartnerEntityByName: (partnerName: string) => Partner | undefined;

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
            const [osListFromDB, clientsFromDB, partnersFromDB] = await Promise.all([
                getAllOSFromDB(),
                getAllClientsFromDB(),
                getAllPartnersFromDB()
            ]);
            
            const processedOSList = osListFromDB.map(os => ({
                ...os,
                checklist: os.checklist || [], 
            }));

            set({
              osList: processedOSList || [], 
              clients: clientsFromDB || [],
              partners: partnersFromDB || [],
              isStoreInitialized: true,
            });
            console.log('[Store initializeStore] Store inicializado com sucesso do DB:', {
                osCount: processedOSList?.length || 0,
                clientCount: clientsFromDB?.length || 0,
                partnerCount: partnersFromDB?.length || 0,
            });
        } catch (error) {
            console.error('[Store initializeStore] Falha ao inicializar store do DB:', error);
            set({ osList: [], clients: [], partners: [], isStoreInitialized: true }); 
        }
      },

      addOS: async (data, createdByPartnerId?: string) => {
        console.log('[Store addOS] Iniciando addOS com dados:', JSON.stringify(data, null, 2), `Criado por Parceiro ID: ${createdByPartnerId}`);
        try {
          const createdOS = await createOSInDB(data, createdByPartnerId); 
          if (createdOS) {
            console.log('[Store addOS] OS criada no DB:', JSON.stringify(createdOS, null, 2));
            const newOSWithDefaults = {
                ...createdOS,
                checklist: createdOS.checklist || [], 
            };
            set((state) => ({
              osList: [...state.osList, newOSWithDefaults].sort((a, b) => { 
                if (a.isUrgent && !b.isUrgent) return -1;
                if (!a.isUrgent && b.isUrgent) return 1;
                return new Date(b.dataAbertura).getTime() - new Date(a.dataAbertura).getTime();
              }),
            }));

            const clientExists = get().clients.some(c => c.id === newOSWithDefaults.clientId);
            if (!clientExists && newOSWithDefaults.clientId && newOSWithDefaults.cliente) {
                console.log(`[Store addOS] Adicionando novo cliente ${newOSWithDefaults.cliente} (ID: ${newOSWithDefaults.clientId}) localmente.`);
                set(state => ({ clients: [...state.clients, { id: newOSWithDefaults.clientId, name: newOSWithDefaults.cliente }].sort((a,b) => a.name.localeCompare(b.name)) }));
            }
            if (newOSWithDefaults.partnerId && newOSWithDefaults.parceiro) {
              const execPartnerExists = get().partners.some(p => p.id === newOSWithDefaults.partnerId);
              if (!execPartnerExists) {
                console.log(`[Store addOS] Adicionando novo parceiro de execução ${newOSWithDefaults.parceiro} (ID: ${newOSWithDefaults.partnerId}) localmente.`);
                // Ensure the partner object has all required fields if adding it this way
                const newPartnerEntry: Partner = { id: newOSWithDefaults.partnerId, name: newOSWithDefaults.parceiro, is_approved: false }; // Defaults for other fields
                set(state => ({ partners: [...state.partners, newPartnerEntry].sort((a,b) => a.name.localeCompare(b.name)) }));
              }
            }
            console.log('[Store addOS] Estado do store atualizado com nova OS.');
            return newOSWithDefaults;
          }
          console.error('[Store addOS] createOSInDB retornou null.');
          return null;
        } catch (error: any) {
            console.error("[Store addOS] Erro ao chamar createOSInDB:", error.message, error.stack);
            throw error;
        }
      },

      updateOS: async (updatedOSData) => {
        console.log('[Store updateOS] Chamado com dados:', JSON.stringify(updatedOSData, null, 2));
        try {
            const savedOS = await updateOSActionDB(updatedOSData); 
            if (savedOS) {
                console.log('[Store updateOS] OS atualizada no DB retornada pela Action:', JSON.stringify(savedOS, null, 2));
                const updatedOSWithDefaults = {
                    ...savedOS,
                    checklist: savedOS.checklist || [], 
                };
                set((state) => ({
                    osList: state.osList.map((os) =>
                        os.id === updatedOSWithDefaults.id ? { ...updatedOSWithDefaults } : os 
                    ).sort((a, b) => {
                        if (a.isUrgent && !b.isUrgent) return -1;
                        if (!a.isUrgent && b.isUrgent) return 1;
                        return new Date(b.dataAbertura).getTime() - new Date(a.dataAbertura).getTime();
                    }),
                }));
                 if (updatedOSWithDefaults.clientId && updatedOSWithDefaults.cliente && !get().clients.some(c => c.id === updatedOSWithDefaults.clientId && c.name === updatedOSWithDefaults.cliente)) {
                    console.log(`[Store updateOS] Cliente ${updatedOSWithDefaults.cliente} (ID: ${updatedOSWithDefaults.clientId}) parece ser novo ou atualizado, adicionando/atualizando localmente.`);
                    set(state => ({ clients: [...state.clients.filter(c => c.id !== updatedOSWithDefaults.clientId), { id: updatedOSWithDefaults.clientId, name: updatedOSWithDefaults.cliente }].sort((a,b) => a.name.localeCompare(b.name)) }));
                }
                if (updatedOSWithDefaults.partnerId && updatedOSWithDefaults.parceiro && !get().partners.some(p => p.id === updatedOSWithDefaults.partnerId && p.name === updatedOSWithDefaults.parceiro)) {
                     console.log(`[Store updateOS] Parceiro de execução ${updatedOSWithDefaults.parceiro} (ID: ${updatedOSWithDefaults.partnerId}) parece ser novo ou atualizado, adicionando/atualizando localmente.`);
                    // Ensure the partner object has all required fields
                    const partnerEntry: Partner = { id: updatedOSWithDefaults.partnerId, name: updatedOSWithDefaults.parceiro, is_approved: false }; // Defaults
                    set(state => ({ partners: [...state.partners.filter(p => p.id !== updatedOSWithDefaults.partnerId), partnerEntry].sort((a,b) => a.name.localeCompare(b.name)) }));
                }
                console.log('[Store updateOS] Estado do store atualizado com OS modificada.');
                return updatedOSWithDefaults;
            }
            console.error('[Store updateOS] updateOSActionDB retornou null ou um erro ocorreu.');
            return null;
        } catch (error: any) {
            console.error("[Store updateOS] Erro ao chamar updateOSActionDB:", error.message, error.stack);
            throw error;
        }
      },

      updateOSStatus: async (osId, newStatus) => {
        console.log(`[Store updateOSStatus] Iniciando para OS ID: ${osId}, Novo Status: ${newStatus}`);
        try {
          const updatedOS = await updateOSStatusInDB(osId, newStatus);
          if (updatedOS) {
            console.log(`[Store updateOSStatus] Status da OS ${osId} atualizado com sucesso no DB. OS retornada:`, JSON.stringify(updatedOS, null, 2));
            const updatedOSWithDefaults = {
                ...updatedOS,
                checklist: updatedOS.checklist || [],
            };
            set((state) => ({
              osList: state.osList.map((currentOs) =>
                currentOs.id === osId ? { ...updatedOSWithDefaults } : currentOs 
              ).sort((a, b) => {
                if (a.isUrgent && !b.isUrgent) return -1;
                if (!a.isUrgent && b.isUrgent) return 1;
                return new Date(b.dataAbertura).getTime() - new Date(a.dataAbertura).getTime();
              }),
            }));
            console.log('[Store updateOSStatus] Estado do store atualizado.');
            return updatedOSWithDefaults;
          }
          console.error(`[Store updateOSStatus] Falha ao atualizar status da OS ${osId} no DB (updateOSStatusInDB retornou null).`);
          return null;
        } catch (error: any) {
          console.error(`[Store updateOSStatus] Erro ao atualizar status da OS ${osId}:`, error.message, error.stack);
          throw error;
        }
      },
      
      toggleProductionTimer: async (osId: string, action: 'play' | 'pause') => {
        console.log(`[Store toggleProductionTimer] OS ID: ${osId}, Ação: ${action}`);
        try {
            const updatedOS = await toggleOSProductionTimerInDB(osId, action);
            if (updatedOS) {
                console.log(`[Store toggleProductionTimer] Timer da OS ${osId} atualizado no DB. OS retornada:`, JSON.stringify(updatedOS, null, 2));
                const updatedOSWithDefaults = {
                    ...updatedOS,
                    checklist: updatedOS.checklist || [],
                };
                set((state) => ({
                    osList: state.osList.map((os) =>
                        os.id === osId ? { ...updatedOSWithDefaults } : os 
                    ).sort((a, b) => { 
                        if (a.isUrgent && !b.isUrgent) return -1;
                        if (!a.isUrgent && b.isUrgent) return 1;
                        return new Date(b.dataAbertura).getTime() - new Date(a.dataAbertura).getTime();
                    }),
                }));
                console.log(`[Store toggleProductionTimer] Estado do store atualizado para OS ID: ${osId}.`);
                return updatedOSWithDefaults;
            }
            console.error(`[Store toggleProductionTimer] Falha ao alternar timer para OS ${osId} no DB.`);
            return null;
        } catch (error: any) {
            console.error(`[Store toggleProductionTimer] Erro ao alternar timer para OS ${osId}:`, error);
            throw error;
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
            status: OSStatus.NA_FILA, 
            programadoPara: undefined, 
            isUrgent: false, 
            checklistItems: osToDuplicate.checklist ? osToDuplicate.checklist.map(item => item.text) : undefined,
        };
        console.log('[Store duplicateOS] Dados para nova OS duplicada:', JSON.stringify(duplicatedOSData, null, 2));
        return get().addOS(duplicatedOSData);
      },

      toggleUrgent: async (osId: string) => {
        console.log(`[Store toggleUrgent] Tentando alternar urgência para OS ID: ${osId}`);
        const os = get().osList.find(o => o.id === osId);
        if (os) {
            const newUrgency = !os.isUrgent;
            const updatedOSWithUrgency: OS = { ...os, isUrgent: newUrgency, checklist: os.checklist || [] };
            
            console.log(`[Store toggleUrgent] Tentando chamar updateOSActionDB para OS ID: ${osId} com urgência ${newUrgency}.`);
            const savedOS = await updateOSActionDB(updatedOSWithUrgency);
            
            if (savedOS) {
                console.log(`[Store toggleUrgent] Urgência da OS ID: ${osId} atualizada no DB para ${newUrgency}. OS retornada:`, JSON.stringify(savedOS, null, 2));
                const updatedOSWithDefaults = {
                    ...savedOS,
                    checklist: savedOS.checklist || [],
                };
                set((state) => ({
                  osList: state.osList.map((currentOs) =>
                    currentOs.id === osId ? { ...updatedOSWithDefaults } : currentOs 
                  ).sort((a, b) => {
                    if (a.isUrgent && !b.isUrgent) return -1;
                    if (!a.isUrgent && b.isUrgent) return 1;
                    return new Date(b.dataAbertura).getTime() - new Date(a.dataAbertura).getTime();
                  }),
                }));
                console.log(`[Store toggleUrgent] Urgência alternada e estado local atualizado para OS ID: ${osId}.`);
            } else {
                 console.error(`[Store toggleUrgent] Falha ao atualizar urgência da OS ID ${osId} no DB (updateOSActionDB retornou null).`);
                 throw new Error(`Falha ao atualizar urgência da OS ID ${osId} no DB.`);
            }
        } else {
            console.error(`[Store toggleUrgent] OS ID ${osId} não encontrada.`);
            throw new Error(`OS ID ${osId} não encontrada para alternar urgência.`);
        }
      },
      
      addPartnerEntity: async (partnerData) => {
        console.log('[Store addPartnerEntity] Adicionando entidade parceiro:', partnerData.name);
        try {
            const newPartner = await createPartnerAction(partnerData);
            set(state => ({ partners: [...state.partners, newPartner].sort((a,b) => a.name.localeCompare(b.name)) }));
            console.log('[Store addPartnerEntity] Entidade parceiro adicionada ao store:', newPartner);
            return newPartner;
        } catch (error: any) {
            console.error("[Store addPartnerEntity] Erro ao criar parceiro via action:", error.message);
            throw error; // Re-throw para o modal poder exibir
        }
      },
      updatePartnerEntity: async (updatedPartnerData) => {
        console.log(`[Store updatePartnerEntity] Atualizando entidade parceiro ID: ${updatedPartnerData.id}`);
         try {
            const updatedPartner = await updatePartnerDetailsAction(updatedPartnerData);
            set(state => ({
                partners: state.partners.map(p => p.id === updatedPartner.id ? updatedPartner : p).sort((a,b) => a.name.localeCompare(b.name))
            }));
            console.log('[Store updatePartnerEntity] Entidade parceiro atualizada no store:', updatedPartner);
            return updatedPartner;
        } catch (error: any) {
            console.error("[Store updatePartnerEntity] Erro ao atualizar parceiro via action:", error.message);
            throw error; // Re-throw para o modal poder exibir
        }
      },
      deletePartnerEntity: async (partnerId) => {
        console.log(`[Store deletePartnerEntity] Tentando excluir parceiro ID: ${partnerId}`);
        try {
            const success = await deletePartnerByIdAction(partnerId);
            if (success) {
                set(state => ({
                    partners: state.partners.filter(p => p.id !== partnerId)
                }));
                console.log(`[Store deletePartnerEntity] Parceiro ID: ${partnerId} excluído do store local.`);
                return true;
            }
            console.warn(`[Store deletePartnerEntity] Falha ao excluir parceiro ID: ${partnerId} no DB (ação retornou false).`);
            return false;
        } catch (error: any) {
            console.error(`[Store deletePartnerEntity] Erro ao excluir parceiro ID: ${partnerId} via action:`, error.message);
            throw error; // Re-throw para a UI poder exibir
        }
      }, 
      getPartnerEntityById: (partnerId) => get().partners.find(p => p.id === partnerId),
      getPartnerEntityByName: (partnerName) => get().partners.find(p => p.name.toLowerCase() === partnerName.toLowerCase()),

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
            throw error;
        }
      },
      updateClient: async (updatedClient) => {
        console.warn(`[Store updateClient] ATENÇÃO: Atualização de cliente no DB pendente para ID: ${updatedClient.id}. Nome: ${updatedClient.name}. Implementar Server Action.`);
        // TODO: await updateClientInDB(updatedClient);
        set(state => ({
            clients: state.clients.map(c => c.id === updatedClient.id ? updatedClient : c).sort((a,b) => a.name.localeCompare(b.name))
        }));
        console.log('[Store updateClient] Cliente atualizado localmente (sem persistência no DB).');
      },
      deleteClient: async (clientId) => {
        console.warn(`[Store deleteClient] ATENÇÃO: Deleção de cliente no DB pendente para ID: ${clientId}. Implementar Server Action.`);
        // TODO: await deleteClientInDB(clientId);
        set(state => ({
            clients: state.clients.filter(c => c.id !== clientId)
        }));
        console.log('[Store deleteClient] Cliente deletado localmente (sem persistência no DB).');
      },
      getClientById: (clientId) => get().clients.find(c => c.id === clientId),
      getClientByName: (clientName) => get().clients.find(c => c.name.toLowerCase() === clientName.toLowerCase()),
    })
);
      
