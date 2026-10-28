import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  Download,
  Upload,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building2,
  Phone,
  RefreshCw,
  Pencil,
  X,
  Save,
  RotateCcw,
  Globe,
} from 'lucide-react';
import { Lead, LeadStatus, EditableLeadFields } from '../types/electron';
import type { ShowToast } from './toast';
import { describeLeadsAdded } from './formatters';
import { useConfirm } from './ConfirmDialog';

interface LeadsTabProps {
  onShowToast: ShowToast;
}

const STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: 'pending', label: 'Pendente' },
  { value: 'sent', label: 'Enviado' },
  { value: 'failed', label: 'Falhou' },
  { value: 'replied', label: 'Respondeu' },
];

const STATUS_FILTERS: { id: LeadStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'pending', label: 'Pendentes' },
  { id: 'sent', label: 'Enviados' },
  { id: 'failed', label: 'Falhas' },
  { id: 'replied', label: 'Responderam' },
];

// Rótulo usado na confirmação de "Limpar Leads" por status
const STATUS_LABELS: Record<LeadStatus, string> = {
  pending: 'Pendente',
  processing: 'Enviando',
  sent: 'Enviado',
  failed: 'Falhou',
  replied: 'Respondeu',
};

function StatusBadge({ status }: { status: Lead['status'] }) {
  switch (status) {
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-950/60 text-amber-300 border border-amber-800/60">
          <Clock className="w-3 h-3" /> Pendente
        </span>
      );
    case 'processing':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-cyan-950/60 text-cyan-300 border border-cyan-800/60 animate-pulse">
          <RefreshCw className="w-3 h-3 animate-spin" /> Enviando...
        </span>
      );
    case 'sent':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
          <CheckCircle2 className="w-3 h-3" /> Enviado
        </span>
      );
    case 'failed':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-950/60 text-rose-300 border border-rose-800/60">
          <AlertCircle className="w-3 h-3" /> Falhou
        </span>
      );
    case 'replied':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-violet-950/60 text-violet-300 border border-violet-800/60">
          <CheckCircle2 className="w-3 h-3" /> Respondeu
        </span>
      );
    default:
      return (
        <span className="px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-300">
          {status}
        </span>
      );
  }
}

// ─── Modal de edição ────────────────────────────────────────────────────────
interface EditModalProps {
  lead: Lead;
  onSave: (updated: EditableLeadFields) => Promise<void>;
  onClose: () => void;
}

function EditModal({ lead, onSave, onClose }: EditModalProps) {
  const [form, setForm] = useState({
    name: lead.name,
    phone: lead.phone,
    business_type: lead.business_type || '',
    city: lead.city || '',
    address: lead.address || '',
    website: lead.website || '',
    status: lead.status,
  });
  const [saving, setSaving] = useState(false);

  const handleChange = <K extends keyof typeof form>(field: K, value: (typeof form)[K]) => {
    setForm((p) => ({ ...p, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        name: form.name.trim(),
        phone: form.phone.trim().replace(/\D/g, ''),
        business_type: form.business_type.trim(),
        city: form.city.trim(),
        address: form.address.trim(),
        website: form.website.trim(),
        status: form.status,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Pencil className="w-4 h-4 text-purple-400" />
            Editar Lead
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Nome da Empresa</label>
              <input
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Telefone (somente dígitos)</label>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                <input
                  value={form.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-xs font-mono text-emerald-400 focus:outline-none focus:border-purple-500"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Ramo / Nicho</label>
              <input
                value={form.business_type}
                onChange={(e) => handleChange('business_type', e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Cidade</label>
              <input
                value={form.city}
                onChange={(e) => handleChange('city', e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Endereço</label>
              <input
                value={form.address}
                onChange={(e) => handleChange('address', e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Site</label>
              <div className="relative">
                <Globe className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                <input
                  value={form.website}
                  onChange={(e) => handleChange('website', e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-xs text-cyan-300 focus:outline-none focus:border-purple-500 placeholder:text-slate-600"
                />
              </div>
            </div>

            {/* Status selector */}
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Status</label>
              <div className="flex gap-2 flex-wrap">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleChange('status', opt.value)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition ${
                      form.status === opt.value
                        ? 'bg-purple-600 text-white border-purple-500'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Motivo da falha registrado no envio (somente leitura: o contrato não permite editá-lo) */}
            {form.status === 'failed' && lead.error_message && (
              <div className="col-span-2">
                <label className="block text-xs text-rose-400 mb-1">Motivo do erro</label>
                <p className="w-full bg-slate-950 border border-rose-800/50 rounded-xl px-3 py-2 text-xs text-rose-300">
                  {lead.error_message}
                </p>
              </div>
            )}
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Tab principal ───────────────────────────────────────────────────────────
export const LeadsTab: React.FC<LeadsTabProps> = ({ onShowToast }) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all');
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();

  const loadLeads = useCallback(async () => {
    if (!window.electronAPI) return;
    setLoading(true);
    try {
      const data = await window.electronAPI.leads.getLeads({ status: statusFilter, search });
      setLeads(data);
    } catch {
      onShowToast('error', 'Falha ao carregar lista de leads.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, onShowToast]);

  useEffect(() => {
    loadLeads();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadLeads();
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Remover lead',
      message: 'Deseja realmente remover este lead? Esta ação não pode ser desfeita.',
      confirmLabel: 'Remover',
    });
    if (!confirmed) return;
    try {
      await window.electronAPI.leads.deleteLead(id);
      onShowToast('success', 'Lead removido com sucesso.');
      loadLeads();
    } catch {
      onShowToast('error', 'Erro ao deletar lead.');
    }
  };

  const handleResetFailed = async () => {
    // A redefinição vale para todos os leads com falha da base, não só para os exibidos na tela
    const confirmed = await confirm({
      title: 'Reenviar falhas',
      message: 'Todos os leads com falha voltarão para "Pendente" e entrarão na fila do próximo disparo. Deseja continuar?',
      confirmLabel: 'Redefinir',
      variant: 'warning',
    });
    if (!confirmed) return;
    try {
      const { count } = await window.electronAPI.leads.resetFailed();
      if (count === 0) {
        onShowToast('info', 'Nenhum lead com falha para redefinir.');
      } else {
        onShowToast('success', `${count} lead(s) redefinidos para pendente!`);
      }
      loadLeads();
    } catch {
      onShowToast('error', 'Erro ao redefinir leads.');
    }
  };

  const handleSaveEdit = async (updated: EditableLeadFields) => {
    if (!editingLead) return;
    try {
      await window.electronAPI.leads.updateLead(editingLead.id, updated);
      onShowToast('success', 'Lead atualizado com sucesso!');
      setEditingLead(null);
      loadLeads();
    } catch {
      onShowToast('error', 'Erro ao salvar alterações.');
    }
  };

  const handleClearAll = async () => {
    const message =
      statusFilter === 'all'
        ? 'Deseja excluir TODOS os leads da base de dados local? Esta ação não pode ser desfeita.'
        : `Deseja excluir todos os leads com status "${STATUS_LABELS[statusFilter]}"? Esta ação não pode ser desfeita.`;
    const confirmed = await confirm({ title: 'Limpar leads', message, confirmLabel: 'Excluir' });
    if (!confirmed) return;
    try {
      await window.electronAPI.leads.clearLeads(statusFilter);
      onShowToast('success', 'Base de leads limpa com sucesso.');
      loadLeads();
    } catch {
      onShowToast('error', 'Erro ao limpar leads.');
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const res = await window.electronAPI.leads.exportExcel();
      if (res.success) {
        onShowToast('success', `Exportados ${res.count} leads para planilha Excel!`);
      } else if (!res.canceled) {
        onShowToast('error', res.error || 'Erro ao exportar planilha.');
      }
    } catch {
      onShowToast('error', 'Falha ao exportar.');
    } finally {
      setExporting(false);
    }
  };

  const handleImportFile = async () => {
    setImporting(true);
    try {
      const res = await window.electronAPI.leads.importFile();
      if (res.success) {
        onShowToast(
          'success',
          describeLeadsAdded(res.added ?? 0, res.duplicates ?? 0, res.invalid ?? 0, 'leads importados')
        );
        loadLeads();
      } else if (!res.canceled) {
        onShowToast('error', res.error || 'Erro ao importar planilha.');
      }
    } catch {
      onShowToast('error', 'Falha ao importar arquivo.');
    } finally {
      setImporting(false);
    }
  };

  const failedCount = leads.filter((l) => l.status === 'failed').length;

  return (
    <>
      {confirmDialog}

      {/* Modal de edição */}
      {editingLead && (
        <EditModal
          lead={editingLead}
          onSave={handleSaveEdit}
          onClose={() => setEditingLead(null)}
        />
      )}

      <div className="space-y-6">
        {/* Header com Ações */}
        <section className="glass-card rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-400" />
                Base de Leads &amp; Histórico
              </h2>
              <p className="text-xs text-slate-400">
                Gerencie seus contatos armazenados localmente no seu computador.
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                onClick={handleImportFile}
                disabled={importing}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition active:scale-95"
              >
                <Upload className="w-3.5 h-3.5 text-cyan-400" />
                <span>Importar Excel / CSV</span>
              </button>

              <button
                onClick={handleExportExcel}
                disabled={exporting || leads.length === 0}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-900/40 hover:bg-emerald-800/60 text-emerald-200 border border-emerald-700/50 text-xs font-semibold transition active:scale-95 disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Exportar Excel</span>
              </button>

              {failedCount > 0 && (
                <button
                  onClick={handleResetFailed}
                  title={`Redefinir ${failedCount} falha(s) para pendente`}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border border-amber-800/50 text-xs font-semibold transition active:scale-95"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Reenviar Falhas ({failedCount})</span>
                </button>
              )}

              <button
                onClick={handleClearAll}
                disabled={leads.length === 0}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 text-xs font-semibold transition active:scale-95 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Limpar Leads</span>
              </button>
            </div>
          </div>

          {/* Filtros */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-800">
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              {STATUS_FILTERS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg transition font-medium ${
                    statusFilter === tab.id
                      ? 'bg-purple-600 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, telefone..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500 placeholder:text-slate-600"
              />
            </form>
          </div>
        </section>

        {/* Tabela */}
        <section className="glass-card rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/90 text-slate-400 font-semibold sticky top-0 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Empresa</th>
                  <th className="py-3 px-4">Telefone</th>
                  <th className="py-3 px-4">Ramo</th>
                  <th className="py-3 px-4">Cidade</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-500">
                      Carregando contatos...
                    </td>
                  </tr>
                ) : leads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-500">
                      <p className="text-sm font-medium">Nenhum lead encontrado.</p>
                      <p className="text-xs text-slate-600 mt-1">
                        Use a aba "Buscar Empresas" ou importe uma planilha para começar.
                      </p>
                    </td>
                  </tr>
                ) : (
                  leads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-slate-900/30 transition group">
                      <td className="py-3 px-4 font-semibold text-slate-100">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>{lead.name}</span>
                        </div>
                        {lead.website && (
                          <div
                            className="flex items-center gap-1.5 mt-0.5 ml-5 text-[10px] font-normal text-slate-500 max-w-[220px]"
                            title={lead.website}
                          >
                            <Globe className="w-3 h-3 shrink-0" />
                            <span className="truncate">{lead.website}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-emerald-400">{lead.phone}</td>
                      <td className="py-3 px-4 text-slate-400">
                        <span className="bg-slate-900 px-2 py-0.5 rounded text-[11px] border border-slate-800">
                          {lead.business_type || 'Geral'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">{lead.city || '-'}</td>
                      <td className="py-3 px-4">
                        <StatusBadge status={lead.status} />
                        {lead.error_message && (
                          <p
                            className="text-[10px] text-rose-400 mt-0.5 truncate max-w-[200px] cursor-help"
                            title={lead.error_message}
                          >
                            {lead.error_message}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition">
                          <button
                            onClick={() => setEditingLead(lead)}
                            className="text-slate-500 hover:text-purple-400 transition p-1.5 rounded-lg hover:bg-purple-950/40"
                            title="Editar lead"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(lead.id)}
                            className="text-slate-500 hover:text-rose-400 transition p-1.5 rounded-lg hover:bg-rose-950/40"
                            title="Excluir lead"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {leads.length > 0 && (
            <div className="px-4 py-2.5 border-t border-slate-800 text-[11px] text-slate-500 flex justify-between">
              <span>{leads.length} lead(s) exibidos</span>
              <span>Clique no ícone ✏️ para editar</span>
            </div>
          )}
        </section>
      </div>
    </>
  );
};
