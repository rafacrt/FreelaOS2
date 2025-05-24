
import { create } from 'zustand';
import type { OS, CreateOSData, Client } from '@/lib/types';
import { OSStatus } from '@/lib/types';
import { parseISO, differenceInMinutes } from 'date-fns';
import { createOSInDB, getAllOSFromDB, updateOSStatusInDB, updateOSInDB as updateOSActionDB } from '@/lib/actions/os-actions';
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
  updateOSStatus: (osId: string, newStatus: OSStatus) => Promise<boolean>; // Returns boolean for success
  getOSById: (osId: string) => OS | undefined;
  duplicateOS: (osId: string) => Promise<OS | null>;
  toggleUrgent: (osId: string) => Promise<void>;

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
            // Set as initialized even on error to prevent repeated attempts, but with empty data.
            set({ osList: [], clients: [], partners: [], isStoreInitialized: true });
        }
      },

      addOS: async (data) => {
        console.log('[Store addOS] Iniciando addOS com dados:', JSON.stringify(data, null, 2));
        try {
          const createdOS = await createOSInDB(data); // Chama a Server Action real
          if (createdOS) {
            console.log('[Store addOS] OS criada no DB:', JSON.stringify(createdOS, null, 2));
            set((state) => ({
              osList: [...state.osList, createdOS].sort((a, b) => {
                if (a.isUrgent && !b.isUrgent) return -1;
                if (!a.isUrgent && b.isUrgent) return 1;
                return new Date(b.dataAbertura).getTime() - new Date(a.dataAbertura).getTime();
              }),
            }));

            // Lógica para adicionar cliente/parceiro ao store local se forem novos
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
        console.log('[Store updateOS] Iniciando updateOS com dados:', JSON.stringify(updatedOSData, null, 2));
        try {
            const savedOS = await updateOSActionDB(updatedOSData); // Chama a Server Action
            if (savedOS) {
                console.log('[Store updateOS] OS atualizada no DB e retornada pela Action:', JSON.stringify(savedOS, null, 2));
                set((state) => ({
                    osList: state.osList.map((os) =>
                        os.id === savedOS.id ? savedOS : os
                    ).sort((a, b) => {
                        if (a.isUrgent && !b.isUrgent) return -1;
                        if (!a.isUrgent && b.isUrgent) return 1;
                        return new Date(b.dataAbertura).getTime() - new Date(a.dataAbertura).getTime();
                    }),
                }));
                 // Atualizar cliente/parceiro no store se mudou
                 if (savedOS.clientId && savedOS.cliente && !get().clients.some(c => c.id === savedOS.clientId)) {
                    set(state => ({ clients: [...state.clients, { id: savedOS.clientId, name: savedOS.cliente }].sort((a,b) => a.name.localeCompare(b.name)) }));
                }
                if (savedOS.partnerId && savedOS.parceiro && !get().partners.some(p => p.id === savedOS.partnerId)) {
                    set(state => ({ partners: [...state.partners, { id: savedOS.partnerId!, name: savedOS.parceiro! }].sort((a,b) => a.name.localeCompare(b.name)) }));
                }
                console.log('[Store updateOS] Estado do store atualizado com OS modificada.');
                return savedOS;
            }
            console.error('[Store updateOS] updateOSActionDB retornou null ou um erro ocorreu.');
            return null;
        } catch (error: any) {
            console.error("[Store updateOS] Erro ao chamar updateOSActionDB:", error.message, error.stack);
            // Considerar se deve lançar o erro ou retornar null/feedback para a UI
            return null; // Ou throw error;
        }
      },

      updateOSStatus: async (osId, newStatus) => {
        console.log(`[Store updateOSStatus] Iniciando para OS ID: ${osId}, Novo Status: ${newStatus}`);
        const os = get().osList.find(o => o.id === osId);
        if (!os) {
          console.error(`[Store updateOSStatus] OS com ID ${osId} não encontrada no store.`);
          return false;
        }

        const now = new Date().toISOString();
        let dataInicioProducao = os.dataInicioProducao;
        let tempoProducaoMinutos: number | null | undefined = os.tempoProducaoMinutos; // Permitir null
        let dataFinalizacao: string | null | undefined = os.dataFinalizacao; // Permitir null

        // Lógica de datas baseada na mudança de status
        if (newStatus === OSStatus.EM_PRODUCAO && os.status !== OSStatus.EM_PRODUCAO && !dataInicioProducao) {
          dataInicioProducao = now;
          console.log(`[Store updateOSStatus] Definindo dataInicioProducao para ${dataInicioProducao}`);
        }

        if (newStatus === OSStatus.FINALIZADO && os.status !== OSStatus.FINALIZADO) {
          dataFinalizacao = now;
          console.log(`[Store updateOSStatus] Definindo dataFinalizacao para ${dataFinalizacao}`);
          const startProduction = dataInicioProducao || (os.status === OSStatus.EM_PRODUCAO && os.dataInicioProducao ? os.dataInicioProducao : null);
          if (startProduction) {
              try {
                  tempoProducaoMinutos = differenceInMinutes(parseISO(now), parseISO(startProduction));
                  console.log(`[Store updateOSStatus] Calculado tempoProducaoMinutos: ${tempoProducaoMinutos}`);
              } catch (e) {
                  console.error("[Store updateOSStatus] Erro ao calcular differenceInMinutes:", e);
                  tempoProducaoMinutos = null;
              }
          } else {
            console.log("[Store updateOSStatus] Não foi possível calcular tempoProducaoMinutos pois dataInicioProducao não está definida.");
            tempoProducaoMinutos = null;
          }
        }

        if (newStatus !== OSStatus.FINALIZADO && os.status === OSStatus.FINALIZADO) {
            dataFinalizacao = null;
            tempoProducaoMinutos = null; // Resetar se reabrir
            console.log("[Store updateOSStatus] OS reaberta, resetando dataFinalizacao e tempoProducaoMinutos.");
        }

        const updatePayloadForDB = { // Dados a serem enviados para o DB
            dataFinalizacao: dataFinalizacao,
            dataInicioProducao: dataInicioProducao,
            tempoProducaoMinutos: tempoProducaoMinutos,
        };
        console.log('[Store updateOSStatus] Payload para updateOSStatusInDB:', JSON.stringify(updatePayloadForDB, null, 2));

        try {
          const success = await updateOSStatusInDB(osId, newStatus, updatePayloadForDB);
          if (success) {
            console.log(`[Store updateOSStatus] Status da OS ${osId} atualizado com sucesso no DB para ${newStatus}.`);
            // Atualiza o estado local com os novos dados, incluindo os potencialmente calculados/alterados
            set((state) => ({
              osList: state.osList.map((currentOs) =>
                currentOs.id === osId ? {
                    ...currentOs,
                    status: newStatus,
                    dataFinalizacao: dataFinalizacao === undefined ? currentOs.dataFinalizacao : dataFinalizacao,
                    dataInicioProducao: dataInicioProducao === undefined ? currentOs.dataInicioProducao : dataInicioProducao,
                    tempoProducaoMinutos: tempoProducaoMinutos === undefined ? currentOs.tempoProducaoMinutos : tempoProducaoMinutos,
                } : currentOs
              ).sort((a, b) => {
                if (a.isUrgent && !b.isUrgent) return -1;
                if (!a.isUrgent && b.isUrgent) return 1;
                return new Date(b.dataAbertura).getTime() - new Date(a.dataAbertura).getTime();
              }),
            }));
            console.log('[Store updateOSStatus] Estado do store atualizado.');
            return true;
          }
          console.error(`[Store updateOSStatus] Falha ao atualizar status da OS ${osId} no DB.`);
          return false;
        } catch (error: any) {
          console.error(`[Store updateOSStatus] Erro ao atualizar status da OS ${osId}:`, error.message, error.stack);
          return false;
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
            tempoTrabalhado: '', // Tempo trabalhado não é copiado
            status: OSStatus.NA_FILA, // Começa como "Na Fila"
            programadoPara: undefined, // Programação não é copiada
            isUrgent: false, // Urgência não é copiada
        };
        console.log('[Store duplicateOS] Dados para nova OS duplicada:', JSON.stringify(duplicatedOSData, null, 2));
        // Chama a função addOS do próprio store, que já lida com a criação no DB e atualização do estado local
        return get().addOS(duplicatedOSData);
      },

      toggleUrgent: async (osId: string) => {
        console.log(`[Store toggleUrgent] Tentando alternar urgência para OS ID: ${osId}`);
        const os = get().osList.find(o => o.id === osId);
        if (os) {
            const newUrgency = !os.isUrgent;
            const updatedOSWithUrgency = { ...os, isUrgent: newUrgency };
            
            // Tenta atualizar no DB primeiro
            const savedOS = await updateOSActionDB(updatedOSWithUrgency);
            
            if (savedOS) {
                console.log(`[Store toggleUrgent] Urgência da OS ID: ${osId} atualizada no DB para ${newUrgency}.`);
                set((state) => ({
                  osList: state.osList.map((currentOs) =>
                    currentOs.id === osId ? savedOS : currentOs // Usa o OS retornado pelo DB
                  ).sort((a, b) => {
                    if (a.isUrgent && !b.isUrgent) return -1;
                    if (!a.isUrgent && b.isUrgent) return 1;
                    return new Date(b.dataAbertura).getTime() - new Date(a.dataAbertura).getTime();
                  }),
                }));
                console.log(`[Store toggleUrgent] Urgência alternada e estado local atualizado para OS ID: ${osId}.`);
            } else {
                 console.error(`[Store toggleUrgent] Falha ao atualizar urgência da OS ID ${osId} no DB.`);
                 // Poderia reverter a mudança local ou notificar o usuário. Por ora, logamos o erro.
            }
        } else {
            console.error(`[Store toggleUrgent] OS ID ${osId} não encontrada.`);
        }
      },

      // --- Partner Actions ---
      getPartnerById: (partnerId) => {
          const partner = get().partners.find(p => p.id === partnerId);
          // console.log(`[Store getPartnerById] Buscando Parceiro ID: ${partnerId}. Encontrado:`, !!partner);
          return partner;
      },
      getPartnerByName: (partnerName) => {
          const partner = get().partners.find(p => p.name.toLowerCase() === partnerName.toLowerCase());
          // console.log(`[Store getPartnerByName] Buscando Parceiro Nome: ${partnerName}. Encontrado:`, !!partner);
          return partner;
      },
      addPartner: async (partnerData) => {
        console.log('[Store addPartner] Adicionando parceiro:', partnerData.name);
        try {
            const newPartner = await findOrCreatePartnerByName(partnerData.name); // Chama a Server Action
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
        // TODO: Implementar Server Action para atualizar parceiro no DB
        console.warn(`[Store updatePartner] Atualização de parceiro no DB pendente para ID: ${updatedPartner.id}. Nome: ${updatedPartner.name}`);
        set(state => ({
            partners: state.partners.map(p => p.id === updatedPartner.id ? updatedPartner : p).sort((a,b) => a.name.localeCompare(b.name))
        }));
        console.log('[Store updatePartner] Parceiro atualizado localmente.');
      },
      deletePartner: async (partnerId) => {
        // TODO: Implementar Server Action para deletar parceiro no DB (e tratar OS vinculadas)
        console.warn(`[Store deletePartner] Deleção de parceiro no DB pendente para ID: ${partnerId}`);
         set(state => ({
            partners: state.partners.filter(p => p.id !== partnerId)
        }));
        console.log('[Store deletePartner] Parceiro deletado localmente.');
      },

      // --- Client Actions ---
      getClientById: (clientId) => {
          const client = get().clients.find(c => c.id === clientId);
          // console.log(`[Store getClientById] Buscando Cliente ID: ${clientId}. Encontrado:`, !!client);
          return client;
        },
      getClientByName: (clientName) => {
          const client = get().clients.find(c => c.name.toLowerCase() === clientName.toLowerCase());
          // console.log(`[Store getClientByName] Buscando Cliente Nome: ${clientName}. Encontrado:`, !!client);
          return client;
      },
      addClient: async (clientData) => {
        console.log('[Store addClient] Adicionando cliente:', clientData.name);
        try {
            const newClient = await findOrCreateClientByName(clientData.name); // Chama a Server Action
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
        // TODO: Implementar Server Action para atualizar cliente no DB
        console.warn(`[Store updateClient] Atualização de cliente no DB pendente para ID: ${updatedClient.id}. Nome: ${updatedClient.name}`);
        set(state => ({
            clients: state.clients.map(c => c.id === updatedClient.id ? updatedClient : c).sort((a,b) => a.name.localeCompare(b.name))
        }));
        console.log('[Store updateClient] Cliente atualizado localmente.');
      },
      deleteClient: async (clientId) => {
        // TODO: Implementar Server Action para deletar cliente no DB (e tratar OS vinculadas)
        console.warn(`[Store deleteClient] Deleção de cliente no DB pendente para ID: ${clientId}`);
        set(state => ({
            clients: state.clients.filter(c => c.id !== clientId)
        }));
        console.log('[Store deleteClient] Cliente deletado localmente.');
      },
    })
);
