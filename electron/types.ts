// Tipos compartilhados entre o processo principal (electron/) e a interface (src/).
// Este arquivo não pode importar nada do Electron nem do Node: o renderer o usa via `import type`.

export type LeadStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'replied';

export interface Lead {
  id: string;
  name: string;
  phone: string; // Sempre normalizado: 55 + DDD + número
  business_type?: string;
  city?: string;
  address?: string;
  instagram?: string;
  website?: string;
  status: LeadStatus;
  sent_at?: string | null;
  error_message?: string | null;
  created_at: string;
}

export type NewLead = Pick<Lead, 'name' | 'phone'> &
  Partial<Pick<Lead, 'business_type' | 'city' | 'address' | 'instagram' | 'website'>>;

export type EditableLeadFields = Partial<
  Pick<Lead, 'name' | 'phone' | 'business_type' | 'city' | 'address' | 'instagram' | 'website' | 'status'>
>;

export interface LeadFilter {
  status?: LeadStatus | 'all';
  search?: string;
}

export interface LeadStats {
  total: number;
  pending: number;
  sent: number;
  failed: number;
  replied: number;
  sentToday: number;
}

export interface Settings {
  id: number;
  delay_min: number; // segundos
  delay_max: number; // segundos
  /** Aceita tags ({nome_empresa}, {ramo}, {cidade}, {telefone}) e spintax: {Olá|Oi|Bom dia} */
  message_template: string;
  typing_simulation: boolean;
  /** Máximo de mensagens enviadas por dia (0 = sem limite) */
  daily_limit: number;
  /** Janela de envio permitida, em horas locais. start === end desativa a restrição. */
  send_hour_start: number; // 0-23
  send_hour_end: number; // 1-24
}

export type LogType = 'info' | 'success' | 'warning' | 'error';

export interface AppLog {
  id: string;
  timestamp: string; // ISO 8601 completo (data + hora)
  type: LogType;
  message: string;
}

export interface DispatchProgress {
  isRunning: boolean;
  isPaused: boolean;
  total: number;
  processed: number;
  successCount: number;
  failCount: number;
  currentLead: Lead | null;
  nextDelaySec: number;
  /** Ex.: "Aguardando janela de envio (08h–18h)" ou "Limite diário atingido" */
  waitingReason: string | null;
}

export type WhatsAppStatus = 'disconnected' | 'connecting' | 'connected' | 'qr';

export interface ScrapedLead {
  name: string;
  phone: string;
  business_type: string;
  city: string;
  address?: string;
  website?: string;
}

export interface SearchFilters {
  niche: string;
  city: string;
  state: string;
  limit?: number;
}

export interface SearchResult {
  success: boolean;
  results: ScrapedLead[];
  canceled?: boolean;
  error?: string;
}

export interface ActionResult {
  success: boolean;
  message?: string;
  error?: string;
}

export interface IElectronAPI {
  app: {
    getInfo: () => Promise<{ version: string; dataPath: string }>;
  };
  whatsapp: {
    getStatus: () => Promise<{ status: WhatsAppStatus; qrCode: string | null }>;
    connect: () => Promise<{ status: WhatsAppStatus; qrCode: string | null }>;
    disconnect: () => Promise<{ success: boolean }>;
    onStatusChange: (callback: (data: { status: WhatsAppStatus; qrCode: string | null }) => void) => () => void;
  };
  leads: {
    getLeads: (filter?: LeadFilter) => Promise<Lead[]>;
    addLeads: (leads: NewLead[]) => Promise<{ added: number; duplicates: number; invalid: number }>;
    deleteLead: (id: string) => Promise<boolean>;
    updateLead: (id: string, fields: EditableLeadFields) => Promise<Lead | null>;
    /** Volta todos os leads com falha para "pendente" numa única operação */
    resetFailed: () => Promise<{ count: number }>;
    clearLeads: (statusFilter?: LeadStatus | 'all') => Promise<{ success: boolean }>;
    getStats: () => Promise<LeadStats>;
    exportExcel: () => Promise<{ success: boolean; count?: number; path?: string; error?: string; canceled?: boolean }>;
    importFile: () => Promise<{
      success: boolean;
      added?: number;
      duplicates?: number;
      invalid?: number;
      error?: string;
      canceled?: boolean;
    }>;
  };
  settings: {
    getSettings: () => Promise<Settings>;
    saveSettings: (settings: Partial<Settings>) => Promise<Settings>;
  };
  scraper: {
    searchLeads: (filters: SearchFilters) => Promise<SearchResult>;
    cancel: () => Promise<{ success: boolean }>;
    onProgress: (callback: (data: { found: number; currentName: string }) => void) => () => void;
  };
  campaign: {
    start: () => Promise<ActionResult>;
    pause: () => Promise<{ success: boolean }>;
    resume: () => Promise<{ success: boolean }>;
    stop: () => Promise<{ success: boolean }>;
    /** Devolve o progresso real da campanha em andamento (ou o último estado) */
    getStatus: () => Promise<DispatchProgress>;
    onProgress: (callback: (progress: DispatchProgress) => void) => () => void;
  };
  logs: {
    getLogs: () => Promise<AppLog[]>;
    clearLogs: () => Promise<{ success: boolean }>;
  };
}
