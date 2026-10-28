// Funções puras, sem dependência do Electron, para poderem ser testadas com o vitest

/**
 * Normaliza um telefone brasileiro para o formato do WhatsApp: 55 + DDD + número.
 * Aceita 10 dígitos (fixo), 11 (celular), com ou sem o 55, zeros de discagem e máscara.
 * Devolve null quando o número não tem formato válido.
 */
export function normalizePhone(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  let digits = String(raw).replace(/\D/g, '');

  // Remove prefixos de discagem como "0" ou "0xx" (operadora) antes do DDD
  digits = digits.replace(/^0+/, '');

  if (digits.length === 10 || digits.length === 11) {
    digits = '55' + digits;
  }

  if (!digits.startsWith('55') || (digits.length !== 12 && digits.length !== 13)) {
    return null;
  }

  const ddd = Number(digits.slice(2, 4));
  if (ddd < 11 || ddd > 99) return null;

  // Celular (13 dígitos) sempre começa com 9 depois do DDD
  if (digits.length === 13 && digits[4] !== '9') return null;

  return digits;
}

/**
 * Resolve spintax: "{Olá|Oi|Bom dia}" vira uma das opções, sorteada.
 * Suporta aninhamento; chaves sem "|" (as tags como {cidade}) não são tocadas.
 */
export function resolveSpintax(text: string, random: () => number = Math.random): string {
  const pattern = /\{([^{}]*\|[^{}]*)\}/;
  let result = text;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(result))) {
    const options = match[1].split('|');
    const choice = options[Math.floor(random() * options.length)] ?? '';
    result = result.slice(0, match.index) + choice + result.slice(match.index + match[0].length);
  }
  return result;
}

export interface MessageFields {
  name?: string;
  business_type?: string;
  city?: string;
  phone?: string;
}

/** Monta a mensagem final: resolve o spintax e depois substitui as tags do lead */
export function formatMessage(template: string, lead: MessageFields, random: () => number = Math.random): string {
  return resolveSpintax(template, random)
    .replace(/\{(nome_empresa|nome)\}/gi, lead.name || 'Empresa')
    .replace(/\{(ramo|nicho)\}/gi, lead.business_type || 'sua área')
    .replace(/\{cidade\}/gi, lead.city || 'sua região')
    .replace(/\{telefone\}/gi, lead.phone || '');
}

/** Inteiro aleatório entre min e max (inclusivos), aceitando os limites invertidos */
export function randomBetween(a: number, b: number, random: () => number = Math.random): number {
  const min = Math.ceil(Math.min(a, b));
  const max = Math.floor(Math.max(a, b));
  return Math.floor(random() * (max - min + 1)) + min;
}

/**
 * Verifica se a hora local está dentro da janela de envio [start, end).
 * start === end desativa a restrição; start > end atravessa a meia-noite (ex.: 22h–6h).
 */
export function isWithinSendWindow(date: Date, start: number, end: number): boolean {
  if (start === end) return true;
  const hour = date.getHours();
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Limita um número a um intervalo, usando o fallback quando o valor não é numérico */
export function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Converte qualquer valor em texto limpo, com tamanho máximo */
export function cleanText(value: unknown, maxLength = 300): string {
  if (value === null || value === undefined) return '';
  return String(value).trim().slice(0, maxLength);
}
