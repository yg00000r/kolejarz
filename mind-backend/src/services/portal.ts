import * as cheerio from 'cheerio';

const PORTAL_BASE = 'https://portal.intercity.pl';
const DESKTOP_BASE = `${PORTAL_BASE}/mbweb/main/matter/desktop`;

const POLISH_MONTHS = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień',
];

// ── Types ──────────────────────────────────────────────

export type ParsedShift = {
  date: string;
  shiftCode: string;
  startTime: string | null;
  endTime: string | null;
  type: 'presence' | 'offday';
  allocationId: string | null;
  planningLevel: string | null;
  timecardStatus: string | null;
};

export type DutyComponent = {
  type: string;
  typeLongName: string;
  tripNumber: string | null;
  crewType: string | null;
  startStation: string;
  startTime: string;
  endStation: string;
  endTime: string;
  vehicleType: string | null;
};

export type DutyDetails = {
  date: string;
  shiftCode: string;
  crewType: string | null;
  depot: string | null;
  startTime: string | null;
  paidTime: string | null;
  workTime: string | null;
  allocationId: string | null;
  employeeId: string | null;
  confirmUrl: string | null;
  rejectUrl: string | null;
  needsConfirmation: boolean;
  components: DutyComponent[];
};

export type ActualDuty = {
  date: string;
  shiftCode: string;
  startTime: string | null;
  endTime: string | null;
  allocationId: string | null;
  allocatableUrl: string | null;
  approved: boolean;
};

export type PortalMessage = {
  id: string;
  subject: string;
  sender: string;
  body: string;
  timestamp: string;
  unread: boolean;
  monthGroup: string;
};

export type AccountBalance = {
  name: string;
  value: string;
  referenceDate: string;
};

/** Pojedynczy odcinek pracy członka załogi (od stacji A do stacji B). */
export type CrewSegment = {
  startTime: string | null;
  startStation: string | null;
  endTime: string | null;
  endStation: string | null;
};

/** Członek drużyny pociągowej (kierownik, konduktor, maszynista). */
export type CrewMember = {
  name: string;
  /** Surowy kod typu obsady: KP, K, M, ... */
  crewType: string | null;
  /** Czytelna rola po polsku: "Kierownik pociągu", "Konduktor", "Maszynista". */
  role: string;
  phone: string | null;
  segment: CrewSegment;
};

/** Pełna odpowiedź wyszukiwania załogi pociągu. */
export type CrewOnTrip = {
  tripNumber: string;
  fromStation: string | null;
  toStation: string | null;
  startTime: string | null;
  endTime: string | null;
  members: CrewMember[];
};

// ── HTTP helpers ──────────────────────────────────────

const PORTAL_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';

function portalHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { 'User-Agent': PORTAL_UA, ...extra };
}

// ── Session management (per portal username) ───────────

type PortalSessionState = {
  cachedToken: string | null;
  sessionCookies: string[];
  sessionEstablished: boolean;
  tokenTimestamp: number;
};

const sessions = new Map<string, PortalSessionState>();
const TOKEN_TTL_MS = 20 * 60 * 60 * 1000; // 20h (JWT valid ~24h per "dur":"P1D")

/**
 * Legacy fallback username for endpoints that still call portal helpers
 * without an explicit tenant. Prefer per-tenant credentials from the DB.
 * No personal username is hardcoded — set PORTAL_USER in .env if needed.
 */
export function defaultPortalUser(): string {
  const fromEnv = process.env.PORTAL_USER?.trim();
  if (fromEnv) return fromEnv;
  throw new Error(
    'PORTAL_USER is not set. Pass an explicit portal username or set PORTAL_USER in .env (legacy paths only).',
  );
}

function getSession(sessionKey: string): PortalSessionState {
  let session = sessions.get(sessionKey);
  if (!session) {
    session = {
      cachedToken: null,
      sessionCookies: [],
      sessionEstablished: false,
      tokenTimestamp: 0,
    };
    sessions.set(sessionKey, session);
  }
  return session;
}

const MIN_PASSWORD_LENGTH = 8;

function padPassword(raw: string): string {
  return raw.length < MIN_PASSWORD_LENGTH ? `${raw}@` : raw;
}

function generatePassword(): string {
  const now = new Date();
  const month = POLISH_MONTHS[now.getMonth()];
  const year = now.getFullYear();
  return padPassword(`${month}${year}`);
}

function generatePasswordForMonthOffset(offset: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return padPassword(`${POLISH_MONTHS[d.getMonth()]}${d.getFullYear()}`);
}

/** Portal IC często akceptuje wyłącznie ASCII (np. Kwiecien zamiast Kwiecień). */
function toAsciiPortalPassword(password: string): string {
  return password
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Dla danego miesiąca: najpierw pełna polska nazwa, potem wariant ASCII jeśli się różni. */
function portalPasswordVariantsForOffset(offset: number): string[] {
  const full = generatePasswordForMonthOffset(offset);
  const ascii = toAsciiPortalPassword(full);
  return ascii === full ? [full] : [full, ascii];
}

/**
 * Returns a list of password candidates based on the Polish month+year pattern
 * (e.g. "Marzec2026", "Kwiecien2026").
 *
 * The IVU portal historically used a predictable password scheme:
 * `<PolishMonthName><Year>` (sometimes with ASCII transliteration of Polish chars).
 * This function generates the current-month variants so the old two-step
 * auto-registration flow could bypass manual password entry.
 *
 * @deprecated This auto-password logic will be removed in Phase 3 once all users
 *   register via the new `POST /auth/register` endpoint with their explicit
 *   portal credentials. The function is kept for backward compat with
 *   `POST /auth/verify-portal` only.
 */
export function getPortalAutoPasswordAttempts(): string[] {
  const now = new Date();
  const month = POLISH_MONTHS[now.getMonth()];
  const year = now.getFullYear();
  const base = `${month}${year}`;
  const generated = [padPassword(base), `${base}+`];
  const envPass = process.env.PORTAL_PASSWORD;
  if (envPass && !generated.includes(envPass)) {
    return [envPass, ...generated];
  }
  return generated;
}

/**
 * Authenticates against the IVU portal REST API and returns a JWT token.
 *
 * Caches the token for up to 20h (portal JWTs are valid ~24h per "dur":"P1D").
 * On each HTTP call, the portal sets a JSESSIONID cookie — collected via
 * `sessionCookies` and sent on subsequent requests.
 *
 * @param user - Portal username. Falls back to PORTAL_USER env var (no hardcoded default).
 * @param pass - Portal password. When provided, only that password is tried.
 *               When omitted, falls back to the brute-force password variants
 *               (month+year pattern) — see `portalPasswordVariantsForOffset`.
 * @returns JWT token string
 */
export async function login(user?: string, pass?: string): Promise<string> {
  const username = user ?? defaultPortalUser();
  const session = getSession(username);

  if (session.cachedToken && Date.now() - session.tokenTimestamp < TOKEN_TTL_MS) {
    return session.cachedToken;
  }

  console.log(`[Portal] Logging in as ${username}...`);

  // Explicit password wins. Otherwise prefer PORTAL_PASSWORD (seasonal override
  // e.g. "Lato08,."), then month+year auto variants for backward compatibility.
  const passwords =
    pass !== undefined
      ? [pass]
      : [
          ...(process.env.PORTAL_PASSWORD?.trim()
            ? [process.env.PORTAL_PASSWORD.trim()]
            : []),
          ...portalPasswordVariantsForOffset(0),
          ...portalPasswordVariantsForOffset(1),
        ].filter((p, i, arr) => arr.indexOf(p) === i);

  for (const password of passwords) {
    console.log(`[Portal] Trying password candidate (${password.length} chars)...`);

    let res: Response;
    try {
      res = await fetch(`${PORTAL_BASE}/pad/admin/rest/login`, {
        method: 'POST',
        headers: portalHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ username, password }),
      });
    } catch (e) {
      throw e instanceof Error ? e : new Error(String(e));
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      if (res.status >= 500) {
        throw new Error(`Portal login failed: ${res.status} ${text}`);
      }
      if (res.status === 401 || res.status === 403) {
        console.log(`[Portal] Password candidate failed (${password.length} chars), trying next...`);
        continue;
      }
      throw new Error(`Portal login failed: ${res.status} ${text}`);
    }

    const json = (await res.json()) as { status?: string; token?: string };
    const token = json.token ?? null;

    if (!token) {
      console.log(`[Portal] Password candidate failed (${password.length} chars), trying next...`);
      continue;
    }

    session.cachedToken = token;
    session.tokenTimestamp = Date.now();
    session.sessionCookies = [];
    session.sessionEstablished = false;
    console.log(`[Portal] Login successful for ${username}, token cached`);
    return token;
  }

  throw new Error('Portal login failed: all password attempts exhausted');
}

export function clearToken(sessionKey?: string): void {
  if (sessionKey) {
    sessions.delete(sessionKey);
    return;
  }
  sessions.clear();
}

function extractSetCookies(res: Response): string[] {
  const raw = res.headers.getSetCookie?.() ?? [];
  return raw.map(c => c.split(';')[0]);
}

function mergeCookies(existing: string[], incoming: string[]): string[] {
  const map = new Map<string, string>();
  for (const c of existing) {
    const name = c.split('=')[0];
    map.set(name, c);
  }
  for (const c of incoming) {
    const name = c.split('=')[0];
    map.set(name, c);
  }
  return Array.from(map.values());
}

// ── Fetching ───────────────────────────────────────────

async function portalFetch(path: string, token: string, sessionKey: string): Promise<string> {
  const session = getSession(sessionKey);
  const url = `${DESKTOP_BASE}/${path}`;
  const cookieParts = [`IvuPadAuthToken=${token}`, ...session.sessionCookies];
  const res = await fetch(url, {
    headers: portalHeaders({
      Cookie: cookieParts.join('; '),
      Authorization: `Bearer ${token}`,
    }),
    redirect: 'manual',
  });

  const newCookies = extractSetCookies(res);
  if (newCookies.length > 0) {
    session.sessionCookies = mergeCookies(session.sessionCookies, newCookies);
  }

  if (res.status === 401 || res.status === 403) {
    clearToken(sessionKey);
    throw new Error(`Portal auth expired (${res.status}), re-login needed`);
  }

  if (!res.ok && res.status !== 302) {
    throw new Error(`Portal fetch ${path}: ${res.status}`);
  }

  return res.text();
}

async function ensureSession(token: string, sessionKey: string): Promise<void> {
  const session = getSession(sessionKey);
  if (session.sessionEstablished) return;
  await portalFetch('_-duty-table?beginDate=2026-01-01&sync=true', token, sessionKey);
  session.sessionEstablished = true;
  console.log(`[Portal] Session established for ${sessionKey} (JSESSIONID acquired)`);
}

/**
 * Fetches the monthly schedule HTML table from the IVU portal.
 *
 * Calls the `_-duty-table` endpoint for the given month. The response is
 * a full HTML page containing a `<td class="day list-item">` per calendar day.
 * Side-effect: establishes the JSESSIONID session cookie on the first call.
 *
 * @param token - JWT from `login()`
 * @param year  - 4-digit year
 * @param month - 1-based month (1=Jan, 12=Dec)
 * @returns raw HTML string to be parsed by `parseDutyTable()`
 */
export async function fetchDutyTable(
  token: string,
  year: number,
  month: number,
  sessionKey: string = defaultPortalUser(),
): Promise<string> {
  const session = getSession(sessionKey);
  const m = String(month).padStart(2, '0');
  const html = await portalFetch(`_-duty-table?beginDate=${year}-${m}-01&sync=true`, token, sessionKey);
  if (!session.sessionEstablished) {
    session.sessionEstablished = true;
    console.log(`[Portal] Session established for ${sessionKey} via duty-table fetch`);
  }
  return html;
}

// ── Parsing ────────────────────────────────────────────

function extractTimecardStatus(classes: string): string | null {
  if (classes.includes('implicit-confirmation-needed')) return 'do_potwierdzenia';
  if (classes.includes('status_Zatwierdzona_Zatwierdzona')) return 'zatwierdzona';
  if (classes.includes('status_Zatwierdzona_Wydana')) return 'wydana';
  if (classes.includes('status_Rozliczona_Wyeksportowany')) return 'rozliczona';
  if (classes.includes('status_Rozliczona_Edytowalny')) return 'edytowalna';
  return null;
}

function extractPlanningLevel(classes: string): string | null {
  if (classes.includes('planning_level_shortname_Wykonanie')) return 'Wykonanie';
  if (classes.includes('planning_level_shortname_Plan')) return 'Plan';
  return null;
}

function extractShiftType(classes: string): 'presence' | 'offday' {
  return classes.includes('type_offday') ? 'offday' : 'presence';
}

// ── Fetch: duty details (shift breakdown) ─────────────

export async function fetchDutyDetails(
  token: string,
  date: string,
  sessionKey: string = defaultPortalUser(),
): Promise<string> {
  await ensureSession(token, sessionKey);
  return portalFetch(`duty-details?beginDate=${date}&sync=true`, token, sessionKey);
}

// ── Fetch: actual duties table ────────────────────────

export async function fetchActualDuties(
  token: string,
  year: number,
  month: number,
  sessionKey: string = defaultPortalUser(),
): Promise<string> {
  await ensureSession(token, sessionKey);
  const m = String(month).padStart(2, '0');
  return portalFetch(`_-actual-duties-table?beginDate=${year}-${m}-01&sync=true`, token, sessionKey);
}

// ── Fetch: messages ───────────────────────────────────

export async function fetchMessages(
  token: string,
  page: number,
  sessionKey: string = defaultPortalUser(),
): Promise<string> {
  await ensureSession(token, sessionKey);
  return portalFetch(`_-messages-table?page=${page}&sync=true`, token, sessionKey);
}

// ── Fetch: accounts overview ──────────────────────────

export async function fetchAccounts(
  token: string,
  sessionKey: string = defaultPortalUser(),
): Promise<string> {
  await ensureSession(token, sessionKey);
  return portalFetch(`accounts-overview?sync=true`, token, sessionKey);
}

// ── Fetch: crew on trip (załoga pociągu) ──────────────

/**
 * Fetches the crew (Besatzung) assigned to a given train on a given date.
 *
 * Uses the PAD path `_-crew-on-trip-table` which (unlike the desktop path)
 * is NOT blocked by Akamai. The date parameter MUST be `beginDate` (the same
 * convention as the rest of the portal) — using `date` triggers a server-side
 * NPE ("text is null").
 *
 * @param token - JWT from `login()`
 * @param date  - ISO date string YYYY-MM-DD
 * @param tripNumber - train number (e.g. "6200")
 * @returns raw HTML to be parsed by `parseCrewOnTrip()`
 */
export async function fetchCrewOnTrip(
  token: string,
  date: string,
  tripNumber: string,
  sessionKey: string = defaultPortalUser(),
): Promise<string> {
  const session = getSession(sessionKey);
  await ensureSession(token, sessionKey);
  const url = `${PORTAL_BASE}/mbweb/main/matter/pad/_-crew-on-trip-table?beginDate=${date}&tripNumber=${encodeURIComponent(tripNumber)}&sync=true`;
  const cookieParts = [`IvuPadAuthToken=${token}`, ...session.sessionCookies];
  const res = await fetch(url, {
    headers: portalHeaders({
      Cookie: cookieParts.join('; '),
      Authorization: `Bearer ${token}`,
    }),
    redirect: 'manual',
  });

  const newCookies = extractSetCookies(res);
  if (newCookies.length > 0) {
    session.sessionCookies = mergeCookies(session.sessionCookies, newCookies);
  }

  if (res.status === 401 || res.status === 403) {
    clearToken(sessionKey);
    throw new Error(`Portal auth expired (${res.status}), re-login needed`);
  }

  if (!res.ok && res.status !== 302) {
    throw new Error(`Portal crew-on-trip: ${res.status}`);
  }

  return res.text();
}

// ── Parsing ────────────────────────────────────────────

export function parseDutyDetails(html: string): DutyDetails | null {
  const $ = cheerio.load(html);

  const allocationDiv = $('div.allocation.singleduty, div.allocation.expand-container.singleduty').not('.hidden').first();
  if (allocationDiv.length === 0) {
    const simpleAlloc = $('div.allocation').not('.hidden').first();
    if (simpleAlloc.length === 0) return null;
    const title = simpleAlloc.find('.allocation-title').text().trim();
    const classes = simpleAlloc.attr('class') ?? '';
    const allocId = simpleAlloc.attr('data-allocationid') ?? null;
    const dateStr = $('#calendar-data').attr('data-date') ?? $('[data-date]').first().attr('data-date') ?? '';
    const employeeId = $('#calendar-data').attr('data-employee') ?? $('[data-employee]').first().attr('data-employee') ?? null;
    return {
      date: dateStr,
      shiftCode: title || 'unknown',
      crewType: null,
      depot: null,
      startTime: null,
      paidTime: null,
      workTime: null,
      allocationId: allocId,
      employeeId,
      confirmUrl: simpleAlloc.attr('data-submit') ?? null,
      rejectUrl: simpleAlloc.attr('data-submitrejection') ?? null,
      needsConfirmation:
        classes.includes('implicit-confirmation-needed') ||
        (classes.includes('status_Zatwierdzona_Wydana') && !!(simpleAlloc.attr('data-submit'))),
      components: [],
    };
  }

  const classes = allocationDiv.attr('class') ?? '';
  const allocId = allocationDiv.attr('data-allocationid') ?? null;
  const confirmUrl = allocationDiv.attr('data-submit') ?? null;
  const rejectUrl = allocationDiv.attr('data-submitrejection') ?? null;
  const needsConfirmation =
    classes.includes('implicit-confirmation-needed') ||
    (classes.includes('status_Zatwierdzona_Wydana') && !!confirmUrl);

  const shiftCode = allocationDiv.find('.allocation-title').first().text().trim();
  const dateStr = $('#calendar-data').attr('data-date') ?? $('[data-date]').first().attr('data-date') ?? '';
  const employeeId = $('#calendar-data').attr('data-employee') ?? $('[data-employee]').first().attr('data-employee') ?? null;

  const headerCells = allocationDiv.find('.duty-details-header .mdl-cell');
  const headerMap: Record<string, string> = {};
  headerCells.each((_i, el) => {
    const desc = $(el).find('.desc').text().trim().toLowerCase();
    const cont = $(el).find('.cont').text().trim();
    if (desc) headerMap[desc] = cont;
  });

  const resolveHeader = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = headerMap[k.toLowerCase()];
      if (v) return v;
    }
    return null;
  };

  const components: DutyComponent[] = [];
  allocationDiv.find('tr.duty-components-table-row').each((_i, tr) => {
    const typeAbbr = $(tr).find('td.type_abbreviation .value').text().trim();
    const typeLong = $(tr).find('td.type_long_name .value').text().trim();
    const tripNum = $(tr).find('td.trip_numbers .value').text().trim() || null;
    const crewT = $(tr).find('td.crew_type_abbreviation .value').text().trim() || null;
    const startSt = $(tr).find('td.start_location_long_name .value').text().trim();
    const startT = $(tr).find('td.start_time .value').text().trim();
    const endSt = $(tr).find('td.end_location_long_name .value').text().trim();
    const endT = $(tr).find('td.end_time .value').text().trim();
    const vehicle = $(tr).find('td.vehicle_type .value').text().trim() || null;

    if (typeAbbr) {
      components.push({
        type: typeAbbr,
        typeLongName: typeLong,
        tripNumber: tripNum,
        crewType: crewT,
        startStation: startSt,
        startTime: startT,
        endStation: endSt,
        endTime: endT,
        vehicleType: vehicle,
      });
    }
  });

  return {
    date: dateStr,
    shiftCode,
    crewType: resolveHeader('Besatzungstyp', 'Crew type'),
    depot: resolveHeader('Betriebshof', 'Depot'),
    startTime: resolveHeader('Beginn', 'Start'),
    paidTime: resolveHeader('Bezahlte Zeit', 'Paid time'),
    workTime: resolveHeader('Arbeitszeit', 'Work time'),
    allocationId: allocId,
    employeeId,
    confirmUrl,
    rejectUrl,
    needsConfirmation,
    components,
  };
}

export function parseActualDuties(html: string): ActualDuty[] {
  const $ = cheerio.load(html);
  const duties: ActualDuty[] = [];

  $('td.day.list-item').each((_i, td) => {
    const dayDiv = $(td).find('.allocation-day[data-date]');
    const date = dayDiv.attr('data-date');
    if (!date) return;

    const allocInfo = $(td).find('.allocation-info').first();
    if (allocInfo.length === 0) return;

    const shiftCode = allocInfo.find('.title-text').first().text().trim();
    if (!shiftCode) return;

    const startTime = allocInfo.find('.time.begin').text().trim() || null;
    const endTimeRaw = allocInfo.find('.time.end').text().trim() || null;
    const endTime = endTimeRaw?.replace(/\+$/, '') ?? null;
    const allocationId = allocInfo.attr('data-allocationid') ?? null;

    const parentClickable = allocInfo.closest('[data-url]');
    const allocatableUrl = parentClickable.attr('data-url') ?? null;

    const allocClasses = allocInfo.attr('class') ?? '';
    const approved = allocClasses.includes('actualDutyApproved');

    duties.push({ date, shiftCode, startTime, endTime, allocationId, allocatableUrl, approved });
  });

  return duties;
}

export function parseMessages(html: string): { messages: PortalMessage[]; nextPage: string | null } {
  const $ = cheerio.load(html);
  const messages: PortalMessage[] = [];

  const nextSpan = $('span#next').text().trim();
  const nextPageMatch = nextSpan.match(/page=(\d+)/);
  const nextPage = nextPageMatch ? nextPageMatch[1] : null;

  $('li.message').each((_i, li) => {
    const id = $(li).attr('id') ?? '';
    const subject = $(li).find('.message-subject').text().trim();
    const sender = $(li).find('.message-sender').text().trim();
    const body = $(li).find('.message-body').text().trim();
    const timestamp = $(li).find('.message-timestamp').text().trim();
    const unread = $(li).hasClass('unread');

    const monthDiv = $(li).closest('.month');
    const monthGroup = monthDiv.find('.table-title').text().trim();

    if (id) {
      messages.push({ id, subject, sender, body, timestamp, unread, monthGroup });
    }
  });

  return { messages, nextPage };
}

export function parseAccounts(html: string): AccountBalance[] {
  const $ = cheerio.load(html);
  const accounts: AccountBalance[] = [];

  $('div.account').each((_i, div) => {
    const name = $(div).find('.overflow-ellipsis').text().trim();
    const value = $(div).find('.account-value span').text().trim();
    const refDateRaw = $(div).find('.mdl-card__subtitle-text').text().trim();
    const referenceDate = refDateRaw.replace(/^Stichtag:\s*/, '').replace(/\u00a0/g, ' ').trim();

    if (name) {
      accounts.push({ name, value, referenceDate });
    }
  });

  return accounts;
}

// ── Parsing: crew on trip ─────────────────────────────

/** Tłumaczy nazwy nieobsadzonych pozycji na polski. */
function normalizeCrewName(name: string): string {
  const lower = name.trim().toLowerCase();
  if (lower === 'unoccupied' || lower === 'unbesetzt' || lower === 'nieobsadzony') {
    return 'Nieobsadzone';
  }
  return name.trim();
}

/** Mapuje kod obsady IVU na czytelną rolę po polsku. */
function resolveCrewRole(crewType: string | null): string {
  switch ((crewType ?? '').toUpperCase()) {
    case 'KP':
      return 'Kierownik pociągu';
    case 'K':
      return 'Konduktor';
    case 'M':
      return 'Maszynista';
    default:
      return crewType ? `Obsada ${crewType}` : 'Załoga';
  }
}

/** Rozdziela tekst "HH:MM STACJA" na czas i kod stacji. */
function splitTimeStation(raw: string): { time: string | null; station: string | null } {
  const text = raw.replace(/\u00a0/g, ' ').trim();
  if (!text) return { time: null, station: null };
  const m = text.match(/^(\d{1,2}:\d{2})\s*(.*)$/);
  if (m) {
    return { time: m[1], station: m[2].trim() || null };
  }
  return { time: null, station: text };
}

/**
 * Parses the crew-on-trip HTML into a structured `CrewOnTrip` object.
 *
 * Reads the `.tripInfo` header (train number, from/to stations, start/end times)
 * and each `.crew-table-row` (one per crew member). Crew columns are identified
 * by their `title` attribute (Name, Telefonnummer, Besatzungstyp,
 * "Beginn und Anfangsort", "Ende und Zielort").
 *
 * @param html - raw HTML from `fetchCrewOnTrip()`
 * @returns structured crew data, or null if no trip found / server error
 */
export function parseCrewOnTrip(html: string): CrewOnTrip | null {
  // Serwer zwraca error-view gdy zły param lub brak danych
  if (html.includes('id="error-view"') || html.includes('text is null')) {
    return null;
  }

  const $ = cheerio.load(html);

  const tripInfo = $('.tripInfo').first();
  if (tripInfo.length === 0) return null;

  const tripNumber = tripInfo.find('.trip-title').first().text().trim();

  // Nagłówek: pary .desc → .cont
  const header: Record<string, string> = {};
  tripInfo.find('.trip-info-header .mdl-cell').each((_i, cell) => {
    const desc = $(cell).find('.desc').text().trim();
    const cont = $(cell).find('.cont').text().trim();
    if (desc) header[desc] = cont;
  });

  const fromStation = header['Von'] || header['Od'] || null;
  const toStation = header['Nach'] || header['Do'] || null;
  const startTime = header['Beginn'] || header['Początek'] || null;
  const endTime = header['Ende'] || header['Koniec'] || null;

  const members: CrewMember[] = [];

  $('ul.crew-table-row').each((_i, ul) => {
    // Columns are identified by their language-independent material-icons name
    // (person/people/call/location_on/flag) — the `title` attribute is
    // localized (German "Besatzungstyp" vs English "Crew type") and unreliable.
    const byIcon = (icon: string) =>
      $(ul)
        .find('li.crew-info-column')
        .filter((_j, el) => $(el).find('i.material-icons').first().text().trim() === icon)
        .first();

    const valueOf = (icon: string): string =>
      byIcon(icon).find('span, a').first().text().trim();

    const name = valueOf('person');
    if (!name) return;

    const crewType = valueOf('people') || null;

    const phoneRaw = (() => {
      const li = byIcon('call');
      const href = li.find('a').attr('href');
      if (href?.startsWith('tel:')) return href.slice(4);
      const txt = li.find('a, span').first().text().trim();
      return txt || null;
    })();

    const begin = splitTimeStation(valueOf('location_on'));
    const end = splitTimeStation(valueOf('flag'));

    members.push({
      name: normalizeCrewName(name),
      crewType,
      role: resolveCrewRole(crewType),
      phone: phoneRaw ? phoneRaw.replace(/\s+/g, '') : null,
      segment: {
        startTime: begin.time,
        startStation: begin.station,
        endTime: end.time,
        endStation: end.station,
      },
    });
  });

  return {
    tripNumber: tripNumber || '',
    fromStation,
    toStation,
    startTime,
    endTime,
    members,
  };
}

// ── Health check ───────────────────────────────────────

export async function portalHealthCheck(): Promise<{ ok: boolean; loggedIn: boolean; error?: string }> {
  try {
    const token = await login();
    return { ok: true, loggedIn: !!token };
  } catch (e) {
    return { ok: false, loggedIn: false, error: String(e) };
  }
}

// ── HTTP confirm allocation (may be blocked by Akamai) ─

export type ConfirmAllocationHttpResult = {
  success: boolean;
  status: number;
  body: string;
  /** Sparsowane body, jeśli odpowiedź to poprawny JSON */
  json?: unknown;
};

export async function confirmAllocationHttp(
  token: string,
  allocationId: string,
  employeeId?: string | null,
  sessionKey: string = defaultPortalUser(),
): Promise<ConfirmAllocationHttpResult> {
  const session = getSession(sessionKey);
  await ensureSession(token, sessionKey);
  const url = `${DESKTOP_BASE}/_-json-confirm-allocation`;
  const cookieParts = [`IvuPadAuthToken=${token}`, ...session.sessionCookies];

  const commonHeaders = portalHeaders({
    Cookie: cookieParts.join('; '),
    Authorization: `Bearer ${token}`,
    Referer: `${PORTAL_BASE}/mbweb/main/matter/desktop/duty-details`,
    'X-Requested-With': 'XMLHttpRequest',
    Accept: 'application/json, */*',
  });

  const reqBodyJson = JSON.stringify({ allocationId, ...(employeeId ? { employee: employeeId } : {}) });

  // Attempt A: JSON body
  const resJson = await fetch(url, {
    method: 'POST',
    headers: { ...commonHeaders, 'Content-Type': 'application/json' },
    redirect: 'manual',
    body: reqBodyJson,
  });
  const bodyJson = await resJson.text();
  console.log(`[ConfirmHttp] JSON attempt: status=${resJson.status} body=${bodyJson.slice(0, 200)}`);
  console.log(`[ConfirmHttp] Response headers:`, Object.fromEntries(resJson.headers.entries()));

  // Check if JSON attempt succeeded
  const tryParse = (s: string) => { try { return JSON.parse(s); } catch { return null; } };
  const jsonResult = tryParse(bodyJson);
  if (resJson.status === 200 && jsonResult && jsonResult.success !== false && !jsonResult.error) {
    return { success: true, status: resJson.status, body: bodyJson, json: jsonResult };
  }

  // Attempt B: form-encoded body
  const formBody = new URLSearchParams({ allocationId, ...(employeeId ? { employee: employeeId } : {}) }).toString();
  const resForm = await fetch(url, {
    method: 'POST',
    headers: { ...commonHeaders, 'Content-Type': 'application/x-www-form-urlencoded' },
    redirect: 'manual',
    body: formBody,
  });
  const body = await resForm.text();
  console.log(`[ConfirmHttp] Form attempt: status=${resForm.status} body=${body.slice(0, 200)}`);

  const res = resForm;
  let json: unknown | undefined;
  const trimmed = body.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      json = JSON.parse(trimmed) as unknown;
    } catch {
      /* nie-JSON lub częściowy HTML */
    }
  }

  let success = res.status === 200;
  if (success && json !== undefined && json !== null && typeof json === 'object') {
    const rec = json as Record<string, unknown>;
    if ('error' in rec && rec.error != null && String(rec.error).length > 0) {
      success = false;
    }
    if (rec.success === false) {
      success = false;
    }
  }

  return { success, status: res.status, body, json };
}

// ── Session state export (for Playwright handoff) ──────

export function getSessionState(sessionKey: string = defaultPortalUser()): { token: string | null; cookies: string[] } {
  const session = getSession(sessionKey);
  return { token: session.cachedToken, cookies: [...session.sessionCookies] };
}

// ── Parsing: duty table ────────────────────────────────

/**
 * Parses the monthly schedule HTML into an array of `ParsedShift` objects.
 *
 * Uses Cheerio to traverse `<td class="day list-item">` cells. For each day
 * it extracts shift code, start/end times, allocation ID, planning level
 * (Plan vs Wykonanie), and timecard status from CSS class names.
 * When multiple `.allocation-info` elements exist (Plan + Wykonanie), prefers
 * the non-hidden Wykonanie entry.
 *
 * @param html - Raw HTML from `fetchDutyTable()`
 * @returns array of parsed shifts; empty array if the portal table structure changed
 */
export function parseDutyTable(html: string): ParsedShift[] {
  const $ = cheerio.load(html);
  const shifts: ParsedShift[] = [];

  $('td.day.list-item').each((_i, td) => {
    const dayDiv = $(td).find('.allocation-day[data-date]');
    const date = dayDiv.attr('data-date');
    if (!date) return;

    // Take the primary (non-hidden) allocation-info, preferring Wykonanie over Plan
    const allAllocations = $(td).find('.allocation-info');
    if (allAllocations.length === 0) return;

    let primaryEl: ReturnType<typeof $> | null = null;

    allAllocations.each((_j, el) => {
      const cls = $(el).attr('class') ?? '';
      const isHidden = cls.includes('comparison-level-element') && cls.includes('hidden');
      if (!isHidden) {
        primaryEl = $(el);
      }
    });

    if (!primaryEl) {
      primaryEl = $(allAllocations.first());
    }

    const pEl = primaryEl!;
    const classes = pEl.attr('class') ?? '';
    const shiftCode = pEl.find('.title-text').first().text().trim();
    if (!shiftCode) return;

    const startTime = pEl.find('.time.begin').text().trim() || null;
    const endTimeRaw = pEl.find('.time.end').text().trim() || null;
    const endTime = endTimeRaw?.replace(/\+$/, '') ?? null;
    const allocationId = pEl.attr('data-allocationid') ?? null;

    shifts.push({
      date,
      shiftCode,
      startTime,
      endTime,
      type: extractShiftType(classes),
      allocationId,
      planningLevel: extractPlanningLevel(classes),
      timecardStatus: extractTimecardStatus(classes),
    });
  });

  return shifts;
}
