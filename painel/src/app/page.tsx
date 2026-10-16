'use client';

import React, { useState, useEffect } from 'react';
import { 
  QrCode, CheckCircle2, XCircle, RefreshCw, Send, 
  Upload, Users, AlertCircle, MessageSquare, Clock, Zap
} from 'lucide-react';

interface Lead {
  id: string;
  name: string;
  phone: string;
  instagram: string | null;
  business_type: string;
  source: string;
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'replied';
  created_at: string;
}

export default function Dashboard() {
  const [status, setStatus] = useState<'open' | 'close' | 'connecting'>('close');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);
  
  const [template, setTemplate] = useState('');
  const [delayMin, setDelayMin] = useState(15);
  const [delayMax, setDelayMax] = useState(40);
  const [savingSettings, setSavingSettings] = useState(false);

  const [leadsJson, setLeadsJson] = useState('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    fetchStatus();
    fetchSettings();
    fetchLeads();

    const interval = setInterval(() => {
      fetchStatus();
      fetchLeads();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/whatsapp/status');
      const data = await res.json();
      setStatus(data.status || 'close');
      if (data.status === 'open') {
        setQrCode(null);
      }
    } catch {
      setStatus('close');
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.settings) {
        setTemplate(data.settings.message_template || '');
        setDelayMin(data.settings.delay_min || 15);
        setDelayMax(data.settings.delay_max || 40);
      }
    } catch (e) {
      console.error('Erro ao buscar configurações:', e);
    }
  };

  const fetchLeads = async () => {
    try {
      const res = await fetch('/api/leads');
      const data = await res.json();
      if (data.leads) {
        setLeads(data.leads);
      }
    } catch (e) {
      console.error('Erro ao buscar leads:', e);
    }
  };

  const handleConnect = async () => {
    setLoadingQr(true);
    try {
      const res = await fetch('/api/whatsapp/connect', { method: 'POST' });
      const data = await res.json();
      if (data.qrcode) {
        setQrCode(data.qrcode);
        showToast('success', 'QR Code gerado! Aponte o WhatsApp do aparelho.');
      } else {
        showToast('error', 'Não foi possível obter o QR Code. Verifique se a instância já está aberta.');
      }
    } catch {
      showToast('error', 'Falha na requisição de conexão com WhatsApp.');
    } finally {
      setLoadingQr(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delay_min: delayMin,
          delay_max: delayMax,
          message_template: template,
        }),
      });
      if (res.ok) {
        showToast('success', 'Configurações de disparo salvas com sucesso!');
      } else {
        showToast('error', 'Erro ao salvar configurações.');
      }
    } catch {
      showToast('error', 'Falha ao salvar configurações.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleImportLeads = async () => {
    if (!leadsJson.trim()) return;
    setImporting(true);
    try {
      const parsed = JSON.parse(leadsJson);
      const res = await fetch('/api/leads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      if (res.ok) {
        showToast('success', `${data.count} leads importados para a base!`);
        setLeadsJson('');
        fetchLeads();
      } else {
        showToast('error', data.error || 'Erro ao importar leads.');
      }
    } catch {
      showToast('error', 'Formato JSON inválido. Verifique a sintaxe.');
    } finally {
      setImporting(false);
    }
  };

  const handleStartProspect = async () => {
    setDispatching(true);
    try {
      const res = await fetch('/api/prospect/start', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        showToast('success', data.message || 'Disparos iniciados!');
        fetchLeads();
      } else {
        showToast('error', data.error || 'Erro ao iniciar disparos.');
      }
    } catch {
      showToast('error', 'Erro ao comunicar com o servidor para disparos.');
    } finally {
      setDispatching(false);
    }
  };

  const showToast = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4500);
  };

  const pendingCount = leads.filter(l => l.status === 'pending').length;
  const processingCount = leads.filter(l => l.status === 'processing').length;
  const sentCount = leads.filter(l => l.status === 'sent').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans selection:bg-emerald-500 selection:text-black">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed bottom-6 right-6 px-5 py-3 rounded-xl border flex items-center gap-3 shadow-2xl z-50 transition-all ${
          notification.type === 'success' 
            ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200' 
            : 'bg-rose-950/90 border-rose-500/50 text-rose-200'
        }`}>
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      {/* Header */}
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-800/80 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 text-slate-950 shadow-lg shadow-emerald-500/20">
              <Zap className="w-6 h-6 fill-current" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                AutoSale Prospect
              </h1>
              <p className="text-slate-400 text-xs md:text-sm">Sistema Automatizado de Prospecção de Landing Pages via WhatsApp</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl shadow-inner">
            <span className={`w-2.5 h-2.5 rounded-full ${status === 'open' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            <span className="text-xs uppercase font-bold tracking-wider text-slate-300">
              {status === 'open' ? 'WhatsApp Online' : status === 'connecting' ? 'Conectando...' : 'WhatsApp Offline'}
            </span>
          </div>

          <button 
            onClick={handleStartProspect} 
            disabled={dispatching || status !== 'open' || (pendingCount === 0 && processingCount === 0)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-950/60 transition-all active:scale-95"
          >
            <Send className="w-4 h-4" />
            <span>{dispatching ? 'Disparando...' : `Iniciar Disparos (${pendingCount} pendentes)`}</span>
          </button>
        </div>
      </header>

      {/* Grid Principal */}
      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        
        {/* Coluna 1: WhatsApp & Importador */}
        <div className="space-y-6">
          {/* Card WhatsApp */}
          <section className="bg-slate-900/60 border border-slate-800/90 rounded-2xl p-5 backdrop-blur shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold flex items-center gap-2 text-slate-200">
                <QrCode className="w-5 h-5 text-emerald-400" />
                Conexão WhatsApp
              </h2>
              <button onClick={fetchStatus} title="Atualizar status" className="text-slate-500 hover:text-slate-300 transition-colors p-1">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {status === 'open' ? (
              <div className="text-center py-6 bg-emerald-950/20 border border-emerald-900/50 rounded-xl">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-2" />
                <p className="font-semibold text-emerald-300 text-sm">Instância Conectada</p>
                <p className="text-xs text-slate-400 mt-1">Sua conta de WhatsApp está autenticada na Evolution API.</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                {qrCode ? (
                  <div className="p-3 bg-white rounded-xl shadow-xl mb-4 border border-slate-300">
                    <img src={qrCode} alt="WhatsApp QR Code" className="w-48 h-48 object-contain" />
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-400 text-xs">
                    Instância desconectada. Clique no botão abaixo para gerar o QR Code de autenticação.
                  </div>
                )}
                <button
                  onClick={handleConnect}
                  disabled={loadingQr}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-2.5 rounded-xl border border-slate-700 transition active:scale-95 text-sm"
                >
                  {loadingQr ? 'Gerando QR...' : qrCode ? 'Regerar QR Code' : 'Conectar WhatsApp'}
                </button>
              </div>
            )}
          </section>

          {/* Card Importação */}
          <section className="bg-slate-900/60 border border-slate-800/90 rounded-2xl p-5 backdrop-blur shadow-sm">
            <h2 className="text-base font-semibold flex items-center gap-2 text-slate-200 mb-3">
              <Upload className="w-5 h-5 text-cyan-400" />
              Importar Leads (JSON)
            </h2>
            <p className="text-xs text-slate-400 mb-3">
              Cole o JSON extraído dos scrapers (Google Maps, Instagram ou Apify):
            </p>
            <textarea
              rows={4}
              value={leadsJson}
              onChange={(e) => setLeadsJson(e.target.value)}
              placeholder='[{"name": "Studio Beleza", "phone": "11999999999", "instagram": "@studio", "business_type": "Estética"}]'
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-300 focus:outline-none focus:border-cyan-500 placeholder:text-slate-600"
            />
            <button
              onClick={handleImportLeads}
              disabled={importing || !leadsJson.trim()}
              className="w-full mt-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-medium py-2 rounded-xl transition text-sm active:scale-95"
            >
              {importing ? 'Importando Leads...' : 'Salvar Leads no Supabase'}
            </button>
          </section>
        </div>

        {/* Coluna 2: Configuração de Mensagem & Anti-Ban */}
        <div className="space-y-6">
          <section className="bg-slate-900/60 border border-slate-800/90 rounded-2xl p-5 backdrop-blur shadow-sm">
            <h2 className="text-base font-semibold flex items-center gap-2 text-slate-200 mb-2">
              <MessageSquare className="w-5 h-5 text-purple-400" />
              Template de Mensagem
            </h2>
            
            <p className="text-xs text-slate-400 mb-2">
              Substituição dinâmica com a tag <code className="bg-slate-800 text-purple-300 px-1.5 py-0.5 rounded text-[11px]">&#123;nome_empresa&#125;</code>:
            </p>
            <textarea
              rows={6}
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-purple-500 leading-relaxed placeholder:text-slate-600"
              placeholder="Olá {nome_empresa}! Vi seu perfil e notei que você ainda não tem uma Landing Page..."
            />

            <div className="mt-5 space-y-4 pt-4 border-t border-slate-800/60">
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                  <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-purple-400" /> Delay Mínimo:</span>
                  <span className="font-semibold text-slate-200">{delayMin} segundos</span>
                </div>
                <input 
                  type="range" min="5" max="60" value={delayMin} 
                  onChange={(e) => setDelayMin(Number(e.target.value))} 
                  className="w-full accent-purple-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                  <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-purple-400" /> Delay Máximo:</span>
                  <span className="font-semibold text-slate-200">{delayMax} segundos</span>
                </div>
                <input 
                  type="range" min="15" max="180" value={delayMax} 
                  onChange={(e) => setDelayMax(Number(e.target.value))} 
                  className="w-full accent-purple-500 cursor-pointer"
                />
              </div>
            </div>

            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="w-full mt-6 bg-slate-800 hover:bg-slate-700 text-white font-medium py-2 rounded-xl border border-slate-700 transition text-sm active:scale-95"
            >
              {savingSettings ? 'Salvando...' : 'Salvar Parâmetros'}
            </button>
          </section>
        </div>

        {/* Coluna 3: Tabela de Leads */}
        <div className="lg:col-span-1 space-y-6">
          <section className="bg-slate-900/60 border border-slate-800/90 rounded-2xl p-5 backdrop-blur flex flex-col h-[580px] shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold flex items-center gap-2 text-slate-200">
                <Users className="w-5 h-5 text-amber-400" />
                Leads ({leads.length})
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full">
                  {sentCount} enviados
                </span>
                <button onClick={fetchLeads} title="Atualizar Leads" className="text-slate-500 hover:text-slate-300 transition-colors p-1">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-2 divide-y divide-slate-800/40">
              {leads.length === 0 ? (
                <div className="text-center py-24 text-slate-500 text-xs">
                  Nenhum lead importado no Supabase.
                </div>
              ) : (
                leads.map((lead) => (
                  <div key={lead.id} className="pt-2 pb-1 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-200 truncate">{lead.name}</p>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">+{lead.phone}</p>
                      {lead.instagram && (
                        <p className="text-[11px] text-purple-400 truncate mt-0.5">{lead.instagram}</p>
                      )}
                    </div>
                    <div className="shrink-0">
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border ${
                        lead.status === 'sent' 
                          ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/50'
                          : lead.status === 'processing'
                          ? 'bg-blue-950/40 text-blue-400 border-blue-800/50 animate-pulse'
                          : lead.status === 'failed'
                          ? 'bg-rose-950/40 text-rose-400 border-rose-800/50'
                          : 'bg-amber-950/40 text-amber-400 border-amber-800/50'
                      }`}>
                        {lead.status === 'sent' ? 'Enviado' : lead.status === 'processing' ? 'Enviando...' : lead.status === 'failed' ? 'Falhou' : 'Pendente'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

      </main>
    </div>
  );
}
