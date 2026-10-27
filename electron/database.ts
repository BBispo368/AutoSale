import fs from 'fs';
import path from 'path';
import { app } from 'electron';

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

class LocalDatabase {
  private dataDir: string;
  private dbPath: string;
  private data: {
    leads: Lead[];
    settings: Settings;
    logs: AppLog[];
  };

  constructor() {
    // Armazena no diretório de dados do usuário (ex: AppData/AutoSale)
    const baseDir = app ? app.getPath('userData') : path.join(process.cwd(), 'data');
    this.dataDir = baseDir;
    this.dbPath = path.join(this.dataDir, 'autosale_database.json');

    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    this.data = this.loadData();
  }

  private loadData() {
    const defaultData = {
      leads: [] as Lead[],
      settings: {
        id: 1,
        delay_min: 20,
        delay_max: 45,
        message_template: 'Olá {nome_empresa}! Tudo bem? Vi que vocês atuam com {ramo} em {cidade}. Temos soluções para aumentar suas vendas com tecnologia. Poderíamos conversar?',
        typing_simulation: true,
        daily_limit: 150,
      },
      logs: [] as AppLog[],
    };

    if (fs.existsSync(this.dbPath)) {
      try {
        const content = fs.readFileSync(this.dbPath, 'utf-8');
        const parsed = JSON.parse(content);
        return {
          leads: Array.isArray(parsed.leads) ? parsed.leads : [],
          settings: { ...defaultData.settings, ...(parsed.settings || {}) },
          logs: Array.isArray(parsed.logs) ? parsed.logs : [],
        };
      } catch (err) {
        console.error('Erro ao ler base de dados local, iniciando nova:', err);
      }
    }

    this.saveData(defaultData);
    return defaultData;
  }

  private saveData(data = this.data) {
    try {
      fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Erro ao salvar base de dados:', err);
    }
  }

  // Métodos de Leads
  getLeads(filter?: { status?: string; search?: string }): Lead[] {
    let list = [...this.data.leads];
    if (filter?.status && filter.status !== 'all') {
      list = list.filter((l) => l.status === filter.status);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.phone.includes(q) ||
          (l.business_type && l.business_type.toLowerCase().includes(q)) ||
          (l.city && l.city.toLowerCase().includes(q))
      );
    }
    // Ordena mais recentes primeiro
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  addLeads(newLeads: Array<Omit<Lead, 'id' | 'created_at' | 'status'>>): { added: number; duplicates: number } {
    let added = 0;
    let duplicates = 0;

    const existingPhones = new Set(this.data.leads.map((l) => l.phone.replace(/\D/g, '')));

    for (const item of newLeads) {
      const cleanPhone = (item.phone || '').replace(/\D/g, '');
      if (!cleanPhone || cleanPhone.length < 10) continue;

      if (existingPhones.has(cleanPhone)) {
        duplicates++;
        continue;
      }

      existingPhones.add(cleanPhone);
      const lead: Lead = {
        id: 'lead_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        name: item.name || 'Empresa',
        phone: cleanPhone,
        business_type: item.business_type || 'Geral',
        city: item.city || '',
        address: item.address || '',
        instagram: item.instagram || '',
        status: 'pending',
        created_at: new Date().toISOString(),
      };

      this.data.leads.push(lead);
      added++;
    }

    if (added > 0) {
      this.saveData();
    }

    return { added, duplicates };
  }

  updateLeadStatus(id: string, status: Lead['status'], errorMessage?: string) {
    const lead = this.data.leads.find((l) => l.id === id);
    if (lead) {
      lead.status = status;
      if (status === 'sent') {
        lead.sent_at = new Date().toISOString();
        lead.error_message = null;
      } else if (status === 'failed') {
        lead.error_message = errorMessage || 'Falha no envio';
      }
      this.saveData();
    }
    return lead;
  }

  updateLead(id: string, fields: Partial<Pick<Lead, 'name' | 'phone' | 'business_type' | 'city' | 'address' | 'instagram' | 'status' | 'error_message'>>) {
    const lead = this.data.leads.find((l) => l.id === id);
    if (!lead) return null;
    Object.assign(lead, fields);
    // Se mudar status manualmente para 'sent', registra horário
    if (fields.status === 'sent' && !lead.sent_at) {
      lead.sent_at = new Date().toISOString();
    }
    // Se mudar para pending, limpa erro
    if (fields.status === 'pending') {
      lead.error_message = null;
    }
    this.saveData();
    return lead;
  }

  deleteLead(id: string) {
    const prevLen = this.data.leads.length;
    this.data.leads = this.data.leads.filter((l) => l.id !== id);
    if (this.data.leads.length !== prevLen) {
      this.saveData();
      return true;
    }
    return false;
  }

  clearLeads(statusFilter?: string) {
    if (statusFilter && statusFilter !== 'all') {
      this.data.leads = this.data.leads.filter((l) => l.status !== statusFilter);
    } else {
      this.data.leads = [];
    }
    this.saveData();
  }

  resetLeadsStatus() {
    this.data.leads.forEach((l) => {
      if (l.status === 'processing') {
        l.status = 'pending';
      }
    });
    this.saveData();
  }

  // Métodos de Configuração
  getSettings(): Settings {
    return { ...this.data.settings };
  }

  saveSettings(newSettings: Partial<Settings>): Settings {
    this.data.settings = {
      ...this.data.settings,
      ...newSettings,
    };
    this.saveData();
    return this.data.settings;
  }

  // Logs
  addLog(type: AppLog['type'], message: string) {
    const log: AppLog = {
      id: 'log_' + Date.now(),
      timestamp: new Date().toLocaleTimeString('pt-BR'),
      type,
      message,
    };
    this.data.logs.unshift(log);
    // Mantém no máximo 200 logs
    if (this.data.logs.length > 200) {
      this.data.logs = this.data.logs.slice(0, 200);
    }
    this.saveData();
    return log;
  }

  getLogs(): AppLog[] {
    return this.data.logs;
  }

  clearLogs() {
    this.data.logs = [];
    this.saveData();
  }

  getStats() {
    const total = this.data.leads.length;
    const pending = this.data.leads.filter((l) => l.status === 'pending').length;
    const sent = this.data.leads.filter((l) => l.status === 'sent').length;
    const failed = this.data.leads.filter((l) => l.status === 'failed').length;
    const replied = this.data.leads.filter((l) => l.status === 'replied').length;
    return { total, pending, sent, failed, replied };
  }
}

export const db = new LocalDatabase();
