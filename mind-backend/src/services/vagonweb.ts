/**
 * Klient vagonWEB (vagonweb.cz) — zestawienia składów PKP IC.
 *
 * Strona jest server-side rendered, dane składu pochodzą z endpointów AJAX (HTML):
 *   - Lista:          GET  razeni.php?zeme=PKPIC&rok=YYYY&s=N
 *   - Kalendarz plan: POST ajax_kalendar_planovany.php → okresy od/do
 *   - Skład planowy:  POST ajax_dalsi_razeni_vlak.php (od/do) → ~50KB HTML
 *
 * Bez Playwrighta — zwykły HTTP. Parser: cheerio.
 */

import * as cheerio from 'cheerio';
import { execFile } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import path from 'path';

const execFileAsync = promisify(execFile);

const BASE = 'https://www.vagonweb.cz/razeni';
const ZEME = 'PKPIC';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// Cloudflare flaguje fingerprint TLS Node/undici (403). curl przechodzi —
// dlatego cała warstwa HTTP idzie przez curl z trwałym cookie jar.
const COOKIE_JAR = path.join(os.tmpdir(), 'vagonweb_cookies.txt');

// ── Typy ───────────────────────────────────────────────

export type ConsistWagon = {
  nr: string | null;          // numer wagonu w składzie
  wlasciciel: string | null;  // PKPIC | ČD | DB ...
  typ: string | null;         // np. "B 11 mnouz"
  typImg: string | null;      // typ z nazwy obrazka, np. "B11mnouz-Z2B-m"
  nazwa: string | null;       // dodatkowa nazwa/seria
  klasa: string | null;       // "1" | "2" | "WR" | null (lokomotywa)
  isLok: boolean;
};

export type ConsistVariant = {
  naglowek: string | null;    // data/relacja wariantu
  wagony: ConsistWagon[];
};

export type TrainListEntry = {
  kategoria: string;
  cislo: string;
  nazwa: string | null;
  relacja: string | null;
};

export type Period = { od: string; do: string };

// ── HTTP helpers (curl) ────────────────────────────────

const BASE_HEADERS = [
  '-H', `User-Agent: ${UA}`,
  '-H', 'Accept-Language: pl,cs;q=0.8,en;q=0.6',
  '-c', COOKIE_JAR,
  '-b', COOKIE_JAR,
];

const MAX_BUFFER = 32 * 1024 * 1024; // skład vse bywa ~2MB; zapas

let cookieReady = false;

async function ensureCookie(rok: number): Promise<void> {
  if (cookieReady) return;
  await curlGet(`${BASE}/razeni.php?zeme=${ZEME}&rok=${rok}`);
  cookieReady = true;
}

async function curlGet(url: string): Promise<string> {
  const { stdout } = await execFileAsync(
    'curl',
    ['-s', '--compressed', '--fail-with-body', ...BASE_HEADERS, '-H', `Referer: ${BASE}/`, url],
    { maxBuffer: MAX_BUFFER },
  );
  return stdout;
}

async function postAjax(ajaxPath: string, body: Record<string, string>): Promise<string> {
  const dataArgs: string[] = [];
  for (const [k, v] of Object.entries(body)) {
    dataArgs.push('--data-urlencode', `${k}=${v}`);
  }
  const args = [
    '-s', '--compressed', '--fail-with-body',
    ...BASE_HEADERS,
    '-H', 'X-Requested-With: XMLHttpRequest',
    '-H', 'Origin: https://www.vagonweb.cz',
    '-H', `Referer: ${BASE}/vlak.php`,
    '-H', 'Accept: text/html, */*; q=0.01',
    ...dataArgs,
    `${BASE}/${ajaxPath}`,
  ];
  try {
    const { stdout } = await execFileAsync('curl', args, { maxBuffer: MAX_BUFFER });
    return stdout;
  } catch (e) {
    throw new Error(`vagonweb ${ajaxPath}: ${String(e)}`);
  }
}

// ── Lista pociągów ─────────────────────────────────────

export async function fetchTrainList(rok: number): Promise<TrainListEntry[]> {
  await ensureCookie(rok);
  const seen = new Map<string, TrainListEntry>();
  let page = 1;

  while (page <= 50) {
    const url =
      `${BASE}/razeni.php?zeme=${ZEME}&rok=${rok}` + (page > 1 ? `&s=${page}` : '');
    const html = await curlGet(url);
    const $ = cheerio.load(html);
    const rows = $('tr.tr_razeni');
    if (rows.length === 0) break;

    let added = 0;
    rows.each((_i, tr) => {
      const link = $(tr).find('td.cislo a').first();
      const href = link.attr('href') ?? '';
      const m = href.match(/cislo=([^&]+)&nazev=([^&]*)/);
      if (!m) return;
      const cislo = decodeURIComponent(m[1]);
      const nazwa = decodeURIComponent(m[2].replace(/\+/g, ' ')).trim();
      const kat = (link.text().trim().split(/\s+/)[0] ?? '').trim();
      const relacja = $(tr).find('td.maly').text().trim() || null;
      const key = `${cislo}|${nazwa}`;
      if (!seen.has(key)) {
        seen.set(key, { kategoria: kat, cislo, nazwa: nazwa || null, relacja });
        added++;
      }
    });

    const hasNext = $(`a[href*='&s=${page + 1}']`).length > 0;
    if (!hasNext || added === 0) break;
    page++;
  }

  return [...seen.values()];
}

// ── Okresy planowe (kalendarz) ─────────────────────────

export async function fetchPlannedPeriods(
  cislo: string,
  nazev: string,
  rok: number,
): Promise<Period[]> {
  const html = await postAjax('ajax_kalendar_planovany.php', {
    rok: String(rok),
    zeme: ZEME,
    cislo,
    nazev,
    styl: 'r',
    aktualni_rok: String(rok),
    cislo_vozu: '',
    virtualni_vlak: '',
    cislo_alias: '',
  });
  const $ = cheerio.load(html);
  const periods = new Map<string, Period>();
  $('td[od][do]').each((_i, td) => {
    const od = $(td).attr('od');
    const doo = $(td).attr('do');
    if (od && doo) periods.set(`${od}|${doo}`, { od, do: doo });
  });
  return [...periods.values()];
}

/** Wybiera okres obowiązujący dziś (lub pierwszy dostępny). */
export function currentPeriod(periods: Period[], today = new Date()): Period | null {
  if (periods.length === 0) return null;
  const iso = today.toISOString().slice(0, 10);
  const hit = periods.find((p) => p.od <= iso && iso <= p.do);
  return hit ?? periods[0];
}

// ── Skład planowy ──────────────────────────────────────

export async function fetchPlannedConsist(
  cislo: string,
  nazev: string,
  rok: number,
  period: Period,
): Promise<string> {
  return postAjax('ajax_dalsi_razeni_vlak.php', {
    rok: String(rok),
    zeme: ZEME,
    cislo,
    nazev,
    styl: 'r',
    aktualni_rok: String(rok),
    cislo_vozu: '',
    od: period.od,
    do_x: period.do,
    virtualni_vlak: '',
    cislo_alias: '',
  });
}

// ── Parser składu ──────────────────────────────────────

export function parseConsist(html: string): ConsistVariant[] {
  const $ = cheerio.load(html);
  const variants: ConsistVariant[] = [];

  $('table.vlacek').each((_i, tbl) => {
    const prev = $(tbl).prevAll('a.popodskok-ex').first();
    const naglowek = prev.length ? prev.text().trim() : null;

    const wagony: ConsistWagon[] = [];
    $(tbl)
      .find('td.bunka_vozu')
      .each((_j, cell) => {
        const img = $(cell).find('img.obrazek_vagonu').first();
        const imgSrc = img.attr('src') ?? null;
        const typImg = imgSrc
          ? imgSrc.replace(/.*\//, '').replace(/-[ab]\.gif$/, '')
          : null;

        const nr = $(cell).find('span.raz-cislo').first().text().trim() || null;
        const owner = $(cell).find("span[title*='-']").first().text().trim() || null;
        const radam = $(cell).find('span.tab-radam').first().text().replace(/\s+/g, ' ').trim() || null;
        const small = $(cell).find('small').first().text().trim() || null;

        let klasa: string | null = null;
        const tab = $(cell).find("td[class*='tab-']").first();
        const cls = tab.attr('class') ?? '';
        if (cls.includes('tab-2tr')) klasa = '2';
        else if (cls.includes('tab-1tr')) klasa = '1';
        else if (cls.includes('tab-jidel')) klasa = 'WR';

        const isLok = !nr && !klasa;

        wagony.push({
          nr,
          wlasciciel: owner,
          typ: radam,
          typImg,
          nazwa: small,
          klasa,
          isLok,
        });
      });

    if (wagony.length > 0) variants.push({ naglowek, wagony });
  });

  return variants;
}

// ── Wysokopoziomowe: skład bieżący dla pociągu ─────────

export async function fetchCurrentConsist(
  cislo: string,
  nazev: string,
  rok: number,
): Promise<ConsistVariant[]> {
  await ensureCookie(rok);
  const periods = await fetchPlannedPeriods(cislo, nazev, rok);
  const period = currentPeriod(periods);
  if (!period) return [];
  const html = await fetchPlannedConsist(cislo, nazev, rok, period);
  return parseConsist(html);
}
