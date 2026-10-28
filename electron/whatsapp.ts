import { BrowserWindow, session } from 'electron';
import { db } from './database';
import type { WhatsAppStatus } from './types';
import { normalizePhone } from './utils';

export type { WhatsAppStatus } from './types';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const WA_URL = 'https://web.whatsapp.com';

export interface SendResult {
  success: boolean;
  error?: string;
  /** true quando a falha é da sessão (e não do número): o lead deve voltar para a fila */
  retryable?: boolean;
}

type ChatState = 'ready' | 'invalid' | 'logged-out' | 'timeout';

// Seletores do WhatsApp Web; mudam de tempos em tempos, por isso há alternativas
const COMPOSE_SELECTORS = [
  'footer [data-testid="conversation-compose-box-input"]',
  'footer div[contenteditable="true"][data-tab="10"]',
  'footer div[contenteditable="true"]',
];
const SEND_BUTTON_SELECTORS = [
  'footer [data-testid="send"]',
  'footer button[aria-label="Enviar"]',
  'footer button[aria-label="Send"]',
  'footer span[data-icon="send"]',
  'footer span[data-icon="wds-ic-send-filled"]',
];
const CHAT_LIST_SELECTORS = [
  '#side',
  '[data-testid="chat-list"]',
  'div[aria-label="Lista de conversas"]',
  'div[aria-label="Conversation list"]',
];
const QR_SELECTORS = ['canvas[aria-label]', 'div[data-ref]'];

const js = (selectors: string[]) => JSON.stringify(selectors);

export class WhatsAppManager {
  private waWindow: BrowserWindow | null = null;
  private status: WhatsAppStatus = 'disconnected';
  private onStatusChangeCallbacks: Array<(status: WhatsAppStatus, qr: string | null) => void> = [];
  private pollInterval: NodeJS.Timeout | null = null;
  private hideTimer: NodeJS.Timeout | null = null;
  private readonly sessionPartition = 'persist:whatsapp';
  private isShuttingDown = false;

  public onStatusChange(callback: (status: WhatsAppStatus, qr: string | null) => void) {
    this.onStatusChangeCallbacks.push(callback);
    callback(this.status, null);
  }

  private notify(status: WhatsAppStatus, qr: string | null = null) {
    this.status = status;
    for (const cb of this.onStatusChangeCallbacks) {
      try {
        cb(status, qr);
      } catch {}
    }
  }

  public getStatus() {
    return { status: this.status, qrCode: null };
  }

  /**
   * Abre uma janela separada com o WhatsApp Web real.
   * O usuário escaneia o QR como de costume. A sessão é salva em disco
   * automaticamente pelo Electron (partition: persist:whatsapp).
   *
   * Com `background: true` (usado ao abrir o app), a janela fica oculta e só
   * restaura uma sessão já salva; se o WhatsApp pedir QR, a tentativa é descartada.
   */
  public async init(options: { background?: boolean } = {}) {
    const background = options.background ?? false;

    if (this.waWindow && !this.waWindow.isDestroyed()) {
      if (!background) {
        this.waWindow.show();
        this.waWindow.focus();
        // Restauração em segundo plano ainda em andamento: passa a aguardar o QR
        if (this.status !== 'connected') this.startConnectionPolling(false);
      }
      return;
    }

    this.notify('connecting');
    db.addLog('info', background ? 'Restaurando sessão salva do WhatsApp...' : 'Abrindo WhatsApp Web...');

    this.waWindow = new BrowserWindow({
      width: 1100,
      height: 700,
      title: 'WhatsApp - AutoSale',
      autoHideMenuBar: true,
      show: !background,
      webPreferences: {
        partition: this.sessionPartition, // Sessão persistente entre reinicializações
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webgl: false,
        backgroundThrottling: false, // Janela fica oculta a maior parte do tempo
      },
    });

    this.waWindow.setMenu(null);
    // Links abertos de dentro do WhatsApp não devem criar janelas novas no app
    this.waWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

    // Fechar no "X" com a sessão ativa apenas oculta a janela; ela só é destruída
    // ao desconectar ou ao encerrar o app (shutdown)
    this.waWindow.on('close', (event) => {
      if (!this.isShuttingDown && this.status === 'connected') {
        event.preventDefault();
        this.waWindow?.hide();
      }
    });

    this.waWindow.on('closed', () => {
      this.waWindow = null;
      this.stopPolling();
      if (!this.isShuttingDown) this.notify('disconnected');
    });

    // Inicia polling para detectar quando o usuário escaneou o QR
    this.startConnectionPolling(background);

    try {
      await this.waWindow.loadURL(WA_URL, { userAgent: UA });
    } catch (err: any) {
      db.addLog('error', `Falha ao carregar o WhatsApp Web: ${err?.message || err}`);
    }
  }

  /** Encerra a janela do WhatsApp junto com o app. A sessão continua salva em disco. */
  public shutdown() {
    this.isShuttingDown = true;
    this.stopPolling();
    this.clearHideTimer();
    if (this.waWindow && !this.waWindow.isDestroyed()) this.waWindow.destroy();
    this.waWindow = null;
  }

  /**
   * Polling a cada 2s: verifica se o painel de chats do WhatsApp Web já apareceu.
   * Em modo `background`, desiste se aparecer o QR (sessão inexistente/expirada)
   * ou após 45s, destruindo a janela oculta.
   */
  private startConnectionPolling(background: boolean) {
    this.stopPolling();
    if (!background) this.notify('qr');

    const startedAt = Date.now();

    this.pollInterval = setInterval(async () => {
      if (!this.waWindow || this.waWindow.isDestroyed()) {
        this.stopPolling();
        return;
      }

      try {
        const state: 'logged-in' | 'qr' | 'loading' = await this.waWindow.webContents.executeJavaScript(`
          (() => {
            const any = (list) => list.some((s) => document.querySelector(s));
            if (any(${js(CHAT_LIST_SELECTORS)})) return 'logged-in';
            if (any(${js(QR_SELECTORS)})) return 'qr';
            return 'loading';
          })()
        `);

        if (background && state !== 'logged-in') {
          if (state === 'qr' || Date.now() - startedAt > 45000) {
            this.stopPolling();
            this.waWindow?.destroy();
            db.addLog('info', 'Nenhuma sessão do WhatsApp para restaurar. Clique em "Conectar WhatsApp".');
          }
          return;
        }

        if (state === 'logged-in' && this.status !== 'connected') {
          this.notify('connected');
          db.addLog('success', 'WhatsApp Web conectado! Pronto para disparos.');
          this.scheduleHide(1500); // Sessão continua ativa em background
          this.stopPolling();
        }
      } catch {
        // Página ainda carregando — ignora
      }
    }, 2000);
  }

  private stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  private scheduleHide(ms: number) {
    this.clearHideTimer();
    this.hideTimer = setTimeout(() => {
      this.hideTimer = null;
      if (this.waWindow && !this.waWindow.isDestroyed()) this.waWindow.hide();
    }, ms);
  }

  private clearHideTimer() {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  public async disconnect() {
    this.stopPolling();
    this.clearHideTimer();

    // Apaga a sessão salva mesmo se a janela já estiver fechada, forçando novo QR
    await session.fromPartition(this.sessionPartition).clearStorageData();
    if (this.waWindow && !this.waWindow.isDestroyed()) this.waWindow.destroy();
    this.waWindow = null;

    this.notify('disconnected');
    db.addLog('info', 'WhatsApp desconectado e sessão apagada.');
  }

  /** Espera a conversa abrir e identifica número inválido ou sessão expirada (timeout 25s) */
  private waitForChat(win: BrowserWindow): Promise<ChatState> {
    return win.webContents.executeJavaScript(`
      new Promise((resolve) => {
        const start = Date.now();
        const find = (list) => list.map((s) => document.querySelector(s)).find(Boolean);
        const timer = setInterval(() => {
          // Só está pronto quando o WhatsApp já preencheu o texto vindo da URL
          const input = find(${js(COMPOSE_SELECTORS)});
          if (input && (input.textContent || '').trim()) {
            clearInterval(timer);
            input.focus();
            return resolve('ready');
          }
          // Popup "O número de telefone compartilhado através de url é inválido"
          const dialog = document.querySelector('[data-animate-modal-popup="true"], div[role="dialog"]');
          if (dialog && /inválido|invalid/i.test(dialog.textContent || '')) {
            clearInterval(timer);
            return resolve('invalid');
          }
          if (find(${js(QR_SELECTORS)})) {
            clearInterval(timer);
            return resolve('logged-out');
          }
          if (Date.now() - start > 25000) {
            clearInterval(timer);
            resolve('timeout');
          }
        }, 300);
      })
    `);
  }

  /** Clica no botão de enviar; devolve false se o botão não foi encontrado */
  private clickSend(win: BrowserWindow): Promise<boolean> {
    return win.webContents.executeJavaScript(`
      (() => {
        const el = ${js(SEND_BUTTON_SELECTORS)}.map((s) => document.querySelector(s)).find(Boolean);
        const button = el && (el.closest('button') || el);
        if (!button) return false;
        button.click();
        return true;
      })()
    `);
  }

  /** A mensagem saiu quando a caixa de texto volta a ficar vazia */
  private waitComposeEmpty(win: BrowserWindow): Promise<boolean> {
    return win.webContents.executeJavaScript(`
      new Promise((resolve) => {
        const start = Date.now();
        const timer = setInterval(() => {
          const input = ${js(COMPOSE_SELECTORS)}.map((s) => document.querySelector(s)).find(Boolean);
          const empty = !input || !(input.textContent || '').trim();
          if (empty || Date.now() - start > 6000) {
            clearInterval(timer);
            resolve(empty);
          }
        }, 250);
      })
    `);
  }

  /**
   * Envia mensagem via WhatsApp Web.
   *  1. Navega para web.whatsapp.com/send?phone=...&text=... (o texto já vem preenchido)
   *  2. Aguarda a conversa abrir, detectando número inválido ou sessão expirada
   *  3. Clica em "Enviar" (ou usa Enter como alternativa) e confirma que a caixa esvaziou
   */
  public async sendMessage(rawPhone: string, text: string, simulateTyping = true): Promise<SendResult> {
    if (this.status !== 'connected') {
      return { success: false, error: 'WhatsApp não está conectado', retryable: true };
    }
    const win = this.waWindow;
    if (!win || win.isDestroyed()) {
      return { success: false, error: 'Janela do WhatsApp não está disponível', retryable: true };
    }

    const phone = normalizePhone(rawPhone);
    if (!phone) return { success: false, error: 'Número de telefone inválido' };

    const url = `${WA_URL}/send?phone=${phone}&text=${encodeURIComponent(text)}`;

    try {
      this.clearHideTimer();
      // A janela precisa estar renderizando, mas sem roubar o foco do usuário
      if (!win.isVisible()) win.showInactive();

      await win.loadURL(url, { userAgent: UA });

      const state = await this.waitForChat(win);
      if (state === 'invalid') return { success: false, error: 'Número não possui WhatsApp' };
      if (state === 'logged-out') {
        this.notify('disconnected');
        db.addLog('error', 'A sessão do WhatsApp expirou. Conecte novamente escaneando o QR Code.');
        return { success: false, error: 'Sessão do WhatsApp expirou', retryable: true };
      }
      if (state === 'timeout') {
        return { success: false, error: 'Não foi possível abrir a conversa no WhatsApp Web (timeout de 25s)' };
      }

      // Pausa humanizada antes de "enviar"
      const typingDelay = simulateTyping ? Math.floor(Math.random() * 1500) + 1000 : 800;
      await new Promise((r) => setTimeout(r, typingDelay));

      if (!(await this.clickSend(win))) {
        // Alternativa: Enter via evento de SO no campo já focado
        win.webContents.focus();
        win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Return' });
        await new Promise((r) => setTimeout(r, 100));
        win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Return' });
      }

      const sent = await this.waitComposeEmpty(win);
      if (!sent) return { success: false, error: 'A mensagem não saiu da caixa de texto (envio não confirmado)' };

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Falha ao enviar mensagem' };
    } finally {
      this.scheduleHide(1500);
    }
  }
}

export const whatsappManager = new WhatsAppManager();
