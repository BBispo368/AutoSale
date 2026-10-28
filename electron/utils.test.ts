import { describe, expect, it } from 'vitest';
import {
  clampNumber,
  formatMessage,
  isWithinSendWindow,
  normalizePhone,
  randomBetween,
  resolveSpintax,
} from './utils';

describe('normalizePhone', () => {
  it('adiciona o 55 a celulares e fixos', () => {
    expect(normalizePhone('(11) 99876-5432')).toBe('5511998765432');
    expect(normalizePhone('11 3456-7890')).toBe('551134567890');
  });

  it('mantém números que já têm o 55', () => {
    expect(normalizePhone('+55 11 99876-5432')).toBe('5511998765432');
    expect(normalizePhone('551134567890')).toBe('551134567890');
  });

  it('remove zeros de discagem', () => {
    expect(normalizePhone('011 99876-5432')).toBe('5511998765432');
  });

  it('trata o DDD 55 (RS) sem confundir com o código do país', () => {
    expect(normalizePhone('55 99876-5432')).toBe('5555998765432');
  });

  it('rejeita números inválidos', () => {
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('5511887654321')).toBeNull(); // 13 dígitos sem o 9
    expect(normalizePhone('5505998765432')).toBeNull(); // DDD inválido
  });

  it('gera a mesma chave para o mesmo número escrito de formas diferentes', () => {
    expect(normalizePhone('11998765432')).toBe(normalizePhone('5511998765432'));
  });
});

describe('resolveSpintax', () => {
  it('sorteia uma das opções', () => {
    expect(resolveSpintax('{Olá|Oi|Bom dia}', () => 0)).toBe('Olá');
    expect(resolveSpintax('{Olá|Oi|Bom dia}', () => 0.99)).toBe('Bom dia');
  });

  it('resolve aninhamento', () => {
    expect(resolveSpintax('{a|{b|c}}', () => 0.99)).toBe('c');
  });

  it('não altera tags sem "|"', () => {
    expect(resolveSpintax('Olá {nome_empresa}')).toBe('Olá {nome_empresa}');
  });
});

describe('formatMessage', () => {
  it('substitui tags e spintax', () => {
    const msg = formatMessage('{Oi|Olá} {nome_empresa}, de {cidade}! Ramo: {ramo}.', {
      name: 'Pizzaria X',
      city: 'Campinas',
      business_type: 'Pizzarias',
    }, () => 0);
    expect(msg).toBe('Oi Pizzaria X, de Campinas! Ramo: Pizzarias.');
  });

  it('usa valores padrão quando faltam campos', () => {
    expect(formatMessage('{nome} em {cidade}', {})).toBe('Empresa em sua região');
  });
});

describe('isWithinSendWindow', () => {
  const at = (h: number) => new Date(2026, 0, 1, h, 30);

  it('janela normal', () => {
    expect(isWithinSendWindow(at(8), 8, 18)).toBe(true);
    expect(isWithinSendWindow(at(18), 8, 18)).toBe(false);
    expect(isWithinSendWindow(at(7), 8, 18)).toBe(false);
  });

  it('janela que atravessa a meia-noite', () => {
    expect(isWithinSendWindow(at(23), 22, 6)).toBe(true);
    expect(isWithinSendWindow(at(3), 22, 6)).toBe(true);
    expect(isWithinSendWindow(at(12), 22, 6)).toBe(false);
  });

  it('início igual ao fim desativa a restrição', () => {
    expect(isWithinSendWindow(at(3), 0, 0)).toBe(true);
  });
});

describe('helpers numéricos', () => {
  it('randomBetween aceita limites invertidos', () => {
    expect(randomBetween(45, 20, () => 0)).toBe(20);
    expect(randomBetween(45, 20, () => 0.999)).toBe(45);
  });

  it('clampNumber limita e usa fallback', () => {
    expect(clampNumber('abc', 0, 10, 5)).toBe(5);
    expect(clampNumber(50, 0, 10, 5)).toBe(10);
    expect(clampNumber('3', 0, 10, 5)).toBe(3);
  });
});
