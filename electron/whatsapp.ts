import { BrowserWindow, session } from 'electron';
import path from 'path';
import { app } from 'electron';
import { db } from './database';

export type WhatsAppStatus = 'disconnected' | 'connecting' | 'connected' | 'qr';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export class WhatsAppManager {
  private waWindow: BrowserWindow | null = null;
  private status: WhatsAppStatus = 'disconnected';
  private onStatusChangeCallbacks: Array<(status: WhatsAppStatus, qr: string | null) => void> = [];
  private pollInterval: NodeJS.Timeout | null = null;
  private sessionPartition = 'persist:whatsapp';

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
   */
  public async init() {
    if (this.waWindow && !this.waWindow.isDestroyed()) {
      this.waWindow.show();
      this.waWindow.focus();
      return;
    }

    this.notify('connecting');
    db.addLog('info', 'Abrindo WhatsApp Web...');

    this.waWindow = new BrowserWindow({
      width: 1100,
      height: 700,
      title: 'WhatsApp - AutoSale',
      autoHideMenuBar: true,
      webPreferences: {
        partition: this.sessionPartition, // Sessão persistente entre reinicializações
        nodeIntegration: false,
        contextIsolation: true,
        webgl: false,
        sandbox: false,
      },
    });

    this.waWindow.setMenu(null);

    await this.waWindow.loadURL('https://web.whatsapp.com', { userAgent: UA });

    // Inicia polling para detectar quando o usuário escaneou o QR
    this.startConnectionPolling();

    this.waWindow.on('closed', () => {
      this.waWindow = null;
      this.stopPolling();

      if (this.status !== 'connected') {
        this.notify('disconnected');
      } else {
        db.addLog('info', 'Janela do WhatsApp fechada. Sessão salva — reconecte quando quiser.');
      }
    });
  }

  /**
   * Polling a cada 2s: verifica se o painel de chats do WhatsApp Web já apareceu.
   */
  private startConnectionPolling() {
    this.stopPolling();
    this.notify('qr');

    this.pollInterval = setInterval(async () => {
      if (!this.waWindow || this.waWindow.isDestroyed()) {
        this.stopPolling();
        return;
      }

      try {
        const isLoggedIn: boolean = await this.waWindow.webContents.executeJavaScript(`
          (() => {
            const chatList =
              document.querySelector('#side') ||
              document.querySelector('[data-testid="chat-list"]') ||
              document.querySelector('div[aria-label="Lista de conversas"]') ||
              document.querySelector('div[aria-label="Conversation list"]');
            return !!chatList;
          })()
        `);

        if (isLoggedIn && this.status !== 'connected') {
          this.notify('connected');
          db.addLog('success', 'WhatsApp Web conectado! Pronto para disparos.');

          // Oculta janela após login — sessão continua ativa em background
          setTimeout(() => {
            if (this.waWindow && !this.waWindow.isDestroyed()) {
              this.waWindow.hide();
            }
          }, 1500);

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

  public async disconnect() {
    this.stopPolling();

    if (this.waWindow && !this.waWindow.isDestroyed()) {
      const ses = session.fromPartition(this.sessionPartition);
      await ses.clearStorageData();
      this.waWindow.destroy();
      this.waWindow = null;
    }

    this.notify('disconnected');
    db.addLog('info', 'WhatsApp desconectado e sessão apagada.');
  }

  public formatPhone(rawPhone: string): string {
    let clean = rawPhone.replace(/\D/g, '');
    if (clean.length === 10 || clean.length === 11) {
      clean = '55' + clean;
    }
    return clean;
  }

  /**
   * Envia mensagem via WhatsApp Web.
   * Estratégia:
   *  1. Navega para web.whatsapp.com/send?phone=...&text=...
   *  2. Aguarda o campo de input aparecer (polling JS, até 20s)
   *  3. Foca o input via JS
   *  4. Dispara Enter via sendInputEvent (evento de SO — mais confiável que JS sintético)
   */
  public async sendMessage(
    rawPhone: string,
    text: string,
    simulateTyping = true
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (this.status !== 'connected') {
      return { success: false, error: 'WhatsApp não está conectado' };
    }

    if (!this.waWindow || this.waWindow.isDestroyed()) {
      return { success: false, error: 'Janela do WhatsApp não está disponível' };
    }

    const phone = this.formatPhone(rawPhone);
    const encodedText = encodeURIComponent(text);
    const url = `https://web.whatsapp.com/send?phone=${phone}&text=${encodedText}`;

    try {
      // Garante que a janela está visível e focada (necessário para sendInputEvent)
      this.waWindow.show();
      this.waWindow.focus();

      await this.waWindow.loadURL(url, { userAgent: UA });

      // Polling em JS: aguarda o campo de texto aparecer (timeout 20s)
      const inputFound: boolean = await this.waWindow.webContents.executeJavaScript(`
        new Promise((resolve) => {
          const maxMs = 20000;
          const start = Date.now();
          const timer = setInterval(() => {
            const input =
              document.querySelector('[data-testid="conversation-compose-box-input"]') ||
              document.querySelector('div[contenteditable="true"][data-tab="10"]') ||
              document.querySelector('div[contenteditable="true"][spellcheck="true"]') ||
              document.querySelector('footer div[contenteditable="true"]');
            if (input) {
              clearInterval(timer);
              input.focus();
              resolve(true);
            } else if (Date.now() - start > maxMs) {
              clearInterval(timer);
              resolve(false);
            }
          }, 300);
        })
      `);

      if (!inputFound) {
        return {
          success: false,
          error: 'Não foi possível abrir a conversa no WhatsApp Web (timeout de 20s)',
        };
      }

      // Delay humanizado antes de "enviar"
      const typingDelay = simulateTyping
        ? Math.floor(Math.random() * 1500) + 1000
        : 800;
      await new Promise((r) => setTimeout(r, typingDelay));

      // Envia Enter via evento de SO (mais confiável que eventos JS sintéticos)
      await this.waWindow.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Return' });
      await new Promise((r) => setTimeout(r, 100));
      await this.waWindow.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Return' });

      // Aguarda o envio ser processado
      await new Promise((r) => setTimeout(r, 1200));

      // Retorna ao feed principal
      await this.waWindow.loadURL('https://web.whatsapp.com', { userAgent: UA });

      // Oculta janela após envio
      setTimeout(() => {
        if (this.waWindow && !this.waWindow.isDestroyed()) {
          this.waWindow.hide();
        }
      }, 1500);

      return {
        success: true,
        messageId: 'wa_' + Date.now(),
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Falha ao enviar mensagem',
      };
    }
  }
}

export const whatsappManager = new WhatsAppManager();
