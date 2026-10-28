import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Zap,
  LayoutDashboard,
  Search,
  Users,
  Terminal,
  CheckCircle2,
  AlertCircle,
  Info,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { DashboardTab } from './components/DashboardTab';
import { ProspectorTab } from './components/ProspectorTab';
import { LeadsTab } from './components/LeadsTab';
import { LogsTab } from './components/LogsTab';
import type { ShowToast, ToastType } from './components/toast';
import type { WhatsAppStatus } from './types/electron';

type TabId = 'dashboard' | 'prospector' | 'leads' | 'logs';

const TOAST_DURATION_MS = 4500;

const TOAST_STYLES: Record<ToastType, string> = {
  success: 'bg-emerald-950/95 border-emerald-500/60 text-emerald-200',
  error: 'bg-rose-950/95 border-rose-500/60 text-rose-200',
  info: 'bg-cyan-950/95 border-cyan-500/60 text-cyan-200',
};

const NAV_ITEMS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Painel & Disparos', icon: LayoutDashboard },
  { id: 'prospector', label: 'Buscar Empresas', icon: Search },
  { id: 'leads', label: 'Base de Leads', icon: Users },
  { id: 'logs', label: 'Logs & Atividade', icon: Terminal },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [notification, setNotification] = useState<{ type: ToastType; message: string } | null>(null);
  const [waStatus, setWaStatus] = useState<WhatsAppStatus>('disconnected');
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.whatsapp.getStatus().then((res) => setWaStatus(res.status)).catch(console.error);
      window.electronAPI.app.getInfo().then((info) => setAppVersion(info.version)).catch(console.error);
      const unsub = window.electronAPI.whatsapp.onStatusChange((data) => setWaStatus(data.status));
      return () => unsub();
    }
  }, []);

  // Limpa o timer pendente ao desmontar
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Identidade estável (as abas usam em useCallback) e timer único: um toast novo cancela o anterior
  const showToast = useCallback<ShowToast>((type, message) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setNotification({ type, message });
    toastTimerRef.current = setTimeout(() => {
      setNotification(null);
      toastTimerRef.current = null;
    }, TOAST_DURATION_MS);
  }, []);

  const ToastIcon = notification?.type === 'success' ? CheckCircle2 : notification?.type === 'info' ? Info : AlertCircle;
  const toastIconColor =
    notification?.type === 'success' ? 'text-emerald-400' : notification?.type === 'info' ? 'text-cyan-400' : 'text-rose-400';

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed bottom-6 right-6 px-5 py-3.5 rounded-2xl border flex items-center gap-3 shadow-2xl z-50 transition-all animate-in fade-in slide-in-from-bottom-5 ${
            TOAST_STYLES[notification.type]
          }`}
        >
          <ToastIcon className={`w-5 h-5 shrink-0 ${toastIconColor}`} />
          <span className="text-xs md:text-sm font-semibold">{notification.message}</span>
        </div>
      )}

      {/* Sidebar Lateral */}
      <aside className="w-64 bg-slate-950/90 border-r border-slate-800/80 flex flex-col justify-between p-4 shrink-0 select-none">
        <div>
          {/* Logo Brand */}
          <div className="flex items-center gap-3 px-2 py-3 mb-6">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 text-slate-950 shadow-lg shadow-emerald-500/20">
              <Zap className="w-6 h-6 fill-current" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                AutoSale
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                Desktop{appVersion ? ` v${appVersion}` : ''}
              </span>
            </div>
          </div>

          {/* Navegação de Abas */}
          <nav className="space-y-1.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-950/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Rodapé da Sidebar: Status do WhatsApp & Dados Locais */}
        <div className="space-y-3 pt-4 border-t border-slate-800/80">
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-400 font-medium">WhatsApp Motor:</span>
              <div className="flex items-center gap-1.5">
                {waStatus === 'connected' ? (
                  <>
                    <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[11px] font-bold text-emerald-400">Online</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                    <span className="text-[11px] font-bold text-rose-400">Desconectado</span>
                  </>
                )}
              </div>
            </div>

            <div className="text-[10px] text-slate-400 border-t border-slate-800/60 pt-2 flex items-center justify-between">
              <span>Armazenamento:</span>
              <span className="font-semibold text-cyan-400">Dados locais</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Conteúdo Principal com Scroll Próprio */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-14 border-b border-slate-800/80 bg-slate-950/60 px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-200">
              {NAV_ITEMS.find((n) => n.id === activeTab)?.label}
            </h2>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-xl">
              <span
                className={`w-2 h-2 rounded-full ${
                  waStatus === 'connected'
                    ? 'bg-emerald-500 animate-pulse'
                    : waStatus === 'connecting'
                    ? 'bg-amber-500 animate-ping'
                    : 'bg-rose-500'
                }`}
              />
              <span className="font-semibold text-slate-300">
                {waStatus === 'connected'
                  ? 'Pronto para Disparar'
                  : waStatus === 'connecting'
                  ? 'Conectando WhatsApp...'
                  : 'WhatsApp Offline'}
              </span>
            </div>
          </div>
        </header>

        {/* Tab View Container */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-6xl mx-auto">
            {activeTab === 'dashboard' && (
              <DashboardTab
                onShowToast={showToast}
                onNavigateToLeads={() => setActiveTab('leads')}
              />
            )}
            {activeTab === 'prospector' && (
              <ProspectorTab
                onShowToast={showToast}
                onLeadsAdded={() => setActiveTab('leads')}
              />
            )}
            {activeTab === 'leads' && <LeadsTab onShowToast={showToast} />}
            {activeTab === 'logs' && <LogsTab onShowToast={showToast} />}
          </div>
        </main>
      </div>
    </div>
  );
}
