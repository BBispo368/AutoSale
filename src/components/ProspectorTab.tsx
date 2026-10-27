import React, { useState, useEffect } from 'react';
import {
  Search,
  Building2,
  MapPin,
  Phone,
  CheckCircle,
  Plus,
  Loader2,
  Filter,
  CheckSquare,
  Square,
  Sparkles,
} from 'lucide-react';

interface ProspectorTabProps {
  onShowToast: (type: 'success' | 'error', message: string) => void;
  onLeadsAdded: () => void;
}

export const ProspectorTab: React.FC<ProspectorTabProps> = ({ onShowToast, onLeadsAdded }) => {
  const [niche, setNiche] = useState('Matriz de Bordados');
  const [city, setCity] = useState('São Paulo');
  const [state, setState] = useState('SP');
  const [limit, setLimit] = useState(20);

  const [isSearching, setIsSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState<{ found: number; currentName: string }>({
    found: 0,
    currentName: '',
  });

  const [foundLeads, setFoundLeads] = useState<any[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (window.electronAPI) {
      const unsub = window.electronAPI.scraper.onProgress((data) => {
        setSearchProgress(data);
      });
      return () => unsub();
    }
  }, []);

  const popularNiches = [
    'Matriz de Bordados',
    'Bordados Computadorizados',
    'Confecção de Roupas',
    'Ateliê de Costura',
    'Pizzaria',
    'Hamburgueria',
    'Dentista',
    'Academia',
    'Barbearia',
    'Oficina Mecânica',
    'Pet Shop',
    'Imobiliária',
  ];

  const brazilianStates = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
    'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
    'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
  ];

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!niche.trim() || !city.trim()) {
      onShowToast('error', 'Preencha o ramo de atividade e a cidade.');
      return;
    }

    setIsSearching(true);
    setSearchProgress({ found: 0, currentName: 'Iniciando varredura local...' });
    setFoundLeads([]);
    setSelectedIndices(new Set());

    try {
      const results = await window.electronAPI.scraper.searchLeads({
        niche: niche.trim(),
        city: city.trim(),
        state,
        limit,
      });

      setFoundLeads(results);
      // Seleciona todos por padrão
      setSelectedIndices(new Set(results.map((_, i) => i)));

      if (results.length > 0) {
        onShowToast('success', `${results.length} empresas encontradas com telefone!`);
      } else {
        onShowToast('error', 'Nenhuma empresa encontrada com telefone para estes critérios.');
      }
    } catch (err: any) {
      onShowToast('error', 'Falha na pesquisa de empresas.');
    } finally {
      setIsSearching(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIndices.size === foundLeads.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(foundLeads.map((_, i) => i)));
    }
  };

  const toggleSelect = (index: number) => {
    const next = new Set(selectedIndices);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setSelectedIndices(next);
  };

  const handleSaveToDatabase = async () => {
    if (selectedIndices.size === 0) {
      onShowToast('error', 'Selecione ao menos uma empresa para salvar.');
      return;
    }

    setIsSaving(true);
    try {
      const toSave = Array.from(selectedIndices).map((idx) => foundLeads[idx]);
      const res = await window.electronAPI.leads.addLeads(toSave);

      onShowToast(
        'success',
        `${res.added} novos leads salvos! (${res.duplicates} duplicados ignorados)`
      );
      onLeadsAdded();

      // Remove os salvos da lista ou limpa
      setFoundLeads([]);
      setSelectedIndices(new Set());
    } catch {
      onShowToast('error', 'Erro ao salvar leads na base local.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Formulário de Busca com Filtros */}
      <section className="glass-card rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-800 gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Search className="w-5 h-5 text-cyan-400" />
              Pesquisador de Empresas por Nicho & Região
            </h2>
            <p className="text-xs text-slate-400">
              Localize estabelecimentos comerciais e contatos de WhatsApp de qualquer ramo no Brasil.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs bg-cyan-950/40 text-cyan-300 border border-cyan-800/50 px-3 py-1 rounded-full flex items-center gap-1.5 font-medium">
              <Sparkles className="w-3.5 h-3.5" /> Busca 100% Local
            </span>
          </div>
        </div>

        <form onSubmit={handleSearch} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Ramo / Nicho */}
            <div className="md:col-span-5 space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-cyan-400" /> Ramo de Atividade / Nicho:
              </label>
              <input
                type="text"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="Ex: Clínicas Odontológicas, Pizzarias, etc."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 placeholder:text-slate-600 font-medium"
                required
              />
            </div>

            {/* Cidade */}
            <div className="md:col-span-4 space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-cyan-400" /> Cidade:
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Ex: Campinas, Ribeirão Preto..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 placeholder:text-slate-600 font-medium"
                required
              />
            </div>

            {/* Estado UF */}
            <div className="md:col-span-1 space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">UF:</label>
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-medium"
              >
                {brazilianStates.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </div>

            {/* Quantidade Meta */}
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Quantidade:</label>
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-medium"
              >
                <option value={20}>20 contatos</option>
                <option value={50}>50 contatos</option>
                <option value={100}>100 contatos</option>
              </select>
            </div>
          </div>

          {/* Sugestões de Nicho em Tags Rápidas */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
              <Filter className="w-3 h-3" /> Sugestões:
            </span>
            {popularNiches.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setNiche(item)}
                className={`text-[11px] px-2.5 py-0.5 rounded-lg border transition ${
                  niche === item
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-semibold'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          {/* Botão de Busca */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSearching}
              className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl shadow-lg shadow-cyan-950/60 transition active:scale-95 text-xs"
            >
              {isSearching ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Buscando empresas...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Iniciar Pesquisa</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Status de Varredura em Tempo Real */}
        {isSearching && (
          <div className="p-4 bg-slate-950/80 border border-cyan-500/30 rounded-xl flex items-center gap-4 animate-pulse">
            <div className="p-2 bg-cyan-500/20 text-cyan-400 rounded-lg">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="text-xs">
              <p className="font-bold text-slate-200">
                {searchProgress.found} empresas localizadas até agora...
              </p>
              <p className="text-slate-400 text-[11px] mt-0.5 truncate max-w-xl">
                Examinando: {searchProgress.currentName || 'Estabelecimentos comerciais da região...'}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Resultados da Pesquisa */}
      {foundLeads.length > 0 && (
        <section className="glass-card rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleSelectAll}
                className="text-xs text-slate-300 hover:text-white flex items-center gap-1.5 font-semibold"
              >
                {selectedIndices.size === foundLeads.length ? (
                  <CheckSquare className="w-4 h-4 text-cyan-400" />
                ) : (
                  <Square className="w-4 h-4 text-slate-500" />
                )}
                <span>
                  {selectedIndices.size === foundLeads.length
                    ? 'Desmarcar Todos'
                    : `Selecionar Todos (${foundLeads.length})`}
                </span>
              </button>
              <span className="text-xs text-slate-500">
                • {selectedIndices.size} selecionados
              </span>
            </div>

            <button
              onClick={handleSaveToDatabase}
              disabled={isSaving || selectedIndices.size === 0}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-5 py-2 rounded-xl shadow-lg shadow-emerald-950/50 transition active:scale-95 text-xs"
            >
              <Plus className="w-4 h-4" />
              <span>
                {isSaving ? 'Salvando...' : `Adicionar ${selectedIndices.size} Leads à Base de Disparos`}
              </span>
            </button>
          </div>

          {/* Tabela de Leads Encontrados */}
          <div className="overflow-x-auto rounded-xl border border-slate-800 max-h-96">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/90 text-slate-400 font-semibold sticky top-0 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 w-10"></th>
                  <th className="py-3 px-4">Nome da Empresa</th>
                  <th className="py-3 px-4">WhatsApp / Telefone</th>
                  <th className="py-3 px-4">Ramo</th>
                  <th className="py-3 px-4">Localização</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {foundLeads.map((item, idx) => {
                  const isChecked = selectedIndices.has(idx);
                  return (
                    <tr
                      key={idx}
                      onClick={() => toggleSelect(idx)}
                      className={`cursor-pointer transition ${
                        isChecked ? 'bg-cyan-950/20' : 'hover:bg-slate-900/40'
                      }`}
                    >
                      <td className="py-3 px-4">
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-cyan-400" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-600" />
                        )}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-100 flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{item.name}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-emerald-400">
                        {item.phone}
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        <span className="bg-slate-800 px-2 py-0.5 rounded text-[11px]">
                          {item.business_type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400 truncate max-w-xs">
                        {item.address || item.city}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};
