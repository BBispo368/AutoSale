import { db, Lead } from './database';
import { whatsappManager } from './whatsapp';

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

export class CampaignDispatcher {
  private isRunning = false;
  private isPaused = false;
  private shouldStop = false;
  private onProgressCallbacks: Array<(progress: DispatchProgress) => void> = [];

  public onProgress(cb: (progress: DispatchProgress) => void) {
    this.onProgressCallbacks.push(cb);
  }

  private notify(progress: DispatchProgress) {
    for (const cb of this.onProgressCallbacks) {
      try {
        cb(progress);
      } catch (e) {
        console.error('Erro no callback de progresso de disparos:', e);
      }
    }
  }

  public getStatus(): DispatchProgress {
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      total: 0,
      processed: 0,
      successCount: 0,
      failCount: 0,
      currentLead: null,
      nextDelaySec: 0,
    };
  }

  public pause() {
    this.isPaused = true;
    db.addLog('info', 'Campanha de disparos pausada pelo usuário.');
  }

  public resume() {
    this.isPaused = false;
    db.addLog('info', 'Campanha de disparos retomada.');
  }

  public stop() {
    this.shouldStop = true;
    this.isRunning = false;
    this.isPaused = false;
    db.resetLeadsStatus();
    db.addLog('warning', 'Campanha de disparos interrompida.');
  }

  private formatMessage(template: string, lead: Lead): string {
    return template
      .replace(/{nome_empresa}|{nome}/gi, lead.name || 'Empresa')
      .replace(/{ramo}|{nicho}/gi, lead.business_type || 'sua área')
      .replace(/{cidade}/gi, lead.city || 'sua região')
      .replace(/{telefone}/gi, lead.phone || '');
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getRandomDelay(minSec: number, maxSec: number): number {
    const min = Math.min(minSec, maxSec);
    const max = Math.max(minSec, maxSec);
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

  public async startCampaign(): Promise<{ success: boolean; message: string }> {
    if (this.isRunning) {
      return { success: false, message: 'Uma campanha já está em execução.' };
    }

    const waStatus = whatsappManager.getStatus();
    if (waStatus.status !== 'connected') {
      return {
        success: false,
        message: 'WhatsApp desconectado! Escaneie o QR Code antes de iniciar os disparos.',
      };
    }

    const settings = db.getSettings();
    const pendingLeads = db.getLeads({ status: 'pending' });

    if (pendingLeads.length === 0) {
      return { success: false, message: 'Nenhum lead com status pendente para envio.' };
    }

    this.isRunning = true;
    this.isPaused = false;
    this.shouldStop = false;

    db.addLog('info', `Iniciando fila de disparos para ${pendingLeads.length} leads pendentes.`);

    let processed = 0;
    let successCount = 0;
    let failCount = 0;

    // Executa em background de forma assíncrona
    (async () => {
      for (const lead of pendingLeads) {
        if (this.shouldStop) break;

        // Suporte a pausa
        while (this.isPaused && !this.shouldStop) {
          await this.sleep(1000);
        }

        if (this.shouldStop) break;

        db.updateLeadStatus(lead.id, 'processing');
        const text = this.formatMessage(settings.message_template, lead);

        this.notify({
          isRunning: true,
          isPaused: false,
          total: pendingLeads.length,
          processed,
          successCount,
          failCount,
          currentLead: lead,
          nextDelaySec: 0,
        });

        // Envio da mensagem via Baileys
        const sendResult = await whatsappManager.sendMessage(
          lead.phone,
          text,
          settings.typing_simulation
        );

        processed++;

        if (sendResult.success) {
          successCount++;
          db.updateLeadStatus(lead.id, 'sent');
          db.addLog('success', `Mensagem enviada com sucesso para ${lead.name} (${lead.phone})`);
        } else {
          failCount++;
          db.updateLeadStatus(lead.id, 'failed', sendResult.error);
          db.addLog('error', `Falha ao enviar para ${lead.name}: ${sendResult.error}`);
        }

        // Se ainda restarem leads, calcula o delay humanizado antes do próximo
        if (processed < pendingLeads.length && !this.shouldStop) {
          const delaySec = this.getRandomDelay(settings.delay_min, settings.delay_max);
          this.notify({
            isRunning: true,
            isPaused: false,
            total: pendingLeads.length,
            processed,
            successCount,
            failCount,
            currentLead: null,
            nextDelaySec: delaySec,
          });

          // Contagem regressiva do delay
          for (let s = delaySec; s > 0; s--) {
            if (this.shouldStop) break;
            while (this.isPaused && !this.shouldStop) {
              await this.sleep(1000);
            }
            await this.sleep(1000);
          }
        }
      }

      this.isRunning = false;
      this.notify({
        isRunning: false,
        isPaused: false,
        total: pendingLeads.length,
        processed,
        successCount,
        failCount,
        currentLead: null,
        nextDelaySec: 0,
      });

      db.addLog(
        'info',
        `Campanha finalizada. Total processado: ${processed} (${successCount} enviados, ${failCount} falhas).`
      );
    })();

    return {
      success: true,
      message: `Campanha iniciada com ${pendingLeads.length} leads na fila!`,
    };
  }
}

export const campaignDispatcher = new CampaignDispatcher();
