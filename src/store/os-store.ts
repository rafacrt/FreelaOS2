
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
import { 
    findOrCreateClientByName, 
    getAllClientsFromDB,
    updateClientInDB,
    deleteClientFromDB
} from '@/lib/actions/client-actions';
import { 
    getAllPartnersFromDB, 
    createPartner as createPartnerAction, 
    updatePartnerDetails as updatePartnerDetailsAction, 
    deletePartnerById as deletePartnerByIdAction,
    type CreatePartnerData,
    type UpdatePartnerDetailsData
} from '@/lib/actions/partner-actions';
import { notify } from './notification-store'; // Import notification helper


export interface Partner {
    id: string;
    name: string;
    username?: string;
    email?: string; // Added email field
    contact_person?: string;
    is_approved?: boolean;
}

interface OSState {
  osList: OS[];
  partners: Partner[];
  clients: Client[];
  isStoreInitialized: boolean;

  initializeStore: () => Promise<void>;

  addOS: (data: CreateOSData, creator: { name: string; type: 'admin' | 'partner'; id?: string }) => Promise<OS | null>;
  updateOS: (updatedOS: OS) => Promise<OS | null>;
  updateOSStatus: (osId: string, newStatus: OSStatus, adminApproverName?: string) => Promise<OS | null>; 
  getOSById: (osId: string) => OS | undefined;
  duplicateOS: (osId: string, adminUsername: string) => Promise<OS | null>;
  toggleUrgent: (osId: string) => Promise<void>;
  toggleProductionTimer: (osId: string, action: 'play' | 'pause') => Promise<OS | null>;

  addPartnerEntity: (partnerData: CreatePartnerData) => Promise<Partner | null>; 
  updatePartnerEntity: (updatedPartnerData: UpdatePartnerDetailsData) => Promise<Partner | null>; 
  deletePartnerEntity: (partnerId: string) => Promise<boolean>; 
  getPartnerEntityById: (partnerId: string) => Partner | undefined;
  getPartnerEntityByName: (partnerName: string) => Partner | undefined;

  addClient: (clientData: { name: string; sourcePartnerId?: string | null }) => Promise<Client | null>;
  updateClient: (updatedClient: Client) => Promise<Client | null>; 
  deleteClient: (clientId: string) => Promise<boolean>; 
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
            return;
        }
        try {
            const [osListFromDB, clientsFromDB, partnersFromDB] = await Promise.all([
                getAllOSFromDB(),
                getAllClientsFromDB(), 
                getAllPartnersFromDB()
            ]);
            
            const processedOSList = osListFromDB.map(os => ({
                ...os,
                checklist: os.checklist || [], 
                creatorName: os.creatorName || undefined,
            }));

            set({
              osList: processedOSList || [], 
              clients: clientsFromDB || [], 
              partners: partnersFromDB || [],
              isStoreInitialized: true,
            });
        } catch (error) {
            set({ osList: [], clients: [], partners: [], isStoreInitialized: true }); 
        }
      },

      addOS: async (data, creator) => {
        try {
          const createdOS = await createOSInDB(data, creator); 
          if (createdOS) {
            const newOSWithDefaults = {
                ...createdOS,
                checklist: createdOS.checklist || [], 
            };
            set((state) => ({
              osList: [...state.osList, newOSWithDefaults].sort((a, b) => { 
                if (a.isUrgent && !b.isUrgent) return -1;
                if (!a.isUrgent && b.isUrgent) return 1;
                 if (a.status === OSStatus.AGUARDANDO_APROVACAO && b.status !== OSStatus.AGUARDANDO_APROVACAO) return -1;
                 if (a.status !== OSStatus.AGUARDANDO_APROVACAO && b.status === OSStatus.AGUARDANDO_APROVACAO) return 1;
                return new Date(b.dataAbertura).getTime() - new Date(a.dataAbertura).getTime();
              }),
            }));

            if (creator.type === 'partner' && newOSWithDefaults.status === OSStatus.AGUARDANDO_APROVACAO) {
                notify.admin(
                    `Nova OS #${newOSWithDefaults.numero} (${newOSWithDefaults.projeto}) criada por ${creator.name} e aguarda sua aprovação.`,
                    'os_created_by_partner',
                    `/os/${newOSWithDefaults.id}`
                );
            }

            const clientFromDB = await get().getClientById(newOSWithDefaults.clientId); 
            if (clientFromDB) {
                const clientInOS = { 
                    id: newOSWithDefaults.clientId, 
                    name: newOSWithDefaults.cliente,
                    sourcePartnerId: clientFromDB.sourcePartnerId, 
                    sourcePartnerName: clientFromDB.sourcePartnerName
                };
                if (!get().clients.some(c => c.id === clientInOS.id && c.name === clientInOS.name && c.sourcePartnerId === clientInOS.sourcePartnerId)) {
                     set(state => ({ clients: [...state.clients.filter(c => c.id !== clientInOS.id), clientInOS].sort((a,b) => a.name.localeCompare(b.name)) }));
                }
            }

            if (newOSWithDefaults.partnerId && newOSWithDefaults.parceiro) {
              const execPartnerExists = get().partners.some(p => p.id === newOSWithDefaults.partnerId);
              if (!execPartnerExists) {
                const newPartnerEntry: Partner = { 
                    id: newOSWithDefaults.partnerId, 
                    name: newOSWithDefaults.parceiro, 
                    username: get().partners.find(p => p.id === newOSWithDefaults.partnerId)?.username || `parceiro_${newOSWithDefaults.partnerId}`, 
                    is_approved: get().partners.find(p => p.id === newOSWithDefaults.partnerId)?.is_approved || false 
                };
                set(state => ({ partners: [...state.partners, newPartnerEntry].sort((a,b) => a.name.localeCompare(b.name)) }));
              }
            }
            return newOSWithDefaults;
          }
          return null;
        } catch (error: any) {
            throw error;
        }
      },

      updateOS: async (updatedOSData) => {
        try {
            const savedOS = await updateOSActionDB(updatedOSData); 
            if (savedOS) {
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
                        if (a.status === OSStatus.AGUARDANDO_APROVACAO && b.status !== OSStatus.AGUARDANDO_APROVACAO) return -1;
                        if (a.status !== OSStatus.AGUARDANDO_APROVACAO && b.status === OSStatus.AGUARDANDO_APROVACAO) return 1;
                        return new Date(b.dataAbertura).getTime() - new Date(a.dataAbertura).getTime();
                    }),
                }));
                const clientFromDB = await get().getClientById(updatedOSWithDefaults.clientId);
                 if (clientFromDB) {
                    const clientInOS = { 
                        id: updatedOSWithDefaults.clientId, 
                        name: updatedOSWithDefaults.cliente,
                        sourcePartnerId: clientFromDB.sourcePartnerId,
                        sourcePartnerName: clientFromDB.sourcePartnerName
                    };
                    if (!get().clients.some(c => c.id === clientInOS.id && c.name === clientInOS.name && c.sourcePartnerId === clientInOS.sourcePartnerId)) {
                        set(state => ({ clients: [...state.clients.filter(c => c.id !== clientInOS.id), clientInOS].sort((a,b) => a.name.localeCompare(b.name)) }));
                    }
                }

                if (updatedOSWithDefaults.partnerId && updatedOSWithDefaults.parceiro) {
                    const partnerInStore = get().partners.find(p => p.id === updatedOSWithDefaults.partnerId);
                    if (!partnerInStore || partnerInStore.name !== updatedOSWithDefaults.parceiro) {
                        const partnerEntry: Partner = { 
                            id: updatedOSWithDefaults.partnerId, 
                            name: updatedOSWithDefaults.parceiro,
                            username: partnerInStore?.username || `parceiro_${updatedOSWithDefaults.partnerId}`,
                            is_approved: partnerInStore?.is_approved || false,
                            email: partnerInStore?.email // Include email if found
                        };
                        set(state => ({ partners: [...state.partners.filter(p => p.id !== updatedOSWithDefaults.partnerId), partnerEntry].sort((a,b) => a.name.localeCompare(b.name)) }));
                    }
                }
                return updatedOSWithDefaults;
            }
            return null;
        } catch (error: any) {
            throw error;
        }
      },

      updateOSStatus: async (osId, newStatus, adminApproverName?: string) => {
        const originalOS = get().getOSById(osId);
        try {
          // The Server Action `updateOSStatusInDB` will now handle the email sending
          const updatedOS = await updateOSStatusInDB(osId, newStatus, adminApproverName);
          
          if (updatedOS) {
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
                if (a.status === OSStatus.AGUARDANDO_APROVACAO && b.status !== OSStatus.AGUARDANDO_APROVACAO) return -1;
                if (a.status !== OSStatus.AGUARDANDO_APROVACAO && b.status === OSStatus.AGUARDANDO_APROVACAO) return 1;
                return new Date(b.dataAbertura).getTime() - new Date(a.dataAbertura).getTime();
              }),
            }));

            // Client-side notification logic remains here. It triggers after the server is done.
            if (originalOS && originalOS.createdByPartnerId && originalOS.status === OSStatus.AGUARDANDO_APROVACAO) {
                const notificationMessage = `Sua OS #${originalOS.numero} (${originalOS.projeto}) foi ${newStatus === OSStatus.NA_FILA ? 'APROVADA' : 'RECUSADA'} por ${adminApproverName || 'um admin'}.`;
                const notificationType = newStatus === OSStatus.NA_FILA ? 'os_approved' : 'os_refused';
                
                notify.partner(
                    originalOS.createdByPartnerId,
                    notificationMessage,
                    notificationType,
                    `/os/${originalOS.id}`
                );
            } else if (originalOS && originalOS.createdByPartnerId && newStatus !== originalOS.status) { // General status change by admin
                 notify.partner(
                    originalOS.createdByPartnerId,
                    `O status da OS #${originalOS.numero} (${originalOS.projeto}) foi alterado para ${newStatus} por ${adminApproverName || 'um admin'}.`,
                    'os_status_changed',
                    `/os/${originalOS.id}`
                 );
            }
            return updatedOSWithDefaults;
          }
          return null;
        } catch (error: any) {
          throw error;
        }
      },
      
      toggleProductionTimer: async (osId: string, action: 'play' | 'pause') => {
        try {
            const updatedOS = await toggleOSProductionTimerInDB(osId, action);
            if (updatedOS) {
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
                        if (a.status === OSStatus.AGUARDANDO_APROVACAO && b.status !== OSStatus.AGUARDANDO_APROVACAO) return -1;
                        if (a.status !== OSStatus.AGUARDANDO_APROVACAO && b.status === OSStatus.AGUARDANDO_APROVACAO) return 1;
                        return new Date(b.dataAbertura).getTime() - new Date(a.dataAbertura).getTime();
                    }),
                }));
                return updatedOSWithDefaults;
            }
            return null;
        } catch (error: any) {
            throw error;
        }
      },

      getOSById: (osId) => {
        const os = get().osList.find((os) => os.id === osId);
        return os;
      },

      duplicateOS: async (osId: string, adminUsername: string) => {
        const osToDuplicate = get().osList.find(os => os.id === osId);
        if (!osToDuplicate) {
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
        const creator = { name: adminUsername, type: 'admin' as const };
        return get().addOS(duplicatedOSData, creator);
      },

      toggleUrgent: async (osId: string) => {
        const os = get().osList.find(o => o.id === osId);
        if (os) {
            const newUrgency = !os.isUrgent;
            const updatedOSWithUrgency: OS = { ...os, isUrgent: newUrgency, checklist: os.checklist || [] };
            
            const savedOS = await updateOSActionDB(updatedOSWithUrgency);
            
            if (savedOS) {
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
                    if (a.status === OSStatus.AGUARDANDO_APROVACAO && b.status !== OSStatus.AGUARDANDO_APROVACAO) return -1;
                    if (a.status !== OSStatus.AGUARDANDO_APROVACAO && b.status === OSStatus.AGUARDANDO_APROVACAO) return 1;
                    return new Date(b.dataAbertura).getTime() - new Date(a.dataAbertura).getTime();
                  }),
                }));
            } else {
                 throw new Error(`Falha ao atualizar urgência da OS ID ${osId} no DB.`);
            }
        } else {
            throw new Error(`OS ID ${osId} não encontrada para alternar urgência.`);
        }
      },
      
      addPartnerEntity: async (partnerData) => {
        try {
            const newPartner = await createPartnerAction(partnerData);
            set(state => ({ partners: [...state.partners, newPartner].sort((a,b) => a.name.localeCompare(b.name)) }));
            return newPartner;
        } catch (error: any) {
            throw error;
        }
      },
      updatePartnerEntity: async (updatedPartnerData) => {
         try {
            const updatedPartner = await updatePartnerDetailsAction(updatedPartnerData);
            set(state => ({
                partners: state.partners.map(p => p.id === updatedPartner.id ? { ...p, ...updatedPartner } : p).sort((a,b) => a.name.localeCompare(b.name))
            }));
            return updatedPartner;
        } catch (error: any) {
            throw error;
        }
      },
      deletePartnerEntity: async (partnerId) => {
        try {
            const success = await deletePartnerByIdAction(partnerId);
            if (success) {
                set(state => ({
                    partners: state.partners.filter(p => p.id !== partnerId),
                    clients: state.clients.map(c => c.sourcePartnerId === partnerId ? {...c, sourcePartnerId: null, sourcePartnerName: null} : c)
                }));
                return true;
            }
            return false;
        } catch (error: any) {
            throw error;
        }
      }, 
      getPartnerEntityById: (partnerId) => get().partners.find(p => p.id === partnerId),
      getPartnerEntityByName: (partnerName) => get().partners.find(p => p.name.toLowerCase() === partnerName.toLowerCase()),

      addClient: async (clientData) => {
        const { name, sourcePartnerId } = clientData;
        try {
            const newOrExistingClient = await findOrCreateClientByName(name, sourcePartnerId); 
            if (newOrExistingClient) {
                const existingInStore = get().clients.find(c => c.id === newOrExistingClient.id);
                if (!existingInStore || existingInStore.name !== newOrExistingClient.name || existingInStore.sourcePartnerId !== newOrExistingClient.sourcePartnerId) { 
                    set(state => ({ clients: [...state.clients.filter(c => c.id !== newOrExistingClient.id), newOrExistingClient].sort((a,b) => a.name.localeCompare(b.name)) }));
                }
                return newOrExistingClient;
            }
            return null;
        } catch (error: any) {
            throw error;
        }
      },
      updateClient: async (updatedClientData) => {
        try {
            const updatedClientFromDB = await updateClientInDB(updatedClientData);
            if (updatedClientFromDB) {
                set(state => ({
                    clients: state.clients.map(c => c.id === updatedClientFromDB.id ? updatedClientFromDB : c).sort((a,b) => a.name.localeCompare(b.name))
                }));
                set(state => ({
                    osList: state.osList.map(os => 
                        os.clientId === updatedClientFromDB.id ? { ...os, cliente: updatedClientFromDB.name } : os
                    )
                }));
                return updatedClientFromDB;
            }
            return null;
        } catch (error: any) {
            throw error;
        }
      },
      deleteClient: async (clientId) => {
        try {
            const success = await deleteClientFromDB(clientId);
            if (success) {
                set(state => ({
                    clients: state.clients.filter(c => c.id !== clientId)
                }));
                return true;
            }
            return false;
        } catch (error: any) {
            throw error;
        }
      },
      getClientById: (clientId) => get().clients.find(c => c.id === clientId),
      getClientByName: (clientName) => get().clients.find(c => c.name.toLowerCase() === clientName.toLowerCase()),
    })
);
