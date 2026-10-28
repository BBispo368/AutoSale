import * as XLSX from 'xlsx';
import type { Lead, NewLead } from './types';
import { cleanText } from './utils';

const STATUS_LABELS: Record<Lead['status'], string> = {
  pending: 'Pendente',
  processing: 'Processando',
  sent: 'Enviado',
  failed: 'Falha',
  replied: 'Respondeu',
};

// Cabeçalhos aceitos na importação, comparados sem acento e sem diferenciar maiúsculas
const COLUMN_ALIASES: Record<keyof NewLead, string[]> = {
  name: ['nome', 'nome da empresa', 'empresa', 'name', 'razao social'],
  phone: ['telefone', 'phone', 'whatsapp', 'celular', 'contato', 'fone'],
  business_type: ['ramo', 'categoria', 'nicho', 'segmento', 'business_type'],
  city: ['cidade', 'city', 'municipio'],
  address: ['endereco', 'address'],
  instagram: ['instagram'],
  website: ['site', 'website', 'url'],
};

const normalizeHeader = (h: string) =>
  h.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const formatDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR') : '');

export function exportLeadsToFile(leads: Lead[], filePath: string) {
  const rows = leads.map((l) => ({
    'Nome da Empresa': l.name,
    Telefone: l.phone,
    Ramo: l.business_type || '',
    Cidade: l.city || '',
    Endereço: l.address || '',
    Instagram: l.instagram || '',
    Site: l.website || '',
    Status: STATUS_LABELS[l.status] ?? l.status,
    'Data de Envio': formatDate(l.sent_at),
    'Erro / Motivo': l.error_message || '',
    'Data de Cadastro': formatDate(l.created_at),
    ID: l.id,
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads');
  XLSX.writeFile(workbook, filePath);
}

/** Lê a primeira aba de uma planilha e mapeia as colunas pelos nomes mais comuns */
export function readLeadsFromFile(filePath: string): NewLead[] {
  const workbook = XLSX.readFile(filePath, { dense: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];

  // raw: false mantém o telefone como texto formatado, sem virar notação científica
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: false, defval: '' });

  return rows.map((row) => {
    const byHeader = new Map(Object.entries(row).map(([k, v]) => [normalizeHeader(k), v]));
    const pick = (field: keyof NewLead) => {
      for (const alias of COLUMN_ALIASES[field]) {
        const value = byHeader.get(alias);
        if (value !== undefined && value !== '') return cleanText(value);
      }
      return '';
    };

    return {
      name: pick('name') || 'Empresa',
      phone: pick('phone'),
      business_type: pick('business_type') || 'Geral',
      city: pick('city'),
      address: pick('address'),
      instagram: pick('instagram'),
      website: pick('website'),
    };
  });
}
