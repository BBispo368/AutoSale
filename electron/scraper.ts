import { BrowserWindow } from 'electron';
import { db } from './database';
import type { ScrapedLead, SearchFilters, SearchResult } from './types';
import { normalizePhone } from './utils';

export type { ScrapedLead, SearchFilters } from './types';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface PlaceDetail {
  phone: string;
  address: string;
  website: string;
}

export class LeadScraper {
  private running = false;
  private cancelRequested = false;

  public isRunning() {
    return this.running;
  }

  public cancel() {
    if (this.running) this.cancelRequested = true;
  }

  /**
   * Realiza a pesquisa de estabelecimentos no Google Maps através do motor nativo Chromium do Electron.
   * Funciona sem APIs pagas, buscando estabelecimentos reais, telefones e endereços.
   */
  public async searchLeads(
    filters: SearchFilters,
    onProgress?: (found: number, currentName: string) => void
  ): Promise<SearchResult> {
    if (this.running) {
      return { success: false, results: [], error: 'Já existe uma busca em andamento.' };
    }

    const { niche, city, state, limit = 25 } = filters;
    const query = `${niche} em ${city} ${state}`;

    this.running = true;
    this.cancelRequested = false;
    db.addLog('info', `Pesquisando no Google Maps: "${query}" (Alvo: ${limit} contatos)...`);

    let win: BrowserWindow | null = null;
    const results: ScrapedLead[] = [];
    const seenPhones = new Set<string>();

    try {
      // Janela invisível em segundo plano
      // offscreen desativado: causava erros de WebGL/GLES no Windows sem GPU dedicada
      win = new BrowserWindow({
        show: false,
        width: 1280,
        height: 800,
        webPreferences: {
          sandbox: true,
          webgl: false, // Scraper só precisa de DOM/JS
          backgroundThrottling: false,
        },
      });
      const page = win.webContents;

      const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}?hl=pt-BR`;
      await win.loadURL(url, { userAgent: UA });

      if (page.getURL().includes('consent.google.')) {
        throw new Error('O Google pediu consentimento de cookies; não foi possível acessar o Maps.');
      }

      // Aguarda os primeiros estabelecimentos renderizarem
      await sleep(4000);

      const collectPlaces = (): Promise<Array<{ name: string; href: string }>> =>
        page.executeJavaScript(`
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

      // Rola o feed até ter candidatos suficientes (nem todo local tem telefone)
      // ou até o Maps parar de carregar novos resultados
      let places = await collectPlaces();
      const targetPlaces = limit * 2;
      let stalledRounds = 0;

      while (places.length < targetPlaces && stalledRounds < 3 && !this.cancelRequested) {
        await page.executeJavaScript(`
          (() => {
            const feed = document.querySelector('div[role="feed"]');
            if (feed) feed.scrollTop = feed.scrollHeight;
          })()
        `);
        await sleep(1500);

        const next = await collectPlaces();
        stalledRounds = next.length > places.length ? 0 : stalledRounds + 1;
        places = next;
      }

      if (!this.cancelRequested) {
        db.addLog('info', `Google Maps retornou ${places.length} locais. Extraindo telefones e endereços...`);
      }

      // Abre a página de cada local diretamente: clicar na lista não abre o painel
      // de detalhes numa janela oculta
      const maxToExamine = Math.min(places.length, targetPlaces);

      for (let i = 0; i < maxToExamine && results.length < limit; i++) {
        if (this.cancelRequested) break;
        const place = places[i];

        try {
          await win.loadURL(place.href, { userAgent: UA });

          const detail: PlaceDetail = await page.executeJavaScript(`
            (async () => {
              const wait = (ms) => new Promise(r => setTimeout(r, ms));
              const label = (el) => el ? (el.getAttribute('aria-label') || el.innerText || '') : '';

              // Aguarda o painel do local carregar (até ~5s)
              for (let t = 0; t < 20; t++) {
                if (document.querySelector('[data-item-id^="phone"], [data-item-id="address"]')) break;
                await wait(250);
              }

              const phone = label(document.querySelector('[data-item-id^="phone"]'));
              const address = label(document.querySelector('[data-item-id="address"]'));
              const websiteEl = document.querySelector('a[data-item-id="authority"]');

              return {
                phone: phone.replace(/Telefone:\\s*/i, '').trim(),
                address: address.replace(/Endereço:\\s*/i, '').trim(),
                website: websiteEl ? (websiteEl.href || label(websiteEl).replace(/Website:\\s*/i, '').trim()) : ''
              };
            })()
          `);

          const phone = normalizePhone(detail?.phone);
          if (!phone || seenPhones.has(phone)) continue;
          seenPhones.add(phone);

          const lead: ScrapedLead = {
            name: place.name,
            phone,
            business_type: niche,
            city: `${city} - ${state}`,
            address: detail.address || `${city} - ${state}`,
            website: detail.website || undefined,
          };

          results.push(lead);
          db.addLog('success', `Empresa encontrada: ${lead.name} - Telefone: ${detail.phone}`);
          onProgress?.(results.length, lead.name);
        } catch {
          // Continua para o próximo lugar se um falhar
        }
      }

      if (this.cancelRequested) {
        db.addLog('warning', `Busca cancelada pelo usuário com ${results.length} empresas encontradas.`);
        return { success: true, canceled: true, results };
      }

      db.addLog('success', `Pesquisa finalizada! ${results.length} empresas com telefone extraídas.`);
      return { success: true, results };
    } catch (err: any) {
      const message = err?.message || String(err);
      db.addLog('error', `Erro durante a pesquisa de empresas: ${message}`);
      return { success: false, results, error: message };
    } finally {
      if (win && !win.isDestroyed()) win.destroy();
      this.running = false;
      this.cancelRequested = false;
    }
  }
}

export const leadScraper = new LeadScraper();
