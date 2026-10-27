import React, { useState, useEffect } from 'react';
import {
  QrCode,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Send,
  Clock,
  Zap,
  Users,
  CheckCheck,
  AlertTriangle,
  Pause,
  Play,
  Square,
  Sparkles,
} from 'lucide-react';
import { Settings, DispatchProgress } from '../types/electron';

interface DashboardTabProps {
  onShowToast: (type: 'success' | 'error', message: string) => void;
  onNavigateToLeads: () => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({ onShowToast, onNavigateToLeads }) => {
  const [waStatus, setWaStatus] = useState<string>('disconnected');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);

  const [settings, setSettings] = useState<Settings>({
    id: 1,
    delay_min: 20,
    delay_max: 45,
    message_template: 'Olá {nome_empresa}! Vi que você atua com {ramo} em {cidade}. Temos soluções para aumentar suas vendas. Podemos conversar?',
    typing_simulation: true,
    daily_limit: 150,
  });
  const [savingSettings, setSavingSettings] = useState(false);

  const [stats, setStats] = useState({ total: 0, pending: 0, sent: 0, failed: 0, replied: 0 });

  const [campaignProgress, setCampaignProgress] = useState<DispatchProgress>({
    isRunning: false,
    isPaused: false,
    total: 0,
    processed: 0,
    successCount: 0,
    failCount: 0,
    currentLead: null,
    nextDelaySec: 0,
  });

  useEffect(() => {
    loadWhatsAppStatus();
    loadSettings();
    loadStats();

    // Listeners do Electron IPC
    if (window.electronAPI) {
      const unsubWA = window.electronAPI.whatsapp.onStatusChange((data) => {
        setWaStatus(data.status);
        setQrCode(data.qrCode);
        if (data.status === 'connected') {
          setLoadingQr(false);
        }
      });

      const unsubCampaign = window.electronAPI.campaign.onProgress((progress) => {
        setCampaignProgress(progress);
        loadStats();
      });

      return () => {
        unsubWA();
        unsubCampaign();
      };
    }
  }, []);

  const loadWhatsAppStatus = async () => {
    if (!window.electronAPI) return;
    try {
      const res = await window.electronAPI.whatsapp.getStatus();
      setWaStatus(res.status);
      setQrCode(res.qrCode);
    } catch (e) {
      console.error(e);
    }
  };

  const loadSettings = async () => {
    if (!window.electronAPI) return;
    try {
      const res = await window.electronAPI.settings.getSettings();
      if (res) setSettings(res);
    } catch (e) {
      console.error(e);
    }
  };

  const loadStats = async () => {
    if (!window.electronAPI) return;
    try {
      const res = await window.electronAPI.leads.getStats();
      setStats(res);
    } catch (e) {
      console.error(e);
    }
  };

  const handleConnectWhatsApp = async () => {
    setLoadingQr(true);
    try {
      await window.electronAPI.whatsapp.connect();
      onShowToast('success', 'Gerando QR Code... Aponte o WhatsApp do aparelho.');
    } catch {
      onShowToast('error', 'Falha ao iniciar conexão com WhatsApp.');
      setLoadingQr(false);
    }
  };

  const handleDisconnectWhatsApp = async () => {
    try {
      await window.electronAPI.whatsapp.disconnect();
      setWaStatus('disconnected');
      setQrCode(null);
      onShowToast('success', 'WhatsApp desconectado.');
    } catch {
      onShowToast('error', 'Erro ao desconectar WhatsApp.');
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await window.electronAPI.settings.saveSettings(settings);
      onShowToast('success', 'Configurações de disparo salvas!');
    } catch {
      onShowToast('error', 'Erro ao salvar configurações.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleInsertTag = (tag: string) => {
    setSettings((prev) => ({
      ...prev,
      message_template: prev.message_template + ' ' + tag,
    }));
  };

  const handleStartCampaign = async () => {
    try {
      const res = await window.electronAPI.campaign.start();
      if (res.success) {
        onShowToast('success', res.message);
      } else {
        onShowToast('error', res.message);
      }
    } catch {
      onShowToast('error', 'Erro ao iniciar disparos.');
    }
  };

  const handlePauseCampaign = async () => {
    await window.electronAPI.campaign.pause();
    setCampaignProgress((prev) => ({ ...prev, isPaused: true }));
  };

  const handleResumeCampaign = async () => {
    await window.electronAPI.campaign.resume();
    setCampaignProgress((prev) => ({ ...prev, isPaused: false }));
  };

  const handleStopCampaign = async () => {
    await window.electronAPI.campaign.stop();
    setCampaignProgress((prev) => ({ ...prev, isRunning: false, isPaused: false }));
    onShowToast('error', 'Disparos cancelados.');
    loadStats();
  };

  return (
    <div className="space-y-6">
      {/* Cards de Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div 
          onClick={onNavigateToLeads}
          className="glass-card glass-card-hover rounded-2xl p-4 cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total de Leads</span>
            <Users className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-slate-100">{stats.total}</div>
          <p className="text-[11px] text-slate-400 mt-1">armazenados na base local</p>
        </div>

        <div 
          onClick={onNavigateToLeads}
          className="glass-card glass-card-hover rounded-2xl p-4 cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Pendentes</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400">{stats.pending}</div>
          <p className="text-[11px] text-slate-400 mt-1">prontos para envio</p>
        </div>

        <div 
          onClick={onNavigateToLeads}
          className="glass-card glass-card-hover rounded-2xl p-4 cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Enviados</span>
            <CheckCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">{stats.sent}</div>
          <p className="text-[11px] text-slate-400 mt-1">mensagens entregues</p>
        </div>

        <div 
          onClick={onNavigateToLeads}
          className="glass-card glass-card-hover rounded-2xl p-4 cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Falhas</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-400">{stats.failed}</div>
          <p className="text-[11px] text-slate-400 mt-1">números inválidos/erro</p>
        </div>
      </div>

      {/* Barra de Progresso de Disparos ao Vivo */}
      {campaignProgress.isRunning && (
        <div className="glass-card rounded-2xl p-5 border-emerald-500/40 bg-gradient-to-r from-emerald-950/30 to-slate-900 shadow-xl shadow-emerald-950/40">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 animate-pulse">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-100 text-sm md:text-base flex items-center gap-2">
                  Disparando Mensagens
                  {campaignProgress.isPaused && (
                    <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
                      Pausado
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-400">
                  {campaignProgress.currentLead
                    ? `Enviando agora para: ${campaignProgress.currentLead.name} (${campaignProgress.currentLead.phone})`
                    : campaignProgress.nextDelaySec > 0
                    ? `Aguardando delay humanizado: ${campaignProgress.nextDelaySec}s para o próximo...`
                    : 'Processando fila...'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {campaignProgress.isPaused ? (
                <button
                  onClick={handleResumeCampaign}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition"
                >
                  <Play className="w-3.5 h-3.5 fill-current" /> Retomar
                </button>
              ) : (
                <button
                  onClick={handlePauseCampaign}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
                >
                  <Pause className="w-3.5 h-3.5" /> Pausar
                </button>
              )}
              <button
                onClick={handleStopCampaign}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-900/60 hover:bg-rose-800 text-rose-200 text-xs font-semibold border border-rose-700/50 transition"
              >
                <Square className="w-3.5 h-3.5 fill-current" /> Interromper
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-400">
              <span>
                Progresso: {campaignProgress.processed} de {campaignProgress.total} leads
              </span>
              <span>
                {campaignProgress.total > 0
                  ? Math.round((campaignProgress.processed / campaignProgress.total) * 100)
                  : 0}
                %
              </span>
            </div>
            <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
              <div
                className="bg-gradient-to-r from-emerald-500 to-cyan-500 h-full transition-all duration-500"
                style={{
                  width: `${
                    campaignProgress.total > 0
                      ? (campaignProgress.processed / campaignProgress.total) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Grid Principal: WhatsApp & Configurações */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Conexão WhatsApp (4 colunas) */}
        <div className="lg:col-span-4 space-y-6">
          <section className="glass-card rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold flex items-center gap-2 text-slate-200">
                <QrCode className="w-5 h-5 text-emerald-400" />
                WhatsApp Nativo
              </h2>
              <button
                onClick={loadWhatsAppStatus}
                title="Atualizar Status"
                className="text-slate-500 hover:text-slate-300 transition p-1"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {waStatus === 'connected' ? (
              <div className="text-center py-6 bg-emerald-950/20 border border-emerald-900/50 rounded-xl space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                <div>
                  <p className="font-bold text-emerald-300 text-sm">WhatsApp Autenticado</p>
                  <p className="text-xs text-slate-400 mt-1 px-4">
                    Motor Baileys conectado localmente. Pronto para realizar disparos automáticos.
                  </p>
                </div>
                <button
                  onClick={handleDisconnectWhatsApp}
                  className="mt-2 text-xs text-rose-400 hover:text-rose-300 underline font-medium"
                >
                  Desconectar Sessão
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                {qrCode ? (
                  <div className="p-3 bg-white rounded-2xl shadow-2xl mb-4 border border-slate-300 animate-in fade-in zoom-in-95">
                    <img src={qrCode} alt="WhatsApp QR Code" className="w-48 h-48 object-contain" />
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400 text-xs px-2">
                    <p className="mb-2">Sem conexão ativa.</p>
                    <p>Clique abaixo para gerar o QR Code e escanear com seu celular.</p>
                  </div>
                )}

                <button
                  onClick={handleConnectWhatsApp}
                  disabled={loadingQr}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold py-2.5 rounded-xl border border-slate-700 transition active:scale-95 text-xs flex items-center justify-center gap-2"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingQr ? 'animate-spin' : ''}`} />
                  {loadingQr ? 'Gerando QR Code...' : qrCode ? 'Regerar QR Code' : 'Conectar WhatsApp'}
                </button>
              </div>
            )}
          </section>

          {/* Dicas Anti-Ban */}
          <section className="glass-card rounded-2xl p-5 border-purple-500/20">
            <h3 className="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              Proteção Anti-Bloqueio
            </h3>
            <ul className="text-[11px] text-slate-400 space-y-1.5 list-disc list-inside">
              <li>Mantenha o delay mínimo acima de 15 segundos.</li>
              <li>Alterne textos usando tags dinâmicas como &#123;nome_empresa&#125;.</li>
              <li>Use a simulação de "digitando..." ativada.</li>
              <li>Aqueça novos números antes de enviar grandes volumes.</li>
            </ul>
          </section>
        </div>

        {/* Mensagem e Parâmetros (8 colunas) */}
        <div className="lg:col-span-8 space-y-6">
          <section className="glass-card rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-100">Mensagem da Campanha</h2>
                <p className="text-xs text-slate-400">
                  Escreva a mensagem que será enviada para cada contato prospecionado.
                </p>
              </div>

              {/* Botão de Iniciar Disparos */}
              <button
                onClick={handleStartCampaign}
                disabled={campaignProgress.isRunning || waStatus !== 'connected' || stats.pending === 0}
                className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-950/60 transition active:scale-95 text-xs"
              >
                <Send className="w-4 h-4" />
                <span>{campaignProgress.isRunning ? 'Disparando...' : `Disparar para ${stats.pending} Leads`}</span>
              </button>
            </div>

            {/* Inserção de tags dinâmicas */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">Variáveis Dinâmicas:</label>
                <span className="text-[11px] text-slate-500">Clique para inserir na mensagem</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { tag: '{nome_empresa}', label: 'Nome da Empresa' },
                  { tag: '{ramo}', label: 'Ramo / Nicho' },
                  { tag: '{cidade}', label: 'Cidade' },
                  { tag: '{telefone}', label: 'Telefone' },
                ].map((item) => (
                  <button
                    key={item.tag}
                    type="button"
                    onClick={() => handleInsertTag(item.tag)}
                    className="text-xs bg-slate-900 hover:bg-slate-800 text-purple-300 border border-purple-500/30 px-2.5 py-1 rounded-lg transition"
                  >
                    + {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Textarea */}
            <div>
              <textarea
                rows={6}
                value={settings.message_template}
                onChange={(e) => setSettings({ ...settings, message_template: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs md:text-sm text-slate-200 focus:outline-none focus:border-purple-500 leading-relaxed placeholder:text-slate-600 font-sans"
                placeholder="Olá {nome_empresa}!..."
              />
            </div>

            {/* Delays Humanizados */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-800">
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-2">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-purple-400" /> Delay Mínimo:
                  </span>
                  <span className="font-bold text-slate-200">{settings.delay_min} segundos</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="60"
                  value={settings.delay_min}
                  onChange={(e) => setSettings({ ...settings, delay_min: Number(e.target.value) })}
                  className="w-full accent-purple-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-2">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-purple-400" /> Delay Máximo:
                  </span>
                  <span className="font-bold text-slate-200">{settings.delay_max} segundos</span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="180"
                  value={settings.delay_max}
                  onChange={(e) => setSettings({ ...settings, delay_max: Number(e.target.value) })}
                  className="w-full accent-purple-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Opções extras */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.typing_simulation}
                  onChange={(e) => setSettings({ ...settings, typing_simulation: e.target.checked })}
                  className="rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-0 w-4 h-4"
                />
                Simular status "Digitando..." no WhatsApp antes do envio
              </label>

              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl text-xs font-semibold border border-slate-700 transition"
              >
                {savingSettings ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
