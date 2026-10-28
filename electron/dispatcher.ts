import { db } from './database';
import type { ActionResult, DispatchProgress, Settings } from './types';
import { formatMessage, isWithinSendWindow, randomBetween } from './utils';
import { whatsappManager } from './whatsapp';

const IDLE_PROGRESS: DispatchProgress = {
  isRunning: false,
  isPaused: false,
  total: 0,
  processed: 0,
  successCount: 0,
  failCount: 0,
  currentLead: null,
  nextDelaySec: 0,
  waitingReason: null,
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const formatHour = (h: number) => `${String(h).padStart(2, '0')}h`;

/** Motivo para encerrar a campanha antes do fim da fila */
type HaltReason = 'stopped' | 'daily-limit' | 'disconnected';

export class CampaignDispatcher {
  // `running` só volta a false quando o loop realmente termina, impedindo duas filas ao mesmo tempo
  private running = false;
  private paused = false;
  private stopRequested = false;
  private progress: DispatchProgress = { ...IDLE_PROGRESS };
  private onProgressCallbacks: Array<(progress: DispatchProgress) => void> = [];

  public onProgress(cb: (progress: DispatchProgress) => void) {
    this.onProgressCallbacks.push(cb);
  }

  private update(patch: Partial<DispatchProgress>) {
    this.progress = { ...this.progress, ...patch };
    for (const cb of this.onProgressCallbacks) {
      try {
        cb({ ...this.progress });
      } catch (e) {
        console.error('Erro no callback de progresso de disparos:', e);
      }
    }
  }

  public getStatus(): DispatchProgress {
    return { ...this.progress };
  }

  public isRunning() {
    return this.running;
  }

  public pause() {
    if (!this.running || this.paused) return;
    this.paused = true;
    this.update({ isPaused: true });
    db.addLog('info', 'Campanha de disparos pausada pelo usuário.');
  }

  public resume() {
    if (!this.running || !this.paused) return;
    this.paused = false;
    this.update({ isPaused: false });
    db.addLog('info', 'Campanha de disparos retomada.');
  }

  /** Pede a interrupção; o envio em andamento termina e o loop encerra logo em seguida */
  public stop() {
    if (!this.running || this.stopRequested) return;
    this.stopRequested = true;
    this.paused = false;
    this.update({ isPaused: false, waitingReason: 'Interrompendo após o envio atual...' });
    db.addLog('warning', 'Interrupção da campanha solicitada.');
  }

  private dailyLimitReached(settings: Settings) {
    return settings.daily_limit > 0 && db.countSentToday() >= settings.daily_limit;
  }

  /**
   * Espera até poder enviar: respeita pausa e janela de horário.
   * Devolve o motivo de parada quando a campanha não deve continuar.
   */
  private async waitUntilAllowed(): Promise<HaltReason | null> {
    while (true) {
      if (this.stopRequested) return 'stopped';

      const settings = db.getSettings();
      if (this.dailyLimitReached(settings)) return 'daily-limit';
      if (whatsappManager.getStatus().status !== 'connected') return 'disconnected';

      if (this.paused) {
        await sleep(500);
        continue;
      }

      if (!isWithinSendWindow(new Date(), settings.send_hour_start, settings.send_hour_end)) {
        const reason = `Aguardando a janela de envio (${formatHour(settings.send_hour_start)}–${formatHour(settings.send_hour_end)})`;
        if (this.progress.waitingReason !== reason) this.update({ waitingReason: reason });
        await sleep(15000);
        continue;
      }

      if (this.progress.waitingReason) this.update({ waitingReason: null });
      return null;
    }
  }

  /** Contagem regressiva entre envios; pausa congela o contador */
  private async countdown(seconds: number) {
    for (let s = seconds; s > 0; s--) {
      if (this.stopRequested) return;
      while (this.paused && !this.stopRequested) await sleep(500);
      this.update({ nextDelaySec: s });
      await sleep(1000);
    }
    this.update({ nextDelaySec: 0 });
  }

  public async startCampaign(): Promise<ActionResult> {
    if (this.running) {
      return { success: false, message: 'Uma campanha já está em execução (ou finalizando o envio atual).' };
    }

    if (whatsappManager.getStatus().status !== 'connected') {
      return { success: false, message: 'WhatsApp desconectado! Conecte o WhatsApp antes de iniciar os disparos.' };
    }

    const settings = db.getSettings();
    if (this.dailyLimitReached(settings)) {
      return { success: false, message: `Limite diário de ${settings.daily_limit} mensagens já atingido hoje.` };
    }

    // Os mais antigos primeiro: quem entrou antes na base recebe antes
    const queue = db.getLeads({ status: 'pending' }).reverse().map((l) => l.id);
    if (queue.length === 0) {
      return { success: false, message: 'Nenhum lead com status pendente para envio.' };
    }

    this.running = true;
    this.paused = false;
    this.stopRequested = false;
    this.update({ ...IDLE_PROGRESS, isRunning: true, total: queue.length });
    db.addLog('info', `Iniciando fila de disparos para ${queue.length} leads pendentes.`);

    void this.runQueue(queue);

    return { success: true, message: `Campanha iniciada com ${queue.length} leads na fila!` };
  }

  private async runQueue(queue: string[]) {
    let halt: HaltReason | null = null;

    try {
      for (let i = 0; i < queue.length; i++) {
        halt = await this.waitUntilAllowed();
        if (halt) break;

        // O lead pode ter sido excluído ou editado enquanto a campanha rodava
        const lead = db.getLead(queue[i]);
        if (!lead || lead.status !== 'pending') {
          this.update({ total: this.progress.total - 1 });
          continue;
        }

        const settings = db.getSettings();
        db.updateLeadStatus(lead.id, 'processing');
        this.update({ currentLead: { ...lead, status: 'processing' }, nextDelaySec: 0 });

        const text = formatMessage(settings.message_template, lead);
        const result = await whatsappManager.sendMessage(lead.phone, text, settings.typing_simulation);

        if (result.success) {
          db.updateLeadStatus(lead.id, 'sent');
          db.addLog('success', `Mensagem enviada para ${lead.name} (${lead.phone})`);
          this.update({ processed: this.progress.processed + 1, successCount: this.progress.successCount + 1 });
        } else if (result.retryable) {
          // Problema da sessão, não do lead: devolve à fila e encerra
          db.updateLeadStatus(lead.id, 'pending');
          db.addLog('error', `Envio interrompido: ${result.error}`);
          halt = 'disconnected';
          break;
        } else {
          db.updateLeadStatus(lead.id, 'failed', result.error);
          db.addLog('error', `Falha ao enviar para ${lead.name}: ${result.error}`);
          this.update({ processed: this.progress.processed + 1, failCount: this.progress.failCount + 1 });
        }
        this.update({ currentLead: null });

        // Delay humanizado antes do próximo envio
        if (i < queue.length - 1 && !this.stopRequested) {
          await this.countdown(randomBetween(settings.delay_min, settings.delay_max));
        }
      }
    } catch (err: any) {
      db.addLog('error', `Erro inesperado na campanha: ${err?.message || err}`);
    } finally {
      db.resetProcessingLeads();
      this.running = false;
      this.paused = false;
      this.stopRequested = false;
      this.update({ isRunning: false, isPaused: false, currentLead: null, nextDelaySec: 0, waitingReason: null });

      const { processed, successCount, failCount } = this.progress;
      const summary = `Total processado: ${processed} (${successCount} enviados, ${failCount} falhas).`;
      if (halt === 'stopped') db.addLog('warning', `Campanha interrompida. ${summary}`);
      else if (halt === 'daily-limit') db.addLog('warning', `Limite diário atingido; os demais leads continuam pendentes. ${summary}`);
      else if (halt === 'disconnected') db.addLog('error', `Campanha encerrada: WhatsApp desconectado. ${summary}`);
      else db.addLog('info', `Campanha finalizada. ${summary}`);
    }
  }
}

export const campaignDispatcher = new CampaignDispatcher();
