import { app, BrowserWindow, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { db } from './database';
import { campaignDispatcher } from './dispatcher';
import { registerIpcHandlers } from './ipc';
import { whatsappManager } from './whatsapp';

let mainWindow: BrowserWindow | null = null;

const isDevMode = process.argv.includes('--dev') || process.env.VITE_DEV === 'true';
const DEV_URL = 'http://localhost:5173';

// Renderização via CPU por padrão: evita tela preta em máquinas com drivers de GPU incompatíveis.
// Quem tiver uma GPU funcionando pode abrir com --enable-gpu (ou AUTOSALE_ENABLE_GPU=1).
const gpuEnabled = process.argv.includes('--enable-gpu') || process.env.AUTOSALE_ENABLE_GPU === '1';
if (!gpuEnabled) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-gpu-compositing');
  app.commandLine.appendSwitch('enable-unsafe-swiftshader'); // Permite WebGL via CPU (SwiftShader)
}

function resolveIndexHtml(): string | null {
  const candidates = [
    path.join(app.getAppPath(), 'dist', 'index.html'),
    path.join(__dirname, '../../dist/index.html'),
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

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
      sandbox: true,
    },
  });

  // A interface nunca navega para fora; links externos (ex.: site do lead) abrem no navegador
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!(isDevMode && url.startsWith(DEV_URL))) event.preventDefault();
  });

  if (isDevMode) {
    void mainWindow.loadURL(DEV_URL);
  } else {
    const indexHtml = resolveIndexHtml();
    if (indexHtml) {
      void mainWindow.loadFile(indexHtml);
    } else {
      dialog.showErrorBox('AutoSale', 'Arquivos da interface não encontrados. Rode "npm run build" e tente novamente.');
      app.quit();
      return;
    }
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    // A janela oculta do WhatsApp manteria o processo vivo (e a trava de instância
    // única impediria reabrir o app), então fechar a janela principal encerra tudo
    app.quit();
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
    } else if (app.isReady()) {
      createWindow();
    }
  });

  app.whenReady().then(() => {
    registerIpcHandlers(() => mainWindow);
    createWindow();

    // Reconecta automaticamente se houver sessão do WhatsApp salva
    void whatsappManager.init({ background: true });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('before-quit', () => {
  // Devolve leads "em processamento" para pendentes e grava tudo antes de sair
  if (campaignDispatcher.isRunning()) campaignDispatcher.stop();
  db.resetProcessingLeads();
  whatsappManager.shutdown();
  db.flush();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
