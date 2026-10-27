export interface Lead {
  id: string;
  name: string;
  phone: string;
  business_type?: string;
  city?: string;
  address?: string;
  instagram?: string;
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'replied';
  sent_at?: string | null;
  error_message?: string | null;
  created_at: string;
}

export interface Settings {
  id: number;
  delay_min: number;
  delay_max: number;
  message_template: string;
  typing_simulation: boolean;
  daily_limit: number;
}

export interface AppLog {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error';
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
}

export interface IElectronAPI {
  whatsapp: {
    getStatus: () => Promise<{ status: string; qrCode: string | null }>;
    connect: () => Promise<{ status: string; qrCode: string | null }>;
    disconnect: () => Promise<{ success: boolean }>;
    onStatusChange: (callback: (data: { status: string; qrCode: string | null }) => void) => () => void;
  };
  leads: {
    getLeads: (filter?: { status?: string; search?: string }) => Promise<Lead[]>;
    addLeads: (leads: any[]) => Promise<{ added: number; duplicates: number }>;
    deleteLead: (id: string) => Promise<boolean>;
    updateLead: (id: string, fields: Partial<Lead>) => Promise<Lead | null>;
    clearLeads: (statusFilter?: string) => Promise<{ success: boolean }>;
    getStats: () => Promise<{ total: number; pending: number; sent: number; failed: number; replied: number }>;
    exportExcel: () => Promise<{ success: boolean; count?: number; path?: string; error?: string; canceled?: boolean }>;
    importFile: () => Promise<{ success: boolean; added?: number; duplicates?: number; error?: string; canceled?: boolean }>;
  };

  settings: {
    getSettings: () => Promise<Settings>;
    saveSettings: (settings: Partial<Settings>) => Promise<Settings>;
  };
  scraper: {
    searchLeads: (filters: { niche: string; city: string; state: string; limit?: number }) => Promise<any[]>;
    onProgress: (callback: (data: { found: number; currentName: string }) => void) => () => void;
  };
  campaign: {
    start: () => Promise<{ success: boolean; message: string }>;
    pause: () => Promise<{ success: boolean }>;
    resume: () => Promise<{ success: boolean }>;
    stop: () => Promise<{ success: boolean }>;
    getStatus: () => Promise<DispatchProgress>;
    onProgress: (callback: (progress: DispatchProgress) => void) => () => void;
  };
  logs: {
    getLogs: () => Promise<AppLog[]>;
    clearLogs: () => Promise<{ success: boolean }>;
  };
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
