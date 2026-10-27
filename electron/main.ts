import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import * as XLSX from 'xlsx';
import { db } from './database';
import { whatsappManager } from './whatsapp';
import { leadScraper } from './scraper';
import { campaignDispatcher } from './dispatcher';

let mainWindow: BrowserWindow | null = null;

// Força renderização via CPU (software) para evitar erros de GPU em hardware/drivers incompatíveis
// O software rasterizer (Skia) garante que a interface renderize mesmo sem aceleração de hardware
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('enable-unsafe-swiftshader'); // Permite WebGL via CPU (SwiftShader)
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-dev-shm-usage');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#020617',
    title: 'AutoSale - Prospecção & WhatsApp',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  const isDevMode = process.argv.includes('--dev') || process.env.VITE_DEV === 'true';
  const appIndexPath = path.join(app.getAppPath(), 'dist', 'index.html');
  const relativeIndexPath = path.join(__dirname, '../../dist/index.html');

  if (isDevMode) {
    mainWindow.loadURL('http://localhost:5173');
    // mainWindow.webContents.openDevTools();
  } else if (fs.existsSync(appIndexPath)) {
    mainWindow.loadFile(appIndexPath);
  } else if (fs.existsSync(relativeIndexPath)) {
    mainWindow.loadFile(relativeIndexPath);
  } else {
    mainWindow.loadURL('http://localhost:5173');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Configura listeners de eventos do WhatsApp para enviar à janela
  whatsappManager.onStatusChange((status, qrCode) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('whatsapp:status-update', { status, qrCode });
    }
  });

  // Configura listeners do disparador de campanha
  campaignDispatcher.onProgress((progress) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('campaign:progress', progress);
    }
  });
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    registerIpcHandlers();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  // Só fecha o app se a janela principal foi destruída
  // A janela do WhatsApp pode ser fechada/ocultada sem encerrar o app
  if (!mainWindow || mainWindow.isDestroyed()) {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  }
});

function registerIpcHandlers() {
  // WhatsApp Handlers
  ipcMain.handle('whatsapp:get-status', () => {
    return whatsappManager.getStatus();
  });

  ipcMain.handle('whatsapp:connect', async () => {
    await whatsappManager.init();
    return whatsappManager.getStatus();
  });

  ipcMain.handle('whatsapp:disconnect', async () => {
    await whatsappManager.disconnect();
    return { success: true };
  });

  // Leads Handlers
  ipcMain.handle('leads:get-all', (_, filter) => {
    return db.getLeads(filter);
  });

  ipcMain.handle('leads:add', (_, leads) => {
    return db.addLeads(leads);
  });

  ipcMain.handle('leads:delete', (_, id) => {
    return db.deleteLead(id);
  });

  ipcMain.handle('leads:update', (_, id: string, fields: any) => {
    return db.updateLead(id, fields);
  });

  ipcMain.handle('leads:clear', (_, statusFilter) => {
    db.clearLeads(statusFilter);
    return { success: true };
  });


  ipcMain.handle('leads:get-stats', () => {
    return db.getStats();
  });

  // Exportar Excel
  ipcMain.handle('leads:export-excel', async () => {
    if (!mainWindow) return { success: false, error: 'Janela fechada' };

    const leads = db.getLeads();
    if (leads.length === 0) {
      return { success: false, error: 'Não há leads para exportar' };
    }

    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Exportar Lista de Leads',
      defaultPath: `AutoSale_Leads_${new Date().toISOString().slice(0, 10)}.xlsx`,
      filters: [{ name: 'Planilha Excel', extensions: ['xlsx'] }],
    });

    if (canceled || !filePath) return { success: false, canceled: true };

    try {
      const dataToExport = leads.map((l) => ({
        ID: l.id,
        'Nome da Empresa': l.name,
        Telefone: l.phone,
        Ramo: l.business_type || '',
        Cidade: l.city || '',
        Endereço: l.address || '',
        Instagram: l.instagram || '',
        Status: l.status,
        'Data de Envio': l.sent_at || '',
        'Erro / Motivo': l.error_message || '',
        'Data de Cadastro': l.created_at,
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads');
      XLSX.writeFile(workbook, filePath);

      db.addLog('success', `Exportados ${leads.length} leads para: ${filePath}`);
      return { success: true, count: leads.length, path: filePath };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // Importar Excel / CSV
  ipcMain.handle('leads:import-file', async () => {
    if (!mainWindow) return { success: false, error: 'Janela fechada' };

    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Selecionar Planilha Excel ou CSV',
      filters: [{ name: 'Planilhas', extensions: ['xlsx', 'xls', 'csv'] }],
      properties: ['openFile'],
    });

    if (canceled || !filePaths || filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    try {
      const workbook = XLSX.readFile(filePaths[0]);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawRows: any[] = XLSX.utils.sheet_to_json(sheet);

      const parsedLeads = rawRows.map((row) => {
        // Encontra campos mesmo com variações de cabeçalho
        const name = row['Nome'] || row['Nome da Empresa'] || row['name'] || row['Empresa'] || 'Empresa';
        const phone =
          row['Telefone'] ||
          row['phone'] ||
          row['WhatsApp'] ||
          row['whatsapp'] ||
          row['Celular'] ||
          row['Contato'] ||
          '';
        const business_type = row['Ramo'] || row['Categoria'] || row['Nicho'] || row['business_type'] || 'Geral';
        const city = row['Cidade'] || row['city'] || '';
        const address = row['Endereço'] || row['address'] || '';
        const instagram = row['Instagram'] || row['instagram'] || '';

        return {
          name: String(name).trim(),
          phone: String(phone).trim(),
          business_type: String(business_type).trim(),
          city: String(city).trim(),
          address: String(address).trim(),
          instagram: String(instagram).trim(),
        };
      });

      const result = db.addLeads(parsedLeads);
      db.addLog(
        'info',
        `Importação finalizada: ${result.added} leads adicionados, ${result.duplicates} duplicados ignorados.`
      );
      return { success: true, ...result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // Settings Handlers
  ipcMain.handle('settings:get', () => {
    return db.getSettings();
  });

  ipcMain.handle('settings:save', (_, newSettings) => {
    return db.saveSettings(newSettings);
  });

  // Scraper Handlers
  ipcMain.handle('scraper:search', async (_, filters) => {
    const results = await leadScraper.searchLeads(filters, (found, currentName) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('scraper:progress', { found, currentName });
      }
    });
    return results;
  });

  // Campaign Handlers
  ipcMain.handle('campaign:start', async () => {
    return campaignDispatcher.startCampaign();
  });

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

  ipcMain.handle('campaign:get-status', () => {
    return campaignDispatcher.getStatus();
  });

  // Logs Handlers
  ipcMain.handle('logs:get', () => {
    return db.getLogs();
  });

  ipcMain.handle('logs:clear', () => {
    db.clearLogs();
    return { success: true };
  });
}
