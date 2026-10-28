import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { db, isLeadStatus } from './database';
import { campaignDispatcher } from './dispatcher';
import { exportLeadsToFile, readLeadsFromFile } from './excel';
import { leadScraper } from './scraper';
import type { EditableLeadFields, LeadFilter, NewLead, SearchFilters, Settings } from './types';
import { clampNumber, cleanText } from './utils';
import { whatsappManager } from './whatsapp';

// O renderer é tratado como não confiável: todo argumento recebido é validado aqui

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function parseLeadFilter(input: unknown): LeadFilter | undefined {
  if (!isObject(input)) return undefined;
  return {
    status: isLeadStatus(input.status) ? input.status : 'all',
    search: cleanText(input.search, 100),
  };
}

function parseNewLeads(input: unknown): NewLead[] {
  if (!Array.isArray(input)) return [];
  return input.filter(isObject).map((l) => ({
    name: cleanText(l.name),
    phone: cleanText(l.phone, 40),
    business_type: cleanText(l.business_type),
    city: cleanText(l.city),
    address: cleanText(l.address),
    instagram: cleanText(l.instagram),
    website: cleanText(l.website),
  }));
}

function parseLeadFields(input: unknown): EditableLeadFields {
  if (!isObject(input)) return {};
  const fields: EditableLeadFields = {};
  for (const key of ['name', 'phone', 'business_type', 'city', 'address', 'instagram', 'website'] as const) {
    if (input[key] !== undefined) fields[key] = cleanText(input[key]);
  }
  if (isLeadStatus(input.status)) fields.status = input.status;
  return fields;
}

function parseSettings(input: unknown): Partial<Settings> {
  if (!isObject(input)) return {};
  // Os limites numéricos são aplicados pelo banco; aqui só descarta chaves desconhecidas
  const keys: Array<keyof Settings> = [
    'delay_min',
    'delay_max',
    'message_template',
    'typing_simulation',
    'daily_limit',
    'send_hour_start',
    'send_hour_end',
  ];
  return Object.fromEntries(keys.filter((k) => input[k] !== undefined).map((k) => [k, input[k]]));
}

function parseSearchFilters(input: unknown): SearchFilters | null {
  if (!isObject(input)) return null;
  const niche = cleanText(input.niche, 100);
  const city = cleanText(input.city, 100);
  const state = cleanText(input.state, 2).toUpperCase();
  if (!niche || !city) return null;
  return { niche, city, state, limit: clampNumber(input.limit, 1, 200, 25) };
}

export function registerIpcHandlers(getWindow: () => BrowserWindow | null) {
  const send = (channel: string, data: unknown) => {
    const win = getWindow();
    if (win && !win.isDestroyed()) win.webContents.send(channel, data);
  };

  // Eventos do processo principal repassados para a interface
  whatsappManager.onStatusChange((status, qrCode) => send('whatsapp:status-update', { status, qrCode }));
  campaignDispatcher.onProgress((progress) => send('campaign:progress', progress));

  // App
  ipcMain.handle('app:get-info', () => ({ version: app.getVersion(), dataPath: db.filePath }));

  // WhatsApp
  ipcMain.handle('whatsapp:get-status', () => whatsappManager.getStatus());

  ipcMain.handle('whatsapp:connect', async () => {
    await whatsappManager.init();
    return whatsappManager.getStatus();
  });

  ipcMain.handle('whatsapp:disconnect', async () => {
    if (campaignDispatcher.isRunning()) campaignDispatcher.stop();
    await whatsappManager.disconnect();
    return { success: true };
  });

  // Leads
  ipcMain.handle('leads:get-all', (_, filter: unknown) => db.getLeads(parseLeadFilter(filter)));
  ipcMain.handle('leads:add', (_, leads: unknown) => db.addLeads(parseNewLeads(leads)));
  ipcMain.handle('leads:delete', (_, id: unknown) => db.deleteLead(cleanText(id)));
  ipcMain.handle('leads:update', (_, id: unknown, fields: unknown) => db.updateLead(cleanText(id), parseLeadFields(fields)));
  ipcMain.handle('leads:reset-failed', () => ({ count: db.resetFailed() }));
  ipcMain.handle('leads:get-stats', () => db.getStats());

  ipcMain.handle('leads:clear', (_, statusFilter: unknown) => {
    db.clearLeads(isLeadStatus(statusFilter) ? statusFilter : 'all');
    return { success: true };
  });

  ipcMain.handle('leads:export-excel', async () => {
    const win = getWindow();
    if (!win) return { success: false, error: 'Janela fechada' };

    const leads = db.getLeads();
    if (leads.length === 0) return { success: false, error: 'Não há leads para exportar' };

    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Exportar Lista de Leads',
      defaultPath: `AutoSale_Leads_${new Date().toISOString().slice(0, 10)}.xlsx`,
      filters: [{ name: 'Planilha Excel', extensions: ['xlsx'] }],
    });
    if (canceled || !filePath) return { success: false, canceled: true };

    try {
      exportLeadsToFile(leads, filePath);
      db.addLog('success', `Exportados ${leads.length} leads para: ${filePath}`);
      return { success: true, count: leads.length, path: filePath };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Falha ao exportar' };
    }
  });

  ipcMain.handle('leads:import-file', async () => {
    const win = getWindow();
    if (!win) return { success: false, error: 'Janela fechada' };

    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Selecionar Planilha Excel ou CSV',
      filters: [{ name: 'Planilhas', extensions: ['xlsx', 'xls', 'csv'] }],
      properties: ['openFile'],
    });
    if (canceled || filePaths.length === 0) return { success: false, canceled: true };

    try {
      const result = db.addLeads(readLeadsFromFile(filePaths[0]));
      db.addLog(
        'info',
        `Importação finalizada: ${result.added} adicionados, ${result.duplicates} duplicados e ${result.invalid} com telefone inválido ignorados.`
      );
      return { success: true, ...result };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Falha ao ler a planilha' };
    }
  });

  // Configurações
  ipcMain.handle('settings:get', () => db.getSettings());
  ipcMain.handle('settings:save', (_, settings: unknown) => db.saveSettings(parseSettings(settings)));

  // Buscador de empresas
  ipcMain.handle('scraper:search', async (_, input: unknown) => {
    const filters = parseSearchFilters(input);
    if (!filters) return { success: false, results: [], error: 'Informe o nicho e a cidade.' };
    return leadScraper.searchLeads(filters, (found, currentName) => send('scraper:progress', { found, currentName }));
  });

  ipcMain.handle('scraper:cancel', () => {
    leadScraper.cancel();
    return { success: true };
  });

  // Campanha
  ipcMain.handle('campaign:start', () => campaignDispatcher.startCampaign());
  ipcMain.handle('campaign:get-status', () => campaignDispatcher.getStatus());

  ipcMain.handle('campaign:pause', () => {
    campaignDispatcher.pause();
    return { success: true };
  });

  ipcMain.handle('campaign:resume', () => {
    campaignDispatcher.resume();
    return { success: true };
  });

  ipcMain.handle('campaign:stop', () => {
    campaignDispatcher.stop();
    return { success: true };
  });

  // Logs
  ipcMain.handle('logs:get', () => db.getLogs());

  ipcMain.handle('logs:clear', () => {
    db.clearLogs();
    return { success: true };
  });
}
