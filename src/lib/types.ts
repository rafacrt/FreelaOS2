
export enum OSStatus {
  NA_FILA = "Na Fila",
  AGUARDANDO_CLIENTE = "Aguardando Cliente",
  EM_PRODUCAO = "Em Produção",
  AGUARDANDO_PARCEIRO = "Aguardando Parceiro",
  AGUARDANDO_APROVACAO = "Aguardando Aprovação", // Novo status
  RECUSADA = "Recusada",                         // Novo status
  FINALIZADO = "Finalizado",
}

export const ALL_OS_STATUSES: OSStatus[] = [
  OSStatus.NA_FILA,
  OSStatus.AGUARDANDO_CLIENTE,
  OSStatus.EM_PRODUCAO,
  OSStatus.AGUARDANDO_PARCEIRO,
  OSStatus.AGUARDANDO_APROVACAO,
  OSStatus.RECUSADA,
  OSStatus.FINALIZADO,
];

export interface ChecklistItem {
  id: string; // Unique ID for React key prop
  text: string;
  completed: boolean;
}

export interface OS {
  id: string;
  numero: string;
  cliente: string;
  parceiro?: string; // Parceiro responsável pela execução
  clientId: string;
  partnerId?: string; // ID do parceiro responsável pela execução
  projeto: string;
  tarefa: string;
  observacoes: string;
  status: OSStatus;
  dataAbertura: string; // ISO string
  dataFinalizacao?: string; // ISO string
  programadoPara?: string; // YYYY-MM-DD string
  isUrgent: boolean;
  dataInicioProducao?: string; // ISO string, when the OS entered production for the first time (historical)
  tempoGastoProducaoSegundos: number; // Total seconds accumulated in production from chronometer
  dataInicioProducaoAtual: string | null; // ISO string, timestamp of the CURRENT production session start, null if paused/not in production
  checklist?: ChecklistItem[]; // Array of checklist items
  createdByPartnerId?: string; // ID of the partner who created this OS
  createdByPartnerName?: string; // Name of the partner who created this OS (for display)
}

// User (Admin/Internal) Session Data
export interface User {
  id: string;
  username: string;
  isAdmin: boolean;
  isApproved: boolean; // Should always be true for logged-in internal users based on middleware
}

// Partner Session Data (for logged-in partners)
export interface PartnerSessionData {
  id: string; // This is the partner's ID from the 'partners' table
  username: string; // Partner's login username
  partnerName: string; // Actual name of the partner company/individual
  email?: string; // Partner's email
  isApproved: boolean; // Partner login account approval status
  // Add any other partner-specific session data you might need
}

export type SessionPayload =
  | ({ sessionType: 'admin' } & User)
  | ({ sessionType: 'partner' } & PartnerSessionData);


export interface CreateOSData {
  cliente: string;
  parceiro?: string; // Parceiro de execução
  projeto: string;
  tarefa: string;
  observacoes: string;
  status: OSStatus; // Pode ser pré-definido, como AGUARDANDO_APROVACAO
  programadoPara?: string; // YYYY-MM-DD
  isUrgent: boolean;
  checklistItems?: string[]; // Array of checklist item texts for creation
  // createdByPartnerId will be set by the server action if a partner is creating it
}

export interface Client {
    id: string;
    name: string;
    sourcePartnerId?: string | null; // ID do parceiro que originou este cliente
    sourcePartnerName?: string | null; // Nome do parceiro de origem (para exibição)
}

export type AuthActionState = {
  message: string | null;
  type?: 'success' | 'error';
  redirect?: string;
};

export function isValidDate(d: any): d is Date {
  return d instanceof Date && !isNaN(d.getTime());
}

// Notification System Types
export type NotificationRecipientType = 'admin' | 'partner';
export type NotificationType = 'os_created_by_partner' | 'os_approved' | 'os_refused' | 'os_status_changed' | 'generic';

export interface AppNotification {
  id: string;
  recipientType: NotificationRecipientType;
  recipientId: string; // Specific partner ID, or a generic ID like 'all_admins'
  message: string;
  link?: string; // Optional link, e.g., to an OS: /os/[id]
  type: NotificationType;
  createdAt: string; // ISO string
  isRead: boolean;
}
