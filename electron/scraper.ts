import { BrowserWindow } from 'electron';
import { db } from './database';

export interface ScrapedLead {
  name: string;
  phone: string;
  business_type: string;
  city: string;
  address?: string;
  website?: string;
}

export interface SearchFilters {
  niche: string; // Ex: "Clínicas Odontológicas", "Pizzarias", "Academias"
  city: string; // Ex: "Campinas"
  state: string; // Ex: "SP"
  limit?: number; // Ex: 20, 30, 50
}

export class LeadScraper {
  /**
   * Limpa e padroniza o telefone no formato brasileiro internacional (55 + DDD + Número)
   */
  public cleanPhone(raw: string): string | null {
    if (!raw) return null;
    let clean = raw.replace(/\D/g, '');

    // Se começar com 55 e tiver 12 ou 13 dígitos
    if (clean.startsWith('55') && clean.length >= 12) {
      return clean;
    }

    // Telefones válidos no Brasil: 10 dígitos (DDD + 8 fixo) ou 11 dígitos (DDD + 9 celular)
    if (clean.length === 10 || clean.length === 11) {
      return '55' + clean;
    }

    return null;
  }

  /**
   * Realiza a pesquisa de estabelecimentos no Google Maps através do motor nativo Chromium do Electron.
   * Funciona 100% offline de APIs pagas, buscando estabelecimentos reais, telefones e endereços.
   */
  public async searchLeads(
    filters: SearchFilters,
    onProgress?: (found: number, currentName: string) => void
  ): Promise<ScrapedLead[]> {
    const { niche, city, state, limit = 25 } = filters;
    const query = `${niche} em ${city} ${state}`;

    db.addLog('info', `Pesquisando no Google Maps: "${query}" (Alvo: ${limit} contatos)...`);

    let win: BrowserWindow | null = null;
    const results: ScrapedLead[] = [];
    const seenPhones = new Set<string>();

    try {
      // Cria uma janela invisível em segundo plano
      // offscreen desativado: causava erros de WebGL/GLES no Windows sem GPU dedicada
      win = new BrowserWindow({
        show: false,
        width: 1280,
        height: 800,
        webPreferences: {
          sandbox: false,
          webgl: false,           // Desativa WebGL — scraper só precisa de DOM/JS
          offscreen: false,       // Offscreen forçava contexto GPU que falhava
          backgroundThrottling: false,
        },
      });

      const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}?hl=pt-BR`;
      win.loadURL(url, {
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      });

      // Aguarda 4 segundos para os estabelecimentos renderizarem
      await new Promise((r) => setTimeout(r, 4000));

      // Se o usuário pediu mais que 10 resultados, rola o feed para puxar mais
      if (limit > 10) {
        await win.webContents.executeJavaScript(`
          (() => {
            const feed = document.querySelector('div[role="feed"]');
            if (feed) {
              feed.scrollTop = feed.scrollHeight;
            }
          })()
        `);
        await new Promise((r) => setTimeout(r, 1500));
      }

      // Extrai a lista de lugares encontrados no feed
      const places: Array<{ name: string; href: string }> = await win.webContents.executeJavaScript(`
        (() => {
          const links = Array.from(document.querySelectorAll('a[href*="/maps/place/"]'));
          const seen = new Set();
          const unique = [];

          for (const a of links) {
            const name = (a.getAttribute('aria-label') || a.innerText.split('\\n')[0] || '')
              .replace(/^Resultados para /i, '')
              .trim();
            if (name && !seen.has(name)) {
              seen.add(name);
              unique.push({ name, href: a.href });
            }
          }
          return unique;
        })()
      `);

      db.addLog(
        'info',
        `Google Maps retornou ${places.length} locais. Extraindo números de telefone e endereços...`
      );

      // Percorre os locais clicando para abrir o painel lateral e extrair o telefone
      const maxToExamine = Math.min(places.length, limit * 2);

      for (let i = 0; i < maxToExamine; i++) {
        if (results.length >= limit) break;

        const place = places[i];

        try {
          const detail: { phone: string; address: string } = await win.webContents.executeJavaScript(`
            (async () => {
              const wait = (ms) => new Promise(r => setTimeout(r, ms));
              
              // Remove elemento anterior para não herdar dado antigo
              const oldPhone = document.querySelector('button[data-tooltip*="Copiar número"], button[data-item-id*="phone"]');
              if (oldPhone) oldPhone.remove();

              const links = Array.from(document.querySelectorAll('a[href*="/maps/place/"]'));
              const target = links[${i}];
              if (target) {
                target.click();
              }

              // Aguarda o painel lateral atualizar
              for (let t = 0; t < 15; t++) {
                const btn = document.querySelector('button[data-tooltip*="Copiar número"], button[data-item-id*="phone"]');
                if (btn) break;
                await wait(100);
              }
              await wait(250);

              const phoneBtn = document.querySelector('button[data-tooltip*="Copiar número"], button[data-item-id*="phone"]');
              const phone = phoneBtn ? (phoneBtn.getAttribute('aria-label') || phoneBtn.innerText || '') : '';

              const addrBtn = document.querySelector('button[data-tooltip*="Copiar endereço"], button[data-item-id*="address"]');
              const address = addrBtn ? (addrBtn.getAttribute('aria-label') || addrBtn.innerText || '') : '';

              return {
                phone: phone.replace(/Telefone:\\s*/i, '').replace(/Copiar número de telefone/i, '').trim(),
                address: address.replace(/Endereço:\\s*/i, '').replace(/Copiar endereço/i, '').trim()
              };
            })()
          `);

          if (detail && detail.phone) {
            const formatted = this.cleanPhone(detail.phone);
            if (formatted && !seenPhones.has(formatted)) {
              seenPhones.add(formatted);

              const lead: ScrapedLead = {
                name: place.name,
                phone: formatted,
                business_type: niche,
                city: `${city} - ${state}`,
                address: detail.address || `${city} - ${state}`,
              };

              results.push(lead);
              db.addLog('success', `Empresa encontrada: ${lead.name} - Telefone: ${detail.phone}`);

              if (onProgress) {
                onProgress(results.length, lead.name);
              }
            }
          }
        } catch (innerErr) {
          // Continua para o próximo lugar se um falhar
          continue;
        }
      }

      db.addLog(
        'success',
        `Pesquisa finalizada! Total de ${results.length} empresas com WhatsApp extraídas com sucesso.`
      );
    } catch (err: any) {
      db.addLog('error', `Erro durante a pesquisa de empresas: ${err?.message || err}`);
    } finally {
      if (win && !win.isDestroyed()) {
        win.destroy();
      }
    }

    return results;
  }
}

export const leadScraper = new LeadScraper();
