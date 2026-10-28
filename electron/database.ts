import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { app } from 'electron';
import type {
  AppLog,
  EditableLeadFields,
  Lead,
  LeadFilter,
  LeadStats,
  LeadStatus,
  LogType,
  NewLead,
  Settings,
} from './types';
import { clampNumber, cleanText, isSameLocalDay, normalizePhone } from './utils';

export type { AppLog, Lead, Settings } from './types';

const LEAD_STATUSES: LeadStatus[] = ['pending', 'processing', 'sent', 'failed', 'replied'];
const MAX_LOGS = 500;
const SAVE_DEBOUNCE_MS = 400;

const DEFAULT_SETTINGS: Settings = {
  id: 1,
  delay_min: 20,
  delay_max: 45,
  message_template:
    '{Olá|Oi} {nome_empresa}! Tudo bem? Vi que vocês atuam com {ramo} em {cidade}. Temos soluções para aumentar suas vendas com tecnologia. Poderíamos conversar?',
  typing_simulation: true,
  daily_limit: 150,
  send_hour_start: 8,
  send_hour_end: 20,
};

interface DatabaseShape {
  leads: Lead[];
  settings: Settings;
  logs: AppLog[];
}

export function isLeadStatus(value: unknown): value is LeadStatus {
  return typeof value === 'string' && (LEAD_STATUSES as string[]).includes(value);
}

/** Garante tipos e limites válidos nas configurações, venham do disco ou da interface */
function sanitizeSettings(input: Partial<Settings>, base: Settings): Settings {
  const merged = { ...base, ...input };
  const template = cleanText(merged.message_template, 4000);
  return {
    id: 1,
    delay_min: clampNumber(merged.delay_min, 5, 3600, base.delay_min),
    delay_max: clampNumber(merged.delay_max, 5, 3600, base.delay_max),
    message_template: template || base.message_template,
    typing_simulation: Boolean(merged.typing_simulation),
    daily_limit: clampNumber(merged.daily_limit, 0, 10000, base.daily_limit),
    send_hour_start: clampNumber(merged.send_hour_start, 0, 23, base.send_hour_start),
    send_hour_end: clampNumber(merged.send_hour_end, 0, 24, base.send_hour_end),
  };
}

class LocalDatabase {
  private readonly dbPath: string;
  private data: DatabaseShape;
  private saveTimer: NodeJS.Timeout | null = null;

  constructor() {
    // Armazena no diretório de dados do usuário (ex: AppData/Roaming/autosale-desktop)
    const dataDir = app ? app.getPath('userData') : path.join(process.cwd(), 'data');
    fs.mkdirSync(dataDir, { recursive: true });
    this.dbPath = path.join(dataDir, 'autosale_database.json');
    this.data = this.loadData();
  }

  get filePath() {
    return this.dbPath;
  }

  private loadData(): DatabaseShape {
    const fresh: DatabaseShape = { leads: [], settings: { ...DEFAULT_SETTINGS }, logs: [] };

    if (!fs.existsSync(this.dbPath)) {
      this.writeNow(fresh);
      return fresh;
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(this.dbPath, 'utf-8'));
      const data: DatabaseShape = {
        leads: Array.isArray(parsed.leads) ? parsed.leads.map((l: Lead) => this.migrateLead(l)) : [],
        settings: sanitizeSettings(parsed.settings || {}, DEFAULT_SETTINGS),
        logs: Array.isArray(parsed.logs) ? parsed.logs : [],
      };
      return data;
    } catch (err) {
      // Nunca sobrescreve um arquivo ilegível: guarda uma cópia para recuperação manual
      const backupPath = this.dbPath.replace(/\.json$/, `.corrompido-${Date.now()}.json`);
      try {
        fs.renameSync(this.dbPath, backupPath);
      } catch {}
      console.error(`Base de dados ilegível; cópia salva em ${backupPath}:`, err);
      fresh.logs.unshift(this.buildLog('error', `Base de dados ilegível. Uma cópia foi salva em: ${backupPath}`));
      this.writeNow(fresh);
      return fresh;
    }
  }

  /** Ajusta registros gravados por versões anteriores (telefone sem 55, campos ausentes) */
  private migrateLead(lead: Lead): Lead {
    return {
      ...lead,
      phone: normalizePhone(lead.phone) ?? String(lead.phone ?? ''),
      status: isLeadStatus(lead.status) ? lead.status : 'pending',
    };
  }

  /** Grava num arquivo temporário e renomeia: um desligamento no meio nunca deixa o JSON pela metade */
  private writeNow(data: DatabaseShape = this.data) {
    const tmpPath = this.dbPath + '.tmp';
    try {
      fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tmpPath, this.dbPath);
    } catch (err) {
      console.error('Erro ao salvar base de dados:', err);
    }
  }

  /** Agrupa várias alterações seguidas numa única gravação em disco */
  private scheduleSave() {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.writeNow();
    }, SAVE_DEBOUNCE_MS);
  }

  /** Grava imediatamente o que estiver pendente (chamado ao encerrar o app) */
  flush() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.writeNow();
  }

  // Métodos de Leads
  getLeads(filter?: LeadFilter): Lead[] {
    let list = [...this.data.leads];
    if (filter?.status && filter.status !== 'all') {
      list = list.filter((l) => l.status === filter.status);
    }
    const q = cleanText(filter?.search).toLowerCase();
    if (q) {
      list = list.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.phone.includes(q) ||
          l.business_type?.toLowerCase().includes(q) ||
          l.city?.toLowerCase().includes(q)
      );
    }
    // Ordena mais recentes primeiro
    return list.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  getLead(id: string): Lead | undefined {
    return this.data.leads.find((l) => l.id === id);
  }

  addLeads(newLeads: NewLead[]): { added: number; duplicates: number; invalid: number } {
    let added = 0;
    let duplicates = 0;
    let invalid = 0;

    const existingPhones = new Set(this.data.leads.map((l) => l.phone));

    for (const item of newLeads) {
      const phone = normalizePhone(item?.phone);
      if (!phone) {
        invalid++;
        continue;
      }
      if (existingPhones.has(phone)) {
        duplicates++;
        continue;
      }

      existingPhones.add(phone);
      this.data.leads.push({
        id: randomUUID(),
        name: cleanText(item.name) || 'Empresa',
        phone,
        business_type: cleanText(item.business_type) || 'Geral',
        city: cleanText(item.city),
        address: cleanText(item.address),
        instagram: cleanText(item.instagram),
        website: cleanText(item.website),
        status: 'pending',
        created_at: new Date().toISOString(),
      });
      added++;
    }

    if (added > 0) this.scheduleSave();
    return { added, duplicates, invalid };
  }

  updateLeadStatus(id: string, status: LeadStatus, errorMessage?: string) {
    const lead = this.getLead(id);
    if (!lead) return undefined;
    lead.status = status;
    if (status === 'sent') {
      lead.sent_at = new Date().toISOString();
      lead.error_message = null;
    } else if (status === 'failed') {
      lead.error_message = errorMessage || 'Falha no envio';
    }
    this.scheduleSave();
    return lead;
  }

  /** Atualiza apenas campos editáveis; devolve null se o lead não existir ou o telefone for inválido/duplicado */
  updateLead(id: string, fields: EditableLeadFields): Lead | null {
    const lead = this.getLead(id);
    if (!lead || !fields || typeof fields !== 'object') return null;

    if (fields.phone !== undefined) {
      const phone = normalizePhone(fields.phone);
      if (!phone) return null;
      if (this.data.leads.some((l) => l.id !== id && l.phone === phone)) return null;
      lead.phone = phone;
    }

    for (const key of ['name', 'business_type', 'city', 'address', 'instagram', 'website'] as const) {
      if (fields[key] !== undefined) lead[key] = cleanText(fields[key]);
    }
    if (!lead.name) lead.name = 'Empresa';

    if (fields.status !== undefined && isLeadStatus(fields.status)) {
      lead.status = fields.status;
      // Se mudar status manualmente para 'sent', registra horário
      if (fields.status === 'sent' && !lead.sent_at) lead.sent_at = new Date().toISOString();
      // Se voltar para pendente, limpa o erro anterior
      if (fields.status === 'pending') lead.error_message = null;
    }

    this.scheduleSave();
    return lead;
  }

  resetFailed(): number {
    let count = 0;
    for (const lead of this.data.leads) {
      if (lead.status === 'failed') {
        lead.status = 'pending';
        lead.error_message = null;
        count++;
      }
    }
    if (count > 0) this.scheduleSave();
    return count;
  }

  deleteLead(id: string) {
    const prevLen = this.data.leads.length;
    this.data.leads = this.data.leads.filter((l) => l.id !== id);
    if (this.data.leads.length === prevLen) return false;
    this.scheduleSave();
    return true;
  }

  clearLeads(statusFilter?: LeadStatus | 'all') {
    this.data.leads = isLeadStatus(statusFilter) ? this.data.leads.filter((l) => l.status !== statusFilter) : [];
    this.scheduleSave();
  }

  /** Devolve para "pendente" os leads que ficaram presos em "processando" */
  resetProcessingLeads() {
    for (const lead of this.data.leads) {
      if (lead.status === 'processing') lead.status = 'pending';
    }
    this.scheduleSave();
  }

  countSentToday(now = new Date()): number {
    return this.data.leads.filter((l) => l.sent_at && isSameLocalDay(new Date(l.sent_at), now)).length;
  }

  // Métodos de Configuração
  getSettings(): Settings {
    return { ...this.data.settings };
  }

  saveSettings(newSettings: Partial<Settings>): Settings {
    this.data.settings = sanitizeSettings(newSettings || {}, this.data.settings);
    this.scheduleSave();
    return this.getSettings();
  }

  // Logs
  private buildLog(type: LogType, message: string): AppLog {
    return { id: randomUUID(), timestamp: new Date().toISOString(), type, message };
  }

  addLog(type: LogType, message: string) {
    const log = this.buildLog(type, message);
    this.data.logs.unshift(log);
    if (this.data.logs.length > MAX_LOGS) this.data.logs.length = MAX_LOGS;
    this.scheduleSave();
    return log;
  }

  getLogs(): AppLog[] {
    return [...this.data.logs];
  }

  clearLogs() {
    this.data.logs = [];
    this.scheduleSave();
  }

  getStats(): LeadStats {
    const stats: LeadStats = { total: 0, pending: 0, sent: 0, failed: 0, replied: 0, sentToday: 0 };
    const now = new Date();
    for (const lead of this.data.leads) {
      stats.total++;
      if (lead.status !== 'processing') stats[lead.status]++;
      if (lead.sent_at && isSameLocalDay(new Date(lead.sent_at), now)) stats.sentToday++;
    }
    return stats;
  }
}

export const db = new LocalDatabase();
