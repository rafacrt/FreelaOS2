
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
  tempoTrabalhado?: string;
  status: OSStatus;
  dataAbertura: string; // ISO string
  dataFinalizacao?: string; // ISO string
  programadoPara?: string; // YYYY-MM-DD string
  isUrgent: boolean;
  dataInicioProducao?: string; // ISO string, quando a OS entrou em produção pela primeira vez (histórico)
  tempoProducaoMinutos?: number; // Tempo total em produção, calculado na finalização. Pode ser depreciado em favor de tempoGastoProducaoSegundos.

  // Novos campos para o cronômetro
  tempoGastoProducaoSegundos: number; // Total de segundos acumulados em produção
  dataInicioProducaoAtual: string | null; // ISO string, timestamp do início da sessão de produção ATUAL, null se pausado/não em produção
}

export interface User {
  id: string;
  username: string;
  isAdmin: boolean;
  isApproved: boolean;
  // Do not include password_hash here for security when passing user object around
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
}

export interface Client {
    id: string;
    name: string;
}

// export interface Partner { // This is defined in os-store.ts, ensure consistency or a single source of truth
//     id: string;
//     name: string;
// }

// State type for authentication server actions
export type AuthActionState = {
  message: string | null;
  type?: 'success' | 'error';
  redirect?: string;
};

// Helper function to validate if a date object is valid
export function isValidDate(d: any): d is Date {
  return d instanceof Date && !isNaN(d.getTime());
}
