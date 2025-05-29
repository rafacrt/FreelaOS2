
export enum OSStatus {
  NA_FILA = "Na Fila",
  AGUARDANDO_CLIENTE = "Aguardando Cliente",
  EM_PRODUCAO = "Em Produção",
  AGUARDANDO_PARCEIRO = "Aguardando Parceiro",
  FINALIZADO = "Finalizado",
}

export const ALL_OS_STATUSES: OSStatus[] = [
  OSStatus.NA_FILA,
  OSStatus.AGUARDANDO_CLIENTE,
  OSStatus.EM_PRODUCAO,
  OSStatus.AGUARDANDO_PARCEIRO,
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
  parceiro?: string;
  clientId: string;
  partnerId?: string;
  projeto: string;
  tarefa: string;
  observacoes: string;
  tempoTrabalhado?: string; // For manual text notes about time
  status: OSStatus;
  dataAbertura: string; // ISO string
  dataFinalizacao?: string; // ISO string
  programadoPara?: string; // YYYY-MM-DD string
  isUrgent: boolean;
  dataInicioProducao?: string; // ISO string, when the OS entered production for the first time (historical)
  tempoProducaoMinutos?: number; // Deprecated, prefer tempoGastoProducaoSegundos
  tempoGastoProducaoSegundos: number; // Total seconds accumulated in production from chronometer
  dataInicioProducaoAtual: string | null; // ISO string, timestamp of the CURRENT production session start, null if paused/not in production
  checklist?: ChecklistItem[]; // Array of checklist items
}

export interface User {
  id: string;
  username: string;
  isAdmin: boolean;
  isApproved: boolean;
}

export interface CreateOSData {
  cliente: string;
  parceiro?: string;
  projeto: string;
  tarefa: string;
  observacoes: string;
  tempoTrabalhado?: string;
  status: OSStatus;
  programadoPara?: string; // YYYY-MM-DD
  isUrgent: boolean;
  checklistItems?: string[]; // Array of checklist item texts for creation
}

export interface Client {
    id: string;
    name: string;
}

// AuthActionState (mantido para referência, mas o AuthForm está um pouco diferente agora)
export type AuthActionState = {
  message: string | null;
  type?: 'success' | 'error';
  redirect?: string;
};

// Helper function to validate if a date object is valid
export function isValidDate(d: any): d is Date {
  return d instanceof Date && !isNaN(d.getTime());
}
