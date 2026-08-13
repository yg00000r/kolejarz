import * as Notifications from 'expo-notifications';
import { apiFetch } from './api';

export type ShiftTyp = 'praca' | 'inne' | 'wolne' | 'l4' | 'nieznany';

export type Shift = {
  date: string;        // YYYY-MM-DD
  sluzba: string;      // raw: KWR312, S, WZ, ...
  start?: string;      // HH:MM
  end?: string;        // HH:MM
  opis: string;        // "Konduktor zastępczy"
  skrot: string;       // "K2"
  typ: ShiftTyp;
  kod: string;         // same as sluzba
  statusKarty?: string | null;
};

export type SluzbaDef = {
  opis: string;
  skrot: string;
  typ: ShiftTyp;
};

/**
 * Reads the monthly schedule from the backend database (not directly from the portal).
 * The backend must have synced first via `syncShifts()` or the background cron.
 */
export async function fetchShifts(month: number, year: number): Promise<Shift[]> {
  const res = await apiFetch(`/shifts?month=${month}&year=${year}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchNextShift(): Promise<Shift | null> {
  const res = await apiFetch(`/shifts/next`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchSluzbyDict(): Promise<Record<string, SluzbaDef>> {
  const res = await apiFetch(`/shifts/sluzby`);
  if (!res.ok) return {};
  return res.json();
}

export type MessageTemplate = {
  id: string;
  category: string;
  priority?: string;
  title: string;
  subtitle?: string;
  channel?: string;
  text: string;
  placeholders?: Array<{ key: string; label: string; hint?: string }>;
  tags?: string[];
  order?: number;
};

export async function fetchMessageTemplates(): Promise<MessageTemplate[]> {
  const res = await apiFetch(`/templates/messages`);
  if (!res.ok) return [];
  return res.json();
}

export type TrainStation = {
  name: string;
  arrivalPlanned?: string;
  departurePlanned?: string;
  arrivalActual?: string;
  departureActual?: string;
  confirmed: boolean;
};

export type TrainSearchResult = {
  orderId: string;
  scheduleId: string;
  number: string;
  category: string;
  carrier: string;
  name: string;
  from: string;
  to: string;
  departureTime: string;
  arrivalTime: string;
  stations: TrainStation[];
};

export type TrainLive = {
  orderId: string;
  currentStation: string;
  delay: number;
  stations: TrainStation[];
};

export async function searchTrain(number: string, date: string): Promise<TrainSearchResult> {
  const res = await apiFetch(`/trains/search?number=${encodeURIComponent(number)}&date=${date}`);
  if (res.status === 404) throw new Error('Nie znaleziono pociągu');
  if (!res.ok) throw new Error('PLK API niedostępne');
  return res.json();
}

export async function fetchTrainLive(orderId: string, scheduleId?: string, date?: string): Promise<TrainLive> {
  const params = new URLSearchParams();
  if (scheduleId) params.set('scheduleId', scheduleId);
  if (date) params.set('date', date);
  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await apiFetch(`/trains/${encodeURIComponent(orderId)}/live${query}`);
  if (res.status === 404) throw new Error('Brak danych live');
  if (!res.ok) throw new Error('PLK API niedostępne');
  return res.json();
}

// ── Portal: Duty Details ──────────────────────────────

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
  confirmUrl: string | null;
  rejectUrl: string | null;
  needsConfirmation: boolean;
  components: DutyComponent[];
};

/**
 * Fetches a breakdown of a single duty day directly from the IVU portal
 * (via the backend proxy). Returns individual trip/task components
 * (e.g. "Prep → Warszawa → Łódź → Return") plus timecard status and
 * whether it can be confirmed via HTTP POST.
 */
export async function fetchDutyDetails(date: string): Promise<DutyDetails> {
  const res = await apiFetch(`/shifts/${date}/details`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Portal: Messages ─────────────────────────────────

export type PortalMessage = {
  id: string;
  subject: string;
  sender: string;
  body: string;
  timestamp: string;
  unread: boolean;
  monthGroup: string;
};

export type PortalMessagesResponse = {
  page: number;
  messages: PortalMessage[];
  nextPage: string | null;
};

export async function fetchPortalMessages(page = 1): Promise<PortalMessagesResponse> {
  const res = await apiFetch(`/portal/messages?page=${page}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Portal: Account Balances ─────────────────────────

export type AccountBalance = {
  name: string;
  value: string;
  referenceDate: string;
};

export async function fetchAccounts(): Promise<{ accounts: AccountBalance[] }> {
  const res = await apiFetch(`/portal/accounts`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Portal: Crew on Trip (załoga pociągu) ─────────────

export type CrewSegment = {
  startTime: string | null;
  startStation: string | null;
  endTime: string | null;
  endStation: string | null;
};

export type CrewMember = {
  name: string;
  crewType: string | null;
  role: string;
  phone: string | null;
  segment: CrewSegment;
};

export type CrewOnTrip = {
  tripNumber: string;
  fromStation: string | null;
  toStation: string | null;
  startTime: string | null;
  endTime: string | null;
  members: CrewMember[];
  notFound?: boolean;
};

/**
 * Fetches the crew (kierownik, konduktorzy, maszyniści) assigned to a train
 * on a given date, via the backend `/crew` proxy (IVU `_-crew-on-trip-table`).
 */
export async function fetchCrewOnTrip(date: string, trip: string): Promise<CrewOnTrip> {
  const res = await apiFetch(`/crew?date=${date}&trip=${encodeURIComponent(trip)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Sync ─────────────────────────────────────────────

/**
 * Maps a raw backend error string (from portal.ts / index.ts, e.g. "Portal login
 * failed: 503 ...", "fetch failed", "auth expired") to a user-facing Polish
 * message that distinguishes "problem z portalem" from "problem sieciowy",
 * instead of a generic "coś nie zadziałało".
 */
function classifySyncErrorDetail(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes('login failed') || s.includes('auth expired') || s.includes('unauthorized')) {
    return 'Nie udało się zalogować do portalu IVU — sprawdź dane konta w Ustawieniach (mogło się zmienić hasło).';
  }
  if (s.includes('503') || s.includes('akamai') || s.includes('edgesuite') || s.includes('portal login failed')) {
    return 'Portal IVU tymczasowo blokuje żądania z naszego serwera (znany problem — KB-002). Spróbuj ponownie za kilka minut.';
  }
  if (s.includes('fetch failed') || s.includes('econnrefused') || s.includes('etimedout') || s.includes('enotfound') || s.includes('network')) {
    return 'Backend nie mógł połączyć się z portalem IVU — problem sieciowy po stronie serwera. Spróbuj ponownie.';
  }
  return raw;
}

/** Parses a failed sync response's JSON body ({ error, detail }) into a classified, user-facing Error. */
async function syncApiError(res: Response, fallback: string): Promise<Error> {
  try {
    const data = (await res.json()) as { error?: string; detail?: string };
    const raw = data.detail ?? data.error;
    return new Error(raw ? classifySyncErrorDetail(String(raw)) : fallback);
  } catch {
    return new Error(fallback);
  }
}

/**
 * Triggers a portal sync on the backend — the backend logs into IVU portal,
 * fetches the monthly schedule HTML, parses it and upserts into the database.
 * Returns the number of shifts upserted.
 * When called without arguments, syncs the current and next month.
 */
export async function syncShifts(month?: number, year?: number): Promise<{ count: number }> {
  const body = month && year ? JSON.stringify({ month, year }) : undefined;
  const res = await apiFetch(`/shifts/sync`, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body,
  });
  if (!res.ok) throw await syncApiError(res, `Nie udało się zsynchronizować grafiku (HTTP ${res.status})`);
  return res.json();
}

export async function confirmTimecard(date: string): Promise<{ success: boolean; message?: string }> {
  const res = await apiFetch(`/portal/confirm-timecard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export type TimecardConfirmResult = {
  date: string;
  success: boolean;
  message?: string;
  debug?: Record<string, unknown>;
};

export async function syncPortalStatus(): Promise<{ success: boolean; synced: number }> {
  const res = await apiFetch(`/portal/sync`, { method: 'POST' });
  if (!res.ok) throw await syncApiError(res, `Nie udało się zsynchronizować z portalem (HTTP ${res.status})`);
  return res.json();
}

export type RouteControlStatus = 'ok' | 'missing_last_driven' | 'paper_due' | 'expires_soon' | 'expired';

export type RouteControlComputed = {
  status: RouteControlStatus;
  updateDeadline: string | null;
  paperDeadline: string | null;
  expiresAt: string | null;
  reportToChiefAt: string | null;
  daysToExpiry: number | null;
};

export type RouteControl = {
  id: number;
  routeDefinitionId: number;
  acquiredAt: string;
  lastDrivenAt: string | null;
  paperSubmittedAt: string | null;
  digitalCopyUri: string | null;
  notes: string | null;
  computed: RouteControlComputed;
};

export type RouteControlRoute = {
  id: number;
  name: string;
  description: string | null;
  active: boolean;
  control: RouteControl | null;
};

async function routeApiError(res: Response, fallback: string): Promise<Error> {
  try {
    const data = await res.json() as { error?: string; detail?: string };
    const msg = data.detail ?? data.error;
    return new Error(msg ? String(msg) : fallback);
  } catch {
    return new Error(fallback);
  }
}

export async function fetchRouteControls(): Promise<RouteControlRoute[]> {
  const res = await apiFetch(`/route-controls`);
  if (!res.ok) throw await routeApiError(res, `Nie udało się pobrać kontrolek (HTTP ${res.status})`);
  const data = await res.json() as { routes: RouteControlRoute[] };
  return data.routes;
}

export async function createRouteDefinition(name: string, description?: string): Promise<RouteControlRoute> {
  const res = await apiFetch(`/route-definitions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description }),
  });
  if (!res.ok) throw await routeApiError(res, `Nie udało się utworzyć szlaku (HTTP ${res.status})`);
  return res.json();
}

export async function createRouteControl(input: {
  routeDefinitionId: number;
  acquiredAt: string;
  lastDrivenAt?: string | null;
  paperSubmittedAt?: string | null;
  digitalCopyUri?: string | null;
  notes?: string | null;
}): Promise<RouteControl> {
  const res = await apiFetch(`/route-controls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await routeApiError(res, `Nie udało się utworzyć kontrolki (HTTP ${res.status})`);
  return res.json();
}

export async function updateRouteControl(id: number, patch: Partial<{
  acquiredAt: string | null;
  lastDrivenAt: string | null;
  paperSubmittedAt: string | null;
  digitalCopyUri: string | null;
  notes: string | null;
}>): Promise<RouteControl> {
  const res = await apiFetch(`/route-controls/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw await routeApiError(res, `Nie udało się zaktualizować kontrolki (HTTP ${res.status})`);
  return res.json();
}

export async function confirmTimecardsBulk(
  dates: string[],
  delayMs = 8000,
): Promise<TimecardConfirmResult[]> {
  const res = await apiFetch(`/portal/confirm-timecards-bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dates, delayMs }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as { results: TimecardConfirmResult[] };
  return data.results;
}

export async function scheduleTimecardReminder(shift: Shift): Promise<void> {
  if (!shift.end || shift.statusKarty !== 'do_potwierdzenia') return;

  const endClean = shift.end.replace(/\+$/, '');
  const parts = endClean.split(':').map(Number);
  if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return;
  const [hours, minutes] = parts;

  const triggerDate = new Date(shift.date + 'T00:00:00');
  triggerDate.setHours(hours, minutes + 15, 0, 0);

  if (triggerDate <= new Date()) return;

  const id = `timecard-${shift.date}`;
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});

  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: {
      title: 'Karta pracy',
      body: `Czy wysłać kartę za ${shift.sluzba} (${shift.date})?`,
      data: { date: shift.date, shiftCode: shift.sluzba, type: 'timecard' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });
}
