import { PrismaLibSql } from '@prisma/adapter-libsql';
import cors from 'cors';
import cron from 'node-cron';
import dotenv from 'dotenv';
import express from 'express';
import { exec } from 'child_process';
import fs from 'fs/promises';
import helmet from 'helmet';
import path from 'path';
import { promisify } from 'util';
import { PrismaClient } from './generated/prisma/client';
import { registerAltStoreSourceRoutes } from './altstoreSource';
import { registerAppReleaseRoutes } from './appRelease';
import { encrypt, decrypt } from './crypto.js';
import { requireAuth, type AuthRequest } from './authMiddleware.js';
import {
  login as portalLogin,
  getPortalAutoPasswordAttempts,
  fetchDutyTable, parseDutyTable,
  fetchDutyDetails, parseDutyDetails,
  fetchActualDuties, parseActualDuties,
  fetchMessages, parseMessages,
  fetchAccounts, parseAccounts,
  fetchCrewOnTrip, parseCrewOnTrip,
  confirmAllocationHttp,
  portalHealthCheck,
  clearToken,
  defaultPortalUser,
} from './services/portal';

dotenv.config();

const execAsync = promisify(exec);

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL ?? 'file:./dev.db' });

const app = express();
const prisma = new PrismaClient({ adapter });
const PORT = process.env.PORT || 3000;

const TEMPLATES_DIR = process.env.TEMPLATES_DIR ?? path.join(process.cwd(), 'templates');
const RELEASES_DIR = process.env.RELEASES_DIR ?? path.join(process.cwd(), 'app-releases');
const APP_PUBLIC_URL = process.env.APP_PUBLIC_URL ?? 'http://57.128.246.232:3000';

// Ensure directories exist
fs.mkdir(TEMPLATES_DIR, { recursive: true }).catch(() => {});

type TenantPortal = { tenantId: number; username: string; token: string };

async function portalSessionForTenant(tenantId: number): Promise<TenantPortal> {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  const password = decrypt(tenant.portalPasswordEncrypted);
  const token = await portalLogin(tenant.portalUsername, password);
  return { tenantId, username: tenant.portalUsername, token };
}

function onPortalAuthError(e: unknown, username?: string): string {
  const msg = String(e);
  if (msg.includes('auth expired') || msg.includes('login failed')) {
    clearToken(username);
  }
  return msg;
}

// ── Sluzby dictionary ──────────────────────────────────
type SluzbaDef = { opis: string; skrot: string; typ: string };
let sluzbyDict: Record<string, SluzbaDef> = {};
fs.readFile(path.join(TEMPLATES_DIR, 'sluzby.json'), 'utf8')
  .then((d) => { sluzbyDict = JSON.parse(d); })
  .catch(() => {});

function resolveSluzba(sluzba: string): SluzbaDef & { kod: string } {
  const s = (sluzba || '').toUpperCase().trim();

  // KWR — display as "Służba KWR[CODE]" regardless of role digit
  if (s.startsWith('KWR')) {
    const suffix = s.slice(3);
    const skrot = suffix.length === 2 ? 'KWR-Z' : 'KWR';
    return { opis: `Służba ${s}`, skrot, typ: 'praca', kod: sluzba };
  }

  // General prefix match from sluzby.json (longest prefix first)
  const keys = Object.keys(sluzbyDict).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (s.startsWith(key.toUpperCase())) {
      return { ...sluzbyDict[key], kod: sluzba };
    }
  }
  return { opis: sluzba, skrot: sluzba, typ: 'nieznany', kod: sluzba };
}

// ── PLK API ────────────────────────────────────────────
const PLK_API = 'https://pdp-api.plk-sa.pl/api/v1';

// Station name lookup: { stationId: name }
let stacjeDict: Record<string, string> = {};
fs.readFile(path.join(TEMPLATES_DIR, 'stacje.json'), 'utf8')
  .then((d) => { stacjeDict = JSON.parse(d); })
  .catch(() => {});

function stacjaName(id: number | string): string {
  return stacjeDict[String(id)] ?? String(id);
}

function fmtTime(iso: string | undefined, planned: string | undefined): string | undefined {
  if (iso) return iso.length > 8 ? iso.slice(11, 16) : iso.slice(0, 5);
  if (planned) return planned.slice(0, 5);
  return undefined;
}

async function plkFetch(endpoint: string) {
  const res = await fetch(`${PLK_API}${endpoint}`, {
    headers: { 'X-API-Key': process.env.PLK_API_KEY ?? '' },
  });
  if (!res.ok) throw new Error(`PLK ${res.status}`);
  return res.json();
}

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

const allowedOrigins = process.env.CORS_ORIGINS?.split(',').map(o => o.trim()) ?? [];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // mobile apps / curl
    if (
      origin.startsWith('exp://') ||
      origin.startsWith('http://localhost') ||
      origin.startsWith('http://192.168.') ||
      origin.startsWith('http://10.') ||
      allowedOrigins.includes(origin)
    ) return callback(null, true);
    return callback(null, true); // open for now; tighten if needed
  },
  credentials: true,
}));
app.use(express.json());

registerAppReleaseRoutes(app, RELEASES_DIR, APP_PUBLIC_URL);
registerAltStoreSourceRoutes(app, RELEASES_DIR, APP_PUBLIC_URL);

// ── Health ──────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Route Controls helpers ────────────────────────────
type RouteControlStatus = 'ok' | 'missing_last_driven' | 'paper_due' | 'expires_soon' | 'expired';

function parseIsoDate(date: string | null | undefined): Date | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const d = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function endOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
}

function addMonths(d: Date, months: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate()));
}

function addYears(d: Date, years: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear() + years, d.getUTCMonth(), d.getUTCDate()));
}

function daysBetween(a: Date, b: Date): number {
  const dayMs = 86_400_000;
  const left = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const right = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.ceil((right - left) / dayMs);
}

function routeControlComputed(control: {
  acquiredAt: string;
  lastDrivenAt: string | null;
  paperSubmittedAt: string | null;
}) {
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const acquired = parseIsoDate(control.acquiredAt);
  const lastDriven = parseIsoDate(control.lastDrivenAt) ?? acquired;
  const updateDeadline = lastDriven ? endOfMonth(lastDriven) : null;
  const paperDeadline = lastDriven
    ? new Date(Date.UTC(lastDriven.getUTCFullYear(), lastDriven.getUTCMonth() + 1, 14))
    : null;
  const expiresAt = lastDriven ? addYears(lastDriven, 1) : null;
  const reportToChiefAt = expiresAt ? addMonths(expiresAt, -2) : null;

  let status: RouteControlStatus = 'ok';
  if (expiresAt && todayUtc > expiresAt) status = 'expired';
  else if (reportToChiefAt && todayUtc >= reportToChiefAt) status = 'expires_soon';
  else if (paperDeadline && !control.paperSubmittedAt && todayUtc > paperDeadline) status = 'paper_due';
  else if (!control.lastDrivenAt) status = 'missing_last_driven';

  return {
    status,
    updateDeadline: updateDeadline ? formatIsoDate(updateDeadline) : null,
    paperDeadline: paperDeadline ? formatIsoDate(paperDeadline) : null,
    expiresAt: expiresAt ? formatIsoDate(expiresAt) : null,
    reportToChiefAt: reportToChiefAt ? formatIsoDate(reportToChiefAt) : null,
    daysToExpiry: expiresAt ? daysBetween(todayUtc, expiresAt) : null,
  };
}

function isIsoDateString(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

// ── Auth ────────────────────────────────────────────

/**
 * POST /auth/register
 * Rejestracja nowego użytkownika przez podanie credentials portalu IVU.
 * Wykonuje JEDNĄ próbę logowania do portalu — brak brute-force.
 * Na sukces: zapisuje zaszyfrowane hasło w Tenant, zwraca sessionToken (30 dni).
 * Tenant jest upsertowany — ponowna rejestracja tym samym loginem odświeża sesję.
 */
app.post('/auth/register', async (req, res) => {
  const { portalUsername, portalPassword } = req.body ?? {};

  if (!portalUsername || typeof portalUsername !== 'string' || !portalUsername.trim()) {
    return res.status(400).json({ success: false, error: 'Podaj login IVU' });
  }
  if (!portalPassword || typeof portalPassword !== 'string' || !portalPassword.trim()) {
    return res.status(400).json({ success: false, error: 'Podaj hasło portalu IVU' });
  }

  const username = portalUsername.trim();
  const password = portalPassword.trim();

  try {
    const loginRes = await fetch('https://portal.intercity.pl/pad/admin/rest/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const text = await loginRes.text();
    let json: { status?: string; token?: string } = {};
    try { json = JSON.parse(text) as { status?: string; token?: string }; } catch { /* non-JSON */ }

    if (!json.token) {
      const detail = json.status ? `status: ${json.status}` : `HTTP ${loginRes.status}`;
      return res.status(401).json({ success: false, error: `Nieprawidłowy login lub hasło IVU (${detail})` });
    }

    const encrypted = encrypt(password);
    const tenant = await prisma.tenant.upsert({
      where: { portalUsername: username },
      update: { portalPasswordEncrypted: encrypted },
      create: { portalUsername: username, portalPasswordEncrypted: encrypted },
    });

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 dni
    const session = await prisma.appSession.create({
      data: { tenantId: tenant.id, expiresAt },
    });

    return res.json({ success: true, sessionToken: session.token, employeeId: username });
  } catch (e) {
    console.error('[Auth] Register error:', e);
    return res.status(502).json({ success: false, error: `Brak połączenia z portalem IVU: ${String(e)}` });
  }
});

/**
 * GET /auth/me
 * Weryfikuje token i zwraca dane zalogowanego tenanta.
 */
app.get('/auth/me', requireAuth, (req: AuthRequest, res) => {
  res.json({ tenantId: req.tenantId, portalUsername: req.portalUsername });
});

/**
 * POST /auth/logout
 * Usuwa bieżącą sesję.
 */
app.post('/auth/logout', requireAuth, async (req: AuthRequest, res) => {
  const token = req.headers.authorization?.slice(7);
  if (token) await prisma.appSession.deleteMany({ where: { token } });
  res.json({ success: true });
});

/**
 * POST /auth/verify-portal
 * @deprecated Używaj POST /auth/register — zachowany dla kompatybilności ze starą wersją aplikacji.
 */
app.post('/auth/verify-portal', async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || typeof username !== 'string' || !username.trim()) {
    return res.status(400).json({ success: false, error: 'username is required' });
  }
  const user = username.trim();
  const manual =
    password !== undefined && password !== null && String(password).trim() !== ''
      ? [String(password).trim()]
      : [];
  const attempts = manual.length > 0 ? manual : getPortalAutoPasswordAttempts();

  let lastDetail = '';
  try {
    for (const pwd of attempts) {
      const verifyRes = await fetch('https://portal.intercity.pl/pad/admin/rest/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pwd }),
      });
      const text = await verifyRes.text();
      let json: { status?: string; token?: string } = {};
      try {
        json = JSON.parse(text) as { status?: string; token?: string };
      } catch {
        lastDetail = `Portal ${verifyRes.status} (non-JSON)`;
        continue;
      }
      if (json.token) {
        return res.json({ success: true });
      }
      lastDetail = json.status ? `status: ${json.status}` : `Portal ${verifyRes.status}`;
    }
    return res.status(401).json({
      success: false,
      error: lastDetail || 'No token — invalid credentials',
    });
  } catch (e) {
    return res.status(502).json({ success: false, error: String(e) });
  }
});



// ── Devices + Monitoring ──────────────────────────────
async function pingHost(host: string): Promise<boolean> {
  try {
    await execAsync(`ping -c 1 -W 2 ${host}`, { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

app.get('/devices', requireAuth, async (_req, res) => {
  const devices = await prisma.device.findMany({ orderBy: { createdAt: 'asc' } });
  const withStatus = await Promise.all(
    devices.map(async (d) => ({ ...d, online: await pingHost(d.host) }))
  );
  res.json(withStatus);
});

app.post('/devices', requireAuth, async (req, res) => {
  const { name, host } = req.body as { name?: string; host?: string };
  if (!name || !host) return res.status(400).json({ error: 'name and host are required' });
  const device = await prisma.device.create({ data: { name: name.trim(), host: host.trim() } });
  return res.status(201).json(device);
});

app.delete('/devices/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'invalid id' });
  await prisma.device.delete({ where: { id } });
  return res.status(204).send();
});

app.get('/monitoring/docker', requireAuth, async (_req, res) => {
  try {
    const { stdout } = await execAsync(
      `docker ps --format "{{.Names}}|{{.Status}}|{{.Image}}"`,
      { timeout: 5000 }
    );
    const containers = stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [name, status, image] = line.split('|');
        const running = status?.toLowerCase().startsWith('up') ?? false;
        return { name, status, image, running };
      });
    res.json({ available: true, containers });
  } catch {
    res.json({ available: false, containers: [] });
  }
});

app.get('/monitoring/vps', requireAuth, async (_req, res) => {
  try {
    const [uptimeOut, memOut] = await Promise.all([
      execAsync('uptime -p').catch(() => ({ stdout: 'unknown' })),
      execAsync("free -m | awk 'NR==2{print $2, $3}'").catch(() => ({ stdout: '0 0' })),
    ]);
    const uptime = uptimeOut.stdout.trim();
    const [totalMem, usedMem] = memOut.stdout.trim().split(' ').map(Number);
    res.json({ uptime, totalMem, usedMem, memPercent: Math.round((usedMem / totalMem) * 100) });
  } catch {
    res.json({ uptime: 'unknown', totalMem: 0, usedMem: 0, memPercent: 0 });
  }
});

// ── Sync helpers + cron ───────────────────────────────

let lastSyncAt: string | null = null;

async function syncMonth(tenantId: number, year: number, month: number): Promise<number> {
  const { username, token } = await portalSessionForTenant(tenantId);
  const html = await fetchDutyTable(token, year, month, username);
  const parsed = parseDutyTable(html);

  if (parsed.length === 0) {
    throw new Error(`No shifts parsed from portal for ${year}-${String(month).padStart(2, '0')}`);
  }

  let upserted = 0;
  for (const s of parsed) {
    await prisma.shift.upsert({
      where: { tenantId_date: { tenantId, date: s.date } },
      create: { ...s, tenantId },
      update: {
        shiftCode: s.shiftCode,
        startTime: s.startTime,
        endTime: s.endTime,
        type: s.type,
        allocationId: s.allocationId,
        planningLevel: s.planningLevel,
        timecardStatus: s.timecardStatus,
      },
    });
    upserted++;
  }

  return upserted;
}

async function runScheduledSync(): Promise<void> {
  const now = new Date();
  const m = now.getMonth() + 1;
  const y = now.getFullYear();
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;

  const tenants = await prisma.tenant.findMany({ orderBy: { id: 'asc' } });
  if (tenants.length === 0) {
    console.warn('[Cron] No tenants registered — skipping sync');
    return;
  }

  console.log(`[Cron] Auto-sync started at ${now.toISOString()} for ${tenants.length} tenant(s)`);

  for (const tenant of tenants) {
    for (const [year, month] of [[y, m], [nextY, nextM]] as const) {
      try {
        const count = await syncMonth(tenant.id, year, month);
        console.log(`[Cron] Synced ${count} shifts for ${tenant.portalUsername} ${year}-${String(month).padStart(2, '0')}`);
      } catch (e) {
        console.error(`[Cron] Failed for ${tenant.portalUsername} ${year}-${String(month).padStart(2, '0')}:`, e);
      }
    }
  }

  lastSyncAt = new Date().toISOString();
}

cron.schedule('0 */6 * * *', runScheduledSync);
setTimeout(runScheduledSync, 30_000);

// ── Manual sync trigger ────────────────────────────────
// POST /portal/sync — re-sync current month on demand (e.g. after manual portal confirmation)
app.post('/portal/sync', requireAuth, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.tenantId!;
    const now = new Date();
    const count = await syncMonth(tenantId, now.getFullYear(), now.getMonth() + 1);
    lastSyncAt = new Date().toISOString();
    return res.json({ success: true, synced: count, syncedAt: lastSyncAt });
  } catch (e) {
    return res.status(502).json({ success: false, error: String(e) });
  }
});

// ── Route Controls ────────────────────────────────────
app.get('/route-controls', requireAuth, async (_req, res) => {
  try {
    const db = prisma as any;
    const definitions = await db.routeDefinition.findMany({
      where: { active: true },
      include: { controls: { orderBy: { updatedAt: 'desc' }, take: 1 } },
      orderBy: { name: 'asc' },
    });

    return res.json({
      routes: definitions.map((route: any) => {
        const control = route.controls?.[0] ?? null;
        return {
          id: route.id,
          name: route.name,
          description: route.description,
          active: route.active,
          control: control
            ? {
                ...control,
                computed: routeControlComputed(control),
              }
            : null,
        };
      }),
    });
  } catch (e) {
    return res.status(500).json({ error: 'route controls query failed', detail: String(e) });
  }
});

app.post('/route-definitions', requireAuth, async (req, res) => {
  try {
    const { name, description } = req.body ?? {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    const db = prisma as any;
    const route = await db.routeDefinition.create({
      data: {
        name: name.trim(),
        description: typeof description === 'string' && description.trim() ? description.trim() : null,
      },
    });
    return res.status(201).json(route);
  } catch (e) {
    return res.status(500).json({ error: 'route definition create failed', detail: String(e) });
  }
});

app.post('/route-controls', requireAuth, async (req, res) => {
  try {
    const { routeDefinitionId, acquiredAt, lastDrivenAt, paperSubmittedAt, digitalCopyUri, notes } = req.body ?? {};
    const id = Number(routeDefinitionId);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'routeDefinitionId is required' });
    if (!isIsoDateString(acquiredAt)) return res.status(400).json({ error: 'acquiredAt must be YYYY-MM-DD' });
    if (lastDrivenAt != null && lastDrivenAt !== '' && !isIsoDateString(lastDrivenAt)) {
      return res.status(400).json({ error: 'lastDrivenAt must be YYYY-MM-DD' });
    }
    if (paperSubmittedAt != null && paperSubmittedAt !== '' && !isIsoDateString(paperSubmittedAt)) {
      return res.status(400).json({ error: 'paperSubmittedAt must be YYYY-MM-DD' });
    }

    const db = prisma as any;
    const control = await db.routeControl.create({
      data: {
        routeDefinitionId: id,
        acquiredAt,
        lastDrivenAt: lastDrivenAt || null,
        paperSubmittedAt: paperSubmittedAt || null,
        digitalCopyUri: typeof digitalCopyUri === 'string' && digitalCopyUri.trim() ? digitalCopyUri.trim() : null,
        notes: typeof notes === 'string' && notes.trim() ? notes.trim() : null,
      },
    });
    return res.status(201).json({ ...control, computed: routeControlComputed(control) });
  } catch (e) {
    return res.status(500).json({ error: 'route control create failed', detail: String(e) });
  }
});

app.put('/route-controls/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'invalid id' });

    const data: Record<string, string | null> = {};
    for (const field of ['acquiredAt', 'lastDrivenAt', 'paperSubmittedAt'] as const) {
      if (field in req.body) {
        const value = req.body[field];
        if (value == null || value === '') data[field] = null;
        else if (isIsoDateString(value)) data[field] = value;
        else return res.status(400).json({ error: `${field} must be YYYY-MM-DD` });
      }
    }
    for (const field of ['digitalCopyUri', 'notes'] as const) {
      if (field in req.body) {
        const value = req.body[field];
        data[field] = typeof value === 'string' && value.trim() ? value.trim() : null;
      }
    }
    if (data.acquiredAt === null) return res.status(400).json({ error: 'acquiredAt cannot be empty' });

    const db = prisma as any;
    const control = await db.routeControl.update({ where: { id }, data });
    return res.json({ ...control, computed: routeControlComputed(control) });
  } catch (e) {
    return res.status(500).json({ error: 'route control update failed', detail: String(e) });
  }
});

app.delete('/route-controls/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'invalid id' });
    const db = prisma as any;
    await db.routeControl.delete({ where: { id } });
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: 'route control delete failed', detail: String(e) });
  }
});

// ── Shifts (Portal IVU.pad → Prisma) ──────────────────
app.get('/shifts/sluzby', requireAuth, (_req, res) => {
  res.json(sluzbyDict);
});

app.get('/shifts/next', requireAuth, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.tenantId!;
    const today = new Date().toISOString().slice(0, 10);
    const rows = await prisma.shift.findMany({
      where: { tenantId, date: { gte: today } },
      orderBy: { date: 'asc' },
      take: 10,
    });
    const next = rows.find((r) => {
      const def = resolveSluzba(r.shiftCode);
      return def.typ === 'praca' || def.typ === 'inne';
    }) ?? rows[0];
    if (!next) return res.json(null);
    const def = resolveSluzba(next.shiftCode);
    return res.json({
      date: next.date,
      sluzba: next.shiftCode,
      start: next.startTime ?? undefined,
      end: next.endTime ?? undefined,
      statusKarty: next.timecardStatus,
      allocationId: next.allocationId,
      planningLevel: next.planningLevel,
      ...def,
    });
  } catch (e) {
    return res.status(500).json({ error: 'shifts query failed', detail: String(e) });
  }
});

/**
 * POST /shifts/sync
 * Triggers a portal sync for the given month/year (or current+next if omitted).
 * The backend logs into IVU portal, fetches the schedule HTML, parses it and
 * upserts shifts into the database. Returns count of upserted rows.
 */
app.post('/shifts/sync', requireAuth, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.tenantId!;
    const { month, year } = (req.body ?? {}) as { month?: number; year?: number };
    const now = new Date();

    // Jeśli podano konkretny miesiąc — syncuj tylko ten
    if (month && year) {
      const count = await syncMonth(tenantId, year, month);
      lastSyncAt = new Date().toISOString();
      return res.json({ count, month, year });
    }

    // Bez parametrów — syncuj bieżący + następny miesiąc (jak cron)
    const results: { month: number; year: number; count: number }[] = [];
    const pairs = [
      { y: now.getFullYear(), m: now.getMonth() + 1 },
      { y: now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear(), m: now.getMonth() === 11 ? 1 : now.getMonth() + 2 },
    ];
    for (const { y, m } of pairs) {
      try {
        const count = await syncMonth(tenantId, y, m);
        results.push({ month: m, year: y, count });
        console.log(`[Sync] Upserted ${count} shifts for tenant ${tenantId} ${y}-${String(m).padStart(2, '0')}`);
      } catch (e) {
        console.warn(`[Sync] Failed for tenant ${tenantId} ${y}-${String(m).padStart(2, '0')}: ${e}`);
      }
    }
    lastSyncAt = new Date().toISOString();
    const totalCount = results.reduce((s, r) => s + r.count, 0);
    return res.json({ count: totalCount, months: results });
  } catch (e) {
    const msg = onPortalAuthError(e, req.portalUsername);
    return res.status(502).json({ error: 'Sync error', detail: msg });
  }
});

/**
 * GET /shifts?month=M&year=Y
 * Returns all shifts for the given month from the local database.
 * Does NOT hit the portal — use /shifts/sync to refresh data from portal.
 * Each shift includes resolved service definition (opis, skrot, typ) from sluzby.json.
 */
app.get('/shifts', requireAuth, async (req: AuthRequest, res) => {
  const tenantId = req.tenantId!;
  const { month, year } = req.query as { month?: string; year?: string };
  if (!month || !year) return res.status(400).json({ error: 'month and year required' });
  const m = String(month).padStart(2, '0');
  const from = `${year}-${m}-01`;
  const to = `${year}-${m}-31`;
  try {
    const rows = await prisma.shift.findMany({
      where: { tenantId, date: { gte: from, lte: to } },
      orderBy: { date: 'asc' },
    });
    const shifts = rows.map((r) => {
      const def = resolveSluzba(r.shiftCode);
      return {
        date: r.date,
        sluzba: r.shiftCode,
        start: r.startTime ?? undefined,
        end: r.endTime ?? undefined,
        statusKarty: r.timecardStatus,
        allocationId: r.allocationId,
        planningLevel: r.planningLevel,
        ...def,
      };
    });
    return res.json(shifts);
  } catch (e) {
    return res.status(500).json({ error: 'shifts query failed', detail: String(e) });
  }
});

// ── Actual duties (Ist-Dienst) ────────────────────────
app.get('/shifts/actual', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { month, year } = req.query as { month?: string; year?: string };
    const now = new Date();
    const m = Number(month) || (now.getMonth() + 1);
    const y = Number(year) || now.getFullYear();
    const { username, token } = await portalSessionForTenant(req.tenantId!);
    const html = await fetchActualDuties(token, y, m, username);
    const duties = parseActualDuties(html);
    return res.json({ month: m, year: y, duties });
  } catch (e) {
    return res.status(502).json({ error: 'Portal error', detail: onPortalAuthError(e, req.portalUsername) });
  }
});

// ── Shift details (duty breakdown) ─────────────────────
/**
 * GET /shifts/:date/details
 * Fetches a full duty breakdown for a single date by proxying to the IVU portal.
 * Returns shift components (trip legs), timecard status, and confirmation URLs.
 * Clears the cached portal token on auth errors so the next call re-authenticates.
 */
app.get('/shifts/:date/details', requireAuth, async (req: AuthRequest, res) => {
  try {
    const date = req.params.date as string;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    }
    const { username, token } = await portalSessionForTenant(req.tenantId!);
    const html = await fetchDutyDetails(token, date, username);
    const details = parseDutyDetails(html);
    if (!details) {
      return res.json({ date, shiftCode: null, components: [] });
    }
    return res.json(details);
  } catch (e) {
    return res.status(502).json({ error: 'Portal error', detail: onPortalAuthError(e, req.portalUsername) });
  }
});

// ── Portal messages ───────────────────────────────────
app.get('/portal/messages', requireAuth, async (req: AuthRequest, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const { username, token } = await portalSessionForTenant(req.tenantId!);
    const html = await fetchMessages(token, page, username);
    const result = parseMessages(html);
    return res.json({ page, ...result });
  } catch (e) {
    return res.status(502).json({ error: 'Portal error', detail: onPortalAuthError(e, req.portalUsername) });
  }
});

// ── Portal accounts (balances) ────────────────────────
app.get('/portal/accounts', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { username, token } = await portalSessionForTenant(req.tenantId!);
    const html = await fetchAccounts(token, username);
    const accounts = parseAccounts(html);
    return res.json({ accounts });
  } catch (e) {
    return res.status(502).json({ error: 'Portal error', detail: onPortalAuthError(e, req.portalUsername) });
  }
});

// ── Crew on trip (załoga pociągu) ─────────────────────

/** Easter egg: pociąg „69" zwraca mockową załogę z Dariuszem Porębą (KP). */
const MOCK_CREW_69 = {
  tripNumber: '69',
  fromStation: 'Wrocław Główny',
  toStation: 'Warszawa Centralna',
  startTime: '04:20',
  endTime: '08:08',
  members: [
    { name: 'DARIUSZ PORĘBA', crewType: 'KP', role: 'Kierownik pociągu', phone: '600100200',
      segment: { startTime: '04:20', startStation: 'WR_GL', endTime: '08:08', endStation: 'W-WA_C' } },
    { name: 'ANNA NOWAK', crewType: 'K', role: 'Konduktor', phone: '600300400',
      segment: { startTime: '04:20', startStation: 'WR_GL', endTime: '08:08', endStation: 'W-WA_C' } },
    { name: 'PIOTR ZIELIŃSKI', crewType: 'M', role: 'Maszynista', phone: '600500600',
      segment: { startTime: '04:20', startStation: 'WR_GL', endTime: '08:08', endStation: 'W-WA_C' } },
  ],
};

app.get('/crew', requireAuth, async (req: AuthRequest, res) => {
  try {
    const date = String(req.query.date ?? '');
    const trip = String(req.query.trip ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    }
    if (!trip) {
      return res.status(400).json({ error: 'trip (numer pociągu) is required' });
    }
    if (trip === '69') {
      return res.json(MOCK_CREW_69);
    }
    const { username, token } = await portalSessionForTenant(req.tenantId!);
    const html = await fetchCrewOnTrip(token, date, trip, username);
    const crew = parseCrewOnTrip(html);
    if (!crew) {
      return res.json({ tripNumber: trip, fromStation: null, toStation: null, startTime: null, endTime: null, members: [], notFound: true });
    }
    return res.json(crew);
  } catch (e) {
    return res.status(502).json({ error: 'Portal error', detail: onPortalAuthError(e, req.portalUsername) });
  }
});

// ── Debug: raw duty table HTML ────────────────────────
app.get('/debug/duty-table', async (req, res) => {
  try {
    const { month, year } = req.query as { month?: string; year?: string };
    const now = new Date();
    const m = Number(month) || (now.getMonth() + 1);
    const y = Number(year) || now.getFullYear();
    const token = await portalLogin(defaultPortalUser());
    const html = await fetchDutyTable(token, y, m, defaultPortalUser());
    const parsed = parseDutyTable(html);
    const $ = (await import('cheerio')).load(html);
    const tdCount = $('td.day.list-item').length;
    const allocCount = $('td.day.list-item .allocation-info').length;
    const titleCount = $('td.day.list-item .title-text').length;
    res.setHeader('Content-Type', 'application/json');
    return res.json({
      month: m, year: y,
      parsedCount: parsed.length,
      selectors: { tdDayListItem: tdCount, allocationInfo: allocCount, titleText: titleCount },
      htmlSnippet: html.slice(0, 2000),
      parsed,
    });
  } catch (e) {
    return res.status(502).json({ error: String(e) });
  }
});

// ── Debug: dump all data-* attrs from confirm button ──
app.get('/debug/confirm-attrs/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const sessionKey = defaultPortalUser();
    const token = await portalLogin(sessionKey);
    const html = await fetchDutyDetails(token, date, sessionKey);
    const cheerioLib = await import('cheerio');
    const $ = cheerioLib.load(html);
    const alloc = $('div.allocation').not('.hidden').first();
    const attrs: Record<string, string> = {};
    const el = alloc.get(0) as any;
    if (el?.attribs) Object.assign(attrs, el.attribs);
    // Find all elements with data-submit or related confirm attributes
    const confirmElements: object[] = [];
    $('[data-submit], [data-allocationid], button, .confirm, .timecard-confirm').each((_i, el2) => {
      const a = (el2 as any).attribs ?? {};
      const text = $(el2).text().trim().slice(0, 100);
      confirmElements.push({ tag: (el2 as any).name, attrs: a, text });
    });
    return res.json({ date, attrs, confirmElements: confirmElements.slice(0, 10), fullHtml: html.slice(0, 5000) });
  } catch (e) {
    return res.status(502).json({ error: String(e) });
  }
});

// ── Debug: reset timecard status in DB ────────────────
app.post('/debug/reset-timecard-status', async (req, res) => {
  try {
    const { date, status } = req.body as { date?: string; status?: string };
    if (!date || !status) return res.status(400).json({ error: 'date and status required' });
    const result = await prisma.shift.updateMany({ where: { date }, data: { timecardStatus: status } });
    return res.json({ updated: result.count, date, status });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

// ── Portal health check ───────────────────────────────
app.get('/portal/health', async (_req, res) => {
  try {
    const health = await portalHealthCheck();
    return res.json({ ...health, lastSyncAt });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e), lastSyncAt });
  }
});

// POST /portal/confirm-timecards-bulk
// Body: { dates: string[], delayMs?: number }
// Zwraca: { results: Array<{ date: string, success: boolean, message?: string }> }
app.post('/portal/confirm-timecards-bulk', requireAuth, async (req: AuthRequest, res) => {
  const { dates, delayMs = 8000 } = req.body as { dates?: string[]; delayMs?: number };
  if (!Array.isArray(dates) || dates.length === 0) {
    return res.status(400).json({ error: 'dates[] is required' });
  }

  const tenantId = req.tenantId!;
  const { username, token } = await portalSessionForTenant(tenantId);
  const results: Array<{ date: string; success: boolean; message?: string; debug?: object }> = [];

  for (const date of dates) {
    try {
      const html = await fetchDutyDetails(token, date, username);
      const details = parseDutyDetails(html);
      if (!details || !details.allocationId) {
        results.push({ date, success: false, message: details ? 'Brak allocationId w karcie' : 'Nie znaleziono służby' });
      } else if (!details.needsConfirmation) {
        results.push({ date, success: false, message: 'Karta nie jest gotowa do potwierdzenia przez API — potwierdź ręcznie na portalu.intercity.pl i użyj przycisku Odśwież' });
      } else {
        const httpResult = await confirmAllocationHttp(token, details.allocationId, details.employeeId, username);
        console.log(`[BulkConfirm] ${date}: status=${httpResult.status} body=${httpResult.body.slice(0, 200)}`);
        if (httpResult.success) {
          await prisma.shift.updateMany({ where: { tenantId, date }, data: { timecardStatus: 'zatwierdzona' } });
          results.push({ date, success: true, message: 'OK (HTTP)', debug: { status: httpResult.status, body: httpResult.body.slice(0, 200), json: httpResult.json } });
        } else {
          // Playwright fallback: browser context provides bm_sv Akamai cookie needed for confirmation
          console.log(`[BulkConfirm] ${date}: HTTP failed, trying Playwright...`);
          try {
            const { confirmTimecardPlaywright } = await import('./services/portal-browser');
            const pwResult = await confirmTimecardPlaywright(date, details.allocationId, token);
            console.log(`[BulkConfirm] ${date}: Playwright result: ${JSON.stringify(pwResult)}`);
            if (pwResult.success) {
              await prisma.shift.updateMany({ where: { tenantId, date }, data: { timecardStatus: 'zatwierdzona' } });
              results.push({ date, success: true, message: pwResult.message });
            } else {
              results.push({ date, success: false, message: pwResult.message });
            }
          } catch (pwError) {
            console.error(`[BulkConfirm] ${date}: Playwright unavailable:`, pwError);
            results.push({ date, success: false, message: `HTTP failed (${httpResult.status}), Playwright: ${String(pwError)}` });
          }
        }
      }
    } catch (e) {
      results.push({ date, success: false, message: String(e) });
    }
    if (date !== dates[dates.length - 1]) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  return res.json({ results });
});

// ── Portal confirm timecard ───────────────────────────
app.post('/portal/confirm-timecard', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { date } = req.body as { date?: string };
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'date (YYYY-MM-DD) is required' });
    }

    const tenantId = req.tenantId!;
    const { username, token } = await portalSessionForTenant(tenantId);
    const html = await fetchDutyDetails(token, date, username);
    const details = parseDutyDetails(html);

    if (!details) {
      return res.status(404).json({ error: 'No duty found for this date' });
    }

    console.log(`[Confirm] parseDutyDetails for ${date}:`, JSON.stringify({ needsConfirmation: details.needsConfirmation, allocationId: details.allocationId, confirmUrl: details.confirmUrl }));
    if (!details.needsConfirmation) {
      return res.json({ success: false, message: 'Timecard does not need confirmation', date });
    }

    const allocationId = details.allocationId;
    if (!allocationId) {
      return res.status(404).json({ error: 'No allocation ID found' });
    }

    // Attempt 1: HTTP POST (fast, may be blocked by Akamai)
    console.log(`[Confirm] Attempting HTTP confirm for ${date} (allocation: ${allocationId}, employee: ${details.employeeId})`);
    const httpResult = await confirmAllocationHttp(token, allocationId, details.employeeId, username);
    console.log(`[Confirm] HTTP result for ${date}:`, JSON.stringify({ success: httpResult.success, status: httpResult.status, body: httpResult.body.slice(0, 300) }));

    if (httpResult.success) {
      await prisma.shift.updateMany({
        where: { tenantId, date },
        data: { timecardStatus: 'zatwierdzona' },
      });
      return res.json({ success: true, method: 'http', message: `Confirmed for ${date}`, date });
    }

    // Attempt 2: Playwright (browser context bypasses Akamai)
    console.log(`[Confirm] HTTP failed (${httpResult.status}), trying Playwright...`);
    try {
      const { confirmTimecardPlaywright } = await import('./services/portal-browser');
      const pwResult = await confirmTimecardPlaywright(date, allocationId, token);

      if (pwResult.success) {
        await prisma.shift.updateMany({
          where: { tenantId, date },
          data: { timecardStatus: 'zatwierdzona' },
        });
        return res.json({ success: true, method: 'playwright', message: pwResult.message, date });
      }

      return res.json({ success: false, message: pwResult.message, date });
    } catch (pwError) {
      console.error('[Confirm] Playwright unavailable:', pwError);
      return res.json({
        success: false,
        message: `HTTP failed (${httpResult.status}), Playwright unavailable: ${String(pwError)}`,
        date,
      });
    }
  } catch (e) {
    return res.status(502).json({ error: 'Confirmation failed', detail: onPortalAuthError(e, req.portalUsername) });
  }
});

// ── Message templates ──────────────────────────────────
app.get('/templates/messages', requireAuth, async (_req, res) => {
  try {
    const data = await fs.readFile(path.join(TEMPLATES_DIR, 'messages.json'), 'utf8');
    res.json(JSON.parse(data));
  } catch {
    res.json([]);
  }
});

// ── PLK API proxy: train search ────────────────────────
app.get('/trains/search', requireAuth, async (req, res) => {
  const { number, date } = req.query as { number?: string; date?: string };
  if (!number || !date) return res.status(400).json({ error: 'number and date required' });
  try {
    const data = await plkFetch(`/schedules?dateFrom=${date}&dateTo=${date}`) as any;
    const routes: any[] = data?.routes ?? [];
    const train = routes.find((s: any) =>
      String(s.nationalNumber) === String(number) ||
      String(s.trainNumber) === String(number)
    );
    if (!train) return res.status(404).json({ error: 'Nie znaleziono pociągu' });
    const stations: any[] = train.stations ?? [];
    const first = stations[0];
    const last = stations[stations.length - 1];
    return res.json({
      orderId: train.orderId,
      scheduleId: train.scheduleId,
      number: train.nationalNumber ?? train.trainNumber,
      category: train.commercialCategorySymbol ?? '',
      carrier: train.carrierCode ?? '',
      name: train.name ?? '',
      from: stacjaName(first?.stationId),
      to: stacjaName(last?.stationId),
      departureTime: first?.departureTime?.slice(0, 5) ?? '',
      arrivalTime: last?.arrivalTime?.slice(0, 5) ?? '',
      stations: stations.map((s: any) => ({
        name: stacjaName(s.stationId),
        arrivalPlanned: s.arrivalTime?.slice(0, 5),
        departurePlanned: s.departureTime?.slice(0, 5),
        confirmed: false,
      })),
    });
  } catch (e) {
    return res.status(502).json({ error: 'PLK API niedostępne', detail: String(e) });
  }
});

// ── PLK API proxy: train live position ────────────────
app.get('/trains/:orderId/live', requireAuth, async (req, res) => {
  const { orderId } = req.params;
  const { scheduleId, date } = req.query as { scheduleId?: string; date?: string };
  try {
    let trainData: any;
    if (scheduleId && date) {
      // Targeted endpoint — 1 request for this specific train
      const data = await plkFetch(`/operations/train/${scheduleId}/${orderId}/${date}`) as any;
      const trains: any[] = data?.trains ?? data?.data?.trains ?? [];
      trainData = trains[0];
    } else {
      // Fallback: scan all IC operations (less efficient, kept for compatibility)
      const data = await plkFetch(`/operations?carriersInclude=IC&withPlanned=true&orderId=${orderId}`) as any;
      const trains: any[] = data?.trains ?? [];
      trainData = trains.find((o: any) => String(o.orderId) === String(orderId));
    }
    if (!trainData) return res.status(404).json({ error: 'Brak danych live' });
    const stations: any[] = trainData.stations ?? [];
    const confirmed = stations.filter((s: any) => s.isConfirmed);
    const last = confirmed[confirmed.length - 1];
    const delay = last?.departureDelayMinutes ?? last?.arrivalDelayMinutes ?? 0;
    return res.json({
      orderId,
      currentStation: stacjaName(last?.stationId ?? ''),
      delay: Math.max(0, delay),
      stations: stations.map((s: any) => ({
        name: stacjaName(s.stationId),
        arrivalPlanned: fmtTime(undefined, s.plannedArrival),
        departurePlanned: fmtTime(undefined, s.plannedDeparture),
        arrivalActual: fmtTime(s.actualArrival, undefined),
        departureActual: fmtTime(s.actualDeparture, undefined),
        confirmed: s.isConfirmed ?? false,
      })),
    });
  } catch (e) {
    return res.status(502).json({ error: 'PLK API niedostępne', detail: String(e) });
  }
});


// ── Station timetable (PLK ODK API) ──────────────────
const PLK_API_KEY = process.env.PLK_API_KEY ?? '';
const PLK_BASE = 'https://pdp-api.plk-sa.pl/api/v1';

type PlkStop = {
  stationId: number;
  orderNumber: number;
  arrivalTime?: string;
  departureTime?: string;
  arrivalPlatform?: string;
  departurePlatform?: string;
  arrivalTrack?: string;
  departureTrack?: string;
};

type PlkRoute = {
  scheduleId: number;
  orderId: number;
  name?: string;
  nationalNumber: string;
  commercialCategorySymbol: string;
  carrierCode: string;
  stations: PlkStop[];
};

type PlkOpStation = {
  stationId: number;
  actualDeparture?: string;
  actualArrival?: string;
};

type PlkOp = {
  orderId: number;
  trainStatus?: string;
  stations: PlkOpStation[];
};

// ─── Full schedule cache (per day, ~34MB, fetched once) ───────────────────────
type ScheduleCache = {
  date: string;
  routes: PlkRoute[];
  stationsDict: Record<string, { id: number; name: string }>;
  // stationId → sorted stops list (orderNumber asc) with route ref
  stationIndex: Map<number, { route: PlkRoute; stop: PlkStop }[]>;
};

let scheduleCache: ScheduleCache | null = null;
let scheduleFetching = false;
let scheduleFetchQueue: (() => void)[] = [];

async function getScheduleCache(date: string): Promise<ScheduleCache> {
  if (scheduleCache && scheduleCache.date === date) return scheduleCache;

  // If already fetching, wait
  if (scheduleFetching) {
    await new Promise<void>(resolve => scheduleFetchQueue.push(resolve));
    return scheduleCache!;
  }

  scheduleFetching = true;
  console.log(`[PLK] Fetching full schedule for ${date}...`);

  const r = await fetch(`${PLK_BASE}/schedules?dateFrom=${date}&dateTo=${date}`, {
    headers: { 'X-API-Key': PLK_API_KEY },
  });
  const json = await r.json() as { routes: PlkRoute[]; dictionaries: { stations: Record<string, { id: number; name: string }> } };

  const routes = json.routes ?? [];
  const stationsDict = json.dictionaries?.stations ?? {};

  // Build station index
  const SKIP_CATEGORIES = new Set(['BUS', 'ZKA', 'ZKB']);
  const stationIndex = new Map<number, { route: PlkRoute; stop: PlkStop }[]>();

  for (const route of routes) {
    if (SKIP_CATEGORIES.has(route.commercialCategorySymbol)) continue;
    for (const stop of route.stations) {
      const list = stationIndex.get(stop.stationId) ?? [];
      list.push({ route, stop });
      stationIndex.set(stop.stationId, list);
    }
  }

  scheduleCache = { date, routes, stationsDict, stationIndex };
  console.log(`[PLK] Schedule cached: ${routes.length} routes, ${stationIndex.size} stations`);

  scheduleFetching = false;
  scheduleFetchQueue.forEach(r => r());
  scheduleFetchQueue = [];

  return scheduleCache;
}

// ─── Station search (uses full stations dict from cache or dict endpoint) ─────
let stationsDictCache: { ts: number; data: { id: number; name: string }[] } | null = null;

async function getStationsDict(): Promise<{ id: number; name: string }[]> {
  if (stationsDictCache && Date.now() - stationsDictCache.ts < 86400_000) return stationsDictCache.data;
  const r = await fetch(`${PLK_BASE}/dictionaries/stations`, { headers: { 'X-API-Key': PLK_API_KEY } });
  const json = await r.json() as { stations: { id: number; name: string }[] };
  stationsDictCache = { ts: Date.now(), data: json.stations };
  return json.stations;
}

function normStr(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

app.get('/station/search', requireAuth, async (req, res) => {
  const q = normStr(String(req.query.q ?? '').trim());
  if (!q || q.length < 2) return res.json([]);
  try {
    // Use schedule cache dict if available (more complete), fall back to dict endpoint
    let stations: { id: number; name: string }[];
    if (scheduleCache) {
      stations = Object.values(scheduleCache.stationsDict);
    } else {
      stations = await getStationsDict();
    }
    const results = stations
      .filter(s => normStr(s.name).includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'pl'))
      .slice(0, 20);
    return res.json(results);
  } catch {
    return res.status(500).json({ error: 'PLK API error' });
  }
});

app.get('/station/timetable', requireAuth, async (req, res) => {
  const stationId = Number(req.query.stationId);
  if (!stationId) return res.status(400).json({ error: 'stationId required' });

  const date = String(req.query.date ?? new Date().toISOString().slice(0, 10));
  const type = String(req.query.type ?? 'departure');
  const fromTime = String(req.query.fromTime ?? '00:00'); // HH:MM, '' = full day

  try {
    const [cache, opsRes] = await Promise.all([
      getScheduleCache(date),
      fetch(`${PLK_BASE}/operations?stations=${stationId}&dateFrom=${date}&dateTo=${date}`, {
        headers: { 'X-API-Key': PLK_API_KEY },
      }),
    ]);

    const opsJson = await opsRes.json() as { trains: PlkOp[] };
    const opsIndex = new Map<number, PlkOp>();
    for (const op of (opsJson.trains ?? [])) opsIndex.set(op.orderId, op);

    const stationName = (id: number) => cache.stationsDict[String(id)]?.name ?? String(id);

    const routesAtStation = cache.stationIndex.get(stationId) ?? [];
    const entries = [];

    for (const { route, stop } of routesAtStation) {
      const scheduledTime = type === 'departure' ? stop.departureTime : stop.arrivalTime;
      if (!scheduledTime) continue;

      // Full route stops sorted
      const sorted = [...route.stations].sort((a, b) => a.orderNumber - b.orderNumber);

      // Direction: next terminus after/before this stop
      let directionId: number;
      if (type === 'departure') {
        const after = sorted.filter(s => s.orderNumber > stop.orderNumber);
        directionId = after.length > 0 ? after[after.length - 1].stationId : sorted[sorted.length - 1].stationId;
      } else {
        const before = sorted.filter(s => s.orderNumber < stop.orderNumber);
        directionId = before.length > 0 ? before[0].stationId : sorted[0].stationId;
      }

      const op = opsIndex.get(route.orderId);
      const opStop = op?.stations.find(s => s.stationId === stationId);
      const actualTime = type === 'departure' ? opStop?.actualDeparture : opStop?.actualArrival;
      // PLK: 'C' = completed (pociąg przejechał), nie odwołany. Odwołane pociągi mają inny status.
      const CANCELLED_STATUSES = ['ODWOŁANY', 'CANCELLED', 'X', 'K'];
      const cancelled = CANCELLED_STATUSES.includes(op?.trainStatus ?? '');

      let delayMin = 0;
      if (actualTime) {
        const [h, m, s] = scheduledTime.split(':').map(Number);
        const scheduledMs = (h * 3600 + m * 60 + (s ?? 0)) * 1000;
        const actualDate = new Date(actualTime);
        const actualMs = (actualDate.getUTCHours() * 3600 + actualDate.getUTCMinutes() * 60 + actualDate.getUTCSeconds()) * 1000;
        delayMin = Math.round((actualMs - scheduledMs) / 60000);
      }

      entries.push({
        orderId: route.orderId,
        trainNumber: route.nationalNumber,
        name: route.name ?? null,
        category: route.commercialCategorySymbol,
        carrier: route.carrierCode,
        scheduledTime: scheduledTime.slice(0, 5),
        actualTime: actualTime ? new Date(actualTime).toISOString().slice(11, 16) : null,
        delayMin,
        direction: stationName(directionId),
        platform: type === 'departure' ? (stop.departurePlatform ?? null) : (stop.arrivalPlatform ?? null),
        track: type === 'departure' ? (stop.departureTrack ?? null) : (stop.arrivalTrack ?? null),
        cancelled: cancelled ?? false,
      });
    }

    entries.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
    const result = fromTime > '00:00'
      ? entries.filter(e => e.scheduledTime >= fromTime)
      : entries;
    return res.json(result);
  } catch (e) {
    console.error('station/timetable error:', e);
    return res.status(500).json({ error: 'PLK API error' });
  }
});

// ── Start ────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Kolejarz Backend running on port ${PORT}`);
});
