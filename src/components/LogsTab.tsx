import React, { useState, useEffect } from 'react';
import { Terminal, Trash2, RefreshCw, AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';
import { AppLog } from '../types/electron';

interface LogsTabProps {
  onShowToast: (type: 'success' | 'error', message: string) => void;
}

export const LogsTab: React.FC<LogsTabProps> = ({ onShowToast }) => {
  const [logs, setLogs] = useState<AppLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    if (!window.electronAPI) return;
    setLoading(true);
    try {
      const data = await window.electronAPI.logs.getLogs();
      setLogs(data);
    } catch {
      onShowToast('error', 'Falha ao carregar logs.');
    } finally {
      setLoading(false);
    }
  };

  const handleClearLogs = async () => {
    try {
      await window.electronAPI.logs.clearLogs();
      setLogs([]);
      onShowToast('success', 'Logs limpos com sucesso.');
    } catch {
      onShowToast('error', 'Erro ao limpar logs.');
    }
  };

  const getLogIcon = (type: AppLog['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      case 'error':
        return <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      default:
        return <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />;
    }
  };

  return (
    <div className="space-y-6">
      <section className="glass-card rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Terminal className="w-5 h-5 text-emerald-400" />
              Console de Atividades & Auditoria
            </h2>
            <p className="text-xs text-slate-400">
              Acompanhe o log detalhado das conexões, disparos e eventos locais da aplicação.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadLogs}
              title="Atualizar Logs"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleClearLogs}
              disabled={logs.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Limpar</span>
            </button>
          </div>
        </div>

        {/* Janela de Terminal */}
        <div className="bg-slate-950 rounded-xl p-4 border border-slate-800/80 font-mono text-xs max-h-[520px] overflow-y-auto space-y-2">
          {logs.length === 0 ? (
            <div className="text-slate-600 text-center py-10">
              Nenhum registro de atividade registrado ainda.
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-2.5 py-1 px-2 rounded hover:bg-slate-900/60 transition"
              >
                <span className="text-slate-500 text-[11px] select-none">[{log.timestamp}]</span>
                <span className="mt-0.5">{getLogIcon(log.type)}</span>
                <span
                  className={`text-[12px] leading-relaxed ${
                    log.type === 'error'
                      ? 'text-rose-300 font-semibold'
                      : log.type === 'success'
                      ? 'text-emerald-300'
                      : log.type === 'warning'
                      ? 'text-amber-300'
                      : 'text-slate-300'
                  }`}
                >
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
};
