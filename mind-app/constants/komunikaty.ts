// ─── Typy danych sesji pociągu ────────────────────────────────────────────────

export type GastroType =
  | 'wars'               // tylko WARS
  | 'wars_automat'       // WARS + automat vendingowy
  | 'automat'            // tylko automat (bez WARS)
  | 'minibar'            // tylko wózek mini-bar
  | 'brak_zastepstwo'    // wyjątkowo brak WARS, ale jest mini-bar lub automat
  | 'brak_bez_zastepstwa' // wyjątkowo brak WARS, brak zastępstwa
  | 'brak';              // całkowity brak oferty gastronomicznej

export type MinibarSegment = {
  startIndex: number;
  endIndex: number;
};

export type TrainSession = {
  trainNumber: string;
  category: string;        // IC, TLK, EIC, EIP, ...
  trainName: string;
  stationStart: string;
  stationEnd: string;
  stationsVia: string;     // free text: "Kielce, Radom"
  serviceWagon: string;
  gastroType: GastroType;
  gastroWarsWagon: string;
  gastroWarsEndStation: string;   // "" jeśli pełna trasa
  gastroAutomatWagon: string;
  gastroMinibarEndStation: string;
};

export const EMPTY_SESSION: TrainSession = {
  trainNumber: '',
  category: 'IC',
  trainName: '',
  stationStart: '',
  stationEnd: '',
  stationsVia: '',
  serviceWagon: '',
  gastroType: 'brak',
  gastroWarsWagon: '',
  gastroWarsEndStation: '',
  gastroAutomatWagon: '',
  gastroMinibarEndStation: '',
};

// ─── Rozszerzona sesja (Pilnowanie — import z PLK) ───────────────────────────

export type TrainStop = {
  name: string;
  arrivalPlanned?: string;    // HH:MM
  departurePlanned?: string;  // HH:MM
  orderIndex: number;
};

export type TrainRunSession = {
  version: 2;

  orderId?: string;
  scheduleId?: string;
  date: string;               // YYYY-MM-DD

  trainNumber: string;
  category: string;
  trainName: string;
  stationFrom: string;
  stationTo: string;
  stationsVia: string;

  stops: TrainStop[];

  workStartIndex: number;
  workEndIndex: number;

  serviceWagon: string;
  gastroType: GastroType;
  gastroWarsWagon: string;
  gastroWarsEndStation: string;
  gastroAutomatWagon: string;
  gastroMinibarEndStation: string;
  minibarSegments: MinibarSegment[];

  currentStopIndex: number;
  delayMinutes: number;
};

export const EMPTY_RUN_SESSION: TrainRunSession = {
  version: 2,
  date: '',
  trainNumber: '',
  category: 'IC',
  trainName: '',
  stationFrom: '',
  stationTo: '',
  stationsVia: '',
  stops: [],
  workStartIndex: 0,
  workEndIndex: 0,
  serviceWagon: '',
  gastroType: 'brak',
  gastroWarsWagon: '',
  gastroWarsEndStation: '',
  gastroAutomatWagon: '',
  gastroMinibarEndStation: '',
  minibarSegments: [],
  currentStopIndex: 0,
  delayMinutes: 0,
};

export function runSessionToTrainSession(run: TrainRunSession): TrainSession {
  return {
    trainNumber: run.trainNumber,
    category: run.category,
    trainName: run.trainName,
    stationStart: run.stationFrom,
    stationEnd: run.stationTo,
    stationsVia: run.stationsVia,
    serviceWagon: run.serviceWagon,
    gastroType: run.gastroType,
    gastroWarsWagon: run.gastroWarsWagon,
    gastroWarsEndStation: run.gastroWarsEndStation,
    gastroAutomatWagon: run.gastroAutomatWagon,
    gastroMinibarEndStation: run.gastroMinibarEndStation,
  };
}

export function workStops(run: TrainRunSession): TrainStop[] {
  return run.stops.slice(run.workStartIndex, run.workEndIndex + 1);
}

// ─── Katalog przyczyn opóźnień ────────────────────────────────────────────────

export type DelayReasonEntry = {
  id: number;
  group: 'awarie' | 'inne' | 'klimat' | 'podrozni' | 'ruch' | 'techniczne';
  pl: string;
  en: string;
  desc: string;
};

export const DELAY_REASONS_CATALOG: DelayReasonEntry[] = [
  { id: 1,  group: 'awarie',     pl: 'awarią taboru',                                                              en: 'a rolling stock failure',                                                      desc: 'defekt pojazdu trakcyjnego, wymiana lokomotywy/EZT' },
  { id: 2,  group: 'awarie',     pl: 'naprawą taboru',                                                             en: 'the repairment of the rolling stock',                                          desc: 'naprawa drzwi w składzie, naprawa taboru' },
  { id: 3,  group: 'awarie',     pl: 'weryfikacją stanu technicznego taboru',                                       en: 'the verification of the rolling stock\'s technical conditions',                 desc: 'oględziny taboru (DSAT, luzowanie)' },
  { id: 4,  group: 'awarie',     pl: 'włączaniem/wyłączaniem wagonu/-ów',                                          en: 'attaching/detaching cars/a car',                                               desc: 'włączanie/wyłączanie wagonów dodatkowych' },
  { id: 5,  group: 'awarie',     pl: 'wypadkiem powodującym przerwę w ruchu',                                      en: 'an accident causing an interruption in trains\' running',                      desc: 'inne wypadki kolejowe (warunki atmosferyczne)' },
  { id: 6,  group: 'awarie',     pl: 'wypadkiem z udziałem człowieka',                                             en: 'an accident involving a human being',                                          desc: 'wypadek z udziałem osoby postronnej' },
  { id: 7,  group: 'awarie',     pl: 'wypadkiem na przejeździe kolejowym',                                         en: 'an accident on a railway crossing',                                            desc: 'wypadek na przejeździe kolejowym' },
  { id: 8,  group: 'inne',       pl: 'akcją protestacyjną / ze strajkiem',                                         en: 'a protest / strike',                                                           desc: 'akcja protestacyjna / strajk' },
  { id: 9,  group: 'inne',       pl: 'zagrożeniem terrorystycznym',                                                en: 'a terrorist threat',                                                           desc: 'zagrożenie terrorystyczne' },
  { id: 10, group: 'inne',       pl: 'usuwaniem niewybuchu',                                                       en: 'the removal of unexploded material',                                           desc: 'usuwanie niewybuchu' },
  { id: 11, group: 'klimat',     pl: 'trudnymi warunkami atmosferycznymi',                                         en: 'the bad weather conditions',                                                   desc: 'trudne warunki atmosferyczne' },
  { id: 12, group: 'klimat',     pl: 'kolizją ze zwierzętami',                                                     en: 'a collision with an animal',                                                   desc: 'kolizja ze zwierzętami' },
  { id: 13, group: 'podrozni',   pl: 'interwencją służb porządkowych',                                             en: 'an intervention by law enforcement authorities',                               desc: 'interwencja służb porządkowych (Policja, SOK)' },
  { id: 14, group: 'podrozni',   pl: 'interwencją służb medycznych',                                               en: 'a medical intervention',                                                       desc: 'interwencja służb medycznych' },
  { id: 15, group: 'podrozni',   pl: 'interwencją straży pożarnej',                                                en: 'a fire emergency service intervention',                                        desc: 'interwencja straży pożarnej' },
  { id: 16, group: 'podrozni',   pl: 'lokowaniem dużej liczby podróżnych',                                         en: 'the placement of a large number of passengers',                                desc: 'lokowanie podróżnych (duża liczba pasażerów)' },
  { id: 17, group: 'podrozni',   pl: 'lokowaniem podróżnych',                                                      en: 'the placement of passengers',                                                  desc: 'wydłużone lokowanie OzN' },
  { id: 18, group: 'podrozni',   pl: 'oczekiwaniem na autobus Zastępczej Komunikacji Autobusowej',                 en: 'the awaiting for the bus replacement service',                                 desc: 'oczekiwanie na autobus ZKA' },
  { id: 19, group: 'podrozni',   pl: 'wydawaniem przesyłek konduktorskich',                                        en: 'the delivery of a conductor shipment',                                         desc: 'wydawanie przesyłek konduktorskich' },
  { id: 20, group: 'ruch',       pl: 'oczekiwaniem na podróżnych z innego pociągu',                                en: 'the awaiting for passengers from another train',                               desc: 'oczekiwanie na skomunikowanie' },
  { id: 21, group: 'ruch',       pl: 'oczekiwaniem na podróżnych z innego pociągu ze względu na nieplanowane skomunikowanie', en: 'the awaiting for passengers from another train and the unplanned communication of trains', desc: 'skomunikowanie nieuzgodnione' },
  { id: 22, group: 'ruch',       pl: 'dodatkowymi nieprzewidzianymi postojami',                                     en: 'additional unscheduled stops',                                                 desc: 'dodatkowe postoje' },
  { id: 23, group: 'ruch',       pl: 'awarią sieci trakcyjnej',                                                    en: 'the malfunction of the railway overhead wiring',                               desc: 'awaria sieci trakcyjnej' },
  { id: 28, group: 'techniczne', pl: 'brakiem napięcia w sieci trakcyjnej',                                        en: 'the lack of voltage in the railway overhead wiring',                           desc: 'brak napięcia w sieci' },
  { id: 29, group: 'techniczne', pl: 'awarią urządzeń sterowania ruchem kolejowym',                                en: 'the malfunction of the railway traffic control device',                        desc: 'awaria urządzeń sterowania ruchem' },
  { id: 32, group: 'techniczne', pl: 'pracą firmy usługowej',                                                      en: 'the works of the service company',                                             desc: 'praca firmy usługowej (np. sprzątanie)' },
];

export const DELAY_REASONS = DELAY_REASONS_CATALOG.map(r => r.pl);

export type DelayReason = string;

// ─── Lotniska ─────────────────────────────────────────────────────────────────

export const AIRPORT_STATIONS: { stations: string[]; airport: string }[] = [
  { stations: ['Lublin Główny', 'Świdnik Miasto'], airport: 'Portu Lotniczego Lublin' },
  { stations: ['Warszawa Wschodnia', 'Warszawa Zachodnia'], airport: 'Lotniska Chopina w Warszawie i Portu Lotniczego Warszawa-Modlin' },
  { stations: ['Warszawa Gdańska'], airport: 'Portu Lotniczego Warszawa-Modlin' },
  { stations: ['Częstochowa', 'Gliwice', 'Katowice', 'Zawiercie'], airport: 'Portu Lotniczego Katowice-Pyrzowice' },
  { stations: ['Kraków Główny'], airport: 'Portu Lotniczego Kraków-Balice' },
  { stations: ['Rzeszów Główny'], airport: 'Portu Lotniczego Rzeszów Jasionka' },
  { stations: ['Gdańsk Wrzeszcz', 'Gdynia Główna'], airport: 'Portu Lotniczego Gdańsk' },
  { stations: ['Olsztyn Główny'], airport: 'Portu Lotniczego Olsztyn-Mazury' },
  { stations: ['Szczecin Dąbie'], airport: 'Portu Lotniczego Szczecin Goleniów' },
];

export function airportForStation(station: string): string | null {
  const entry = AIRPORT_STATIONS.find(e =>
    e.stations.some(s => station.toLowerCase().includes(s.toLowerCase()))
  );
  return entry?.airport ?? null;
}

export const ALL_AIRPORT_STATIONS = AIRPORT_STATIONS.flatMap(e => e.stations);

// ─── Miasta wojewódzkie ──────────────────────────────────────────────────────

export const VOIVODESHIP_CAPITALS = [
  'Białystok', 'Bydgoszcz', 'Gdańsk', 'Gorzów Wielkopolski',
  'Katowice', 'Kielce', 'Kraków', 'Lublin', 'Łódź',
  'Olsztyn', 'Opole', 'Poznań', 'Rzeszów', 'Szczecin',
  'Toruń', 'Warszawa', 'Wrocław', 'Zielona Góra',
];

export function isVoivodeshipCapital(stationName: string): boolean {
  const lower = stationName.toLowerCase();
  return VOIVODESHIP_CAPITALS.some(city => lower.startsWith(city.toLowerCase()));
}

// ─── Pomocnicze: czas przejazdu / postoju ────────────────────────────────────

export function parseHHMM(hhmm: string | undefined): number | null {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

export function travelTimeMinutes(
  departureHHMM: string | undefined,
  arrivalHHMM: string | undefined,
): number | null {
  const dep = parseHHMM(departureHHMM);
  const arr = parseHHMM(arrivalHHMM);
  if (dep === null || arr === null) return null;
  let diff = arr - dep;
  if (diff < 0) diff += 24 * 60;
  return diff;
}

export function addMinutesToHHMM(hhmm: string | undefined, minutes: number): string | null {
  const total = parseHHMM(hhmm);
  if (total === null) return null;
  const adjusted = ((total + minutes) % (24 * 60) + 24 * 60) % (24 * 60);
  const hh = String(Math.floor(adjusted / 60)).padStart(2, '0');
  const mm = String(adjusted % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

// ─── Typy komunikatów ─────────────────────────────────────────────────────────

export type MessageTypeId =
  | 'p_start'
  | 'p_rozszerzony'
  | 'p_skrocony'
  | 'pp_pozegnalny'
  | 'pozegnalny'
  | 'a1_opoznienie'
  | 'a2_postoj'
  | 'a3_semafor'
  | 'a4_skomunikowanie'
  | 'c1_krotkie_perony'
  | 'c2_postoj_techniczny'
  | 'c3_zastepczy';

export type MessageTypeDef = {
  id: MessageTypeId;
  title: string;
  subtitle: string;
  category: 'Powitalne' | 'Pożegnalne' | 'Opóźnienia' | 'Specjalne';
  icon: string;
};

export const MESSAGE_TYPES: MessageTypeDef[] = [
  { id: 'p_start',         title: 'Powitalny startowy',          subtitle: 'Między stacjami w mieście startowym',         category: 'Powitalne',  icon: 'train' },
  { id: 'p_rozszerzony',   title: 'Powitalny rozszerzony',       subtitle: 'Za miastem woj., po przekroczeniu granicy',   category: 'Powitalne',  icon: 'microphone' },
  { id: 'p_skrocony',      title: 'Powitalny skrócony',          subtitle: 'Za miejscowością nie-woj.',                   category: 'Powitalne',  icon: 'microphone-outline' },
  { id: 'pp_pozegnalny',   title: 'Powitalno-pożegnalny',        subtitle: 'Tranzyt lub przejazd <7 min',                 category: 'Pożegnalne', icon: 'swap-horizontal' },
  { id: 'pozegnalny',      title: 'Pożegnalny',                  subtitle: 'Przed stacją końcową lub postojową',          category: 'Pożegnalne', icon: 'hand-wave-outline' },
  { id: 'a1_opoznienie',   title: 'A1 — Opóźnienie',             subtitle: 'Po powstaniu lub zmianie opóźnienia',         category: 'Opóźnienia', icon: 'clock-alert-outline' },
  { id: 'a2_postoj',       title: 'A2 — Przedłużony postój',     subtitle: 'Opóźniony odjazd ze stacji',                  category: 'Opóźnienia', icon: 'timer-sand' },
  { id: 'a3_semafor',      title: 'A3 — Przed semaforem',        subtitle: 'Zatrzymanie przed wjazdem na stację',         category: 'Opóźnienia', icon: 'traffic-light' },
  { id: 'a4_skomunikowanie', title: 'A4 — Skomunikowanie',       subtitle: 'Potwierdzenie lub odmowa oczekiwania',        category: 'Specjalne',  icon: 'transit-connection' },
  { id: 'c1_krotkie_perony', title: 'C1 — Krótkie perony',       subtitle: 'Wagony poza krawędzią peronową',              category: 'Specjalne',  icon: 'alert-outline' },
  { id: 'c2_postoj_techniczny', title: 'C2 — Postój techniczny', subtitle: 'Uwzględniony w rozkładzie',                  category: 'Specjalne',  icon: 'wrench-outline' },
  { id: 'c3_zastepczy',    title: 'C3 — Skład zastępczy',        subtitle: 'Wagony klasyczne zamiast EZT',                category: 'Specjalne',  icon: 'train-variant' },
];

// ─── Pomocnicze: tekst gastronomiczny ─────────────────────────────────────────

export function gastroText(s: TrainSession): string {
  switch (s.gastroType) {
    case 'wars':
      return `Zapraszamy do skorzystania z oferty gastronomicznej WARS, w wagonie numer ${s.gastroWarsWagon}.${s.gastroWarsEndStation ? ` Oferta gastronomiczna dostępna jest do stacji ${s.gastroWarsEndStation}.` : ''}`;
    case 'wars_automat':
      return `Zapraszamy do skorzystania z oferty gastronomicznej WARS w wagonie numer ${s.gastroWarsWagon} oraz do zakupu napojów i przekąsek w wagonie ${s.gastroAutomatWagon}.${s.gastroWarsEndStation ? ` Oferta gastronomiczna dostępna jest do stacji ${s.gastroWarsEndStation}.` : ''}`;
    case 'automat':
      return `Zapraszamy do zakupu napojów i przekąsek w automatach, w wagonie numer ${s.gastroAutomatWagon}.`;
    case 'minibar':
      return `Zapraszamy do zakupu napojów i przekąsek z wózka mini-bar.${s.gastroMinibarEndStation ? ` Oferta będzie dostępna do stacji ${s.gastroMinibarEndStation}.` : ''}`;
    case 'brak_zastepstwo':
      return `Informujemy, że w pociągu nie ma wagonu gastronomicznego, za co Państwa przepraszamy. Zakup napojów i przekąsek jest możliwy ${s.gastroAutomatWagon ? `w automatach vendingowych znajdujących się w wagonie ${s.gastroAutomatWagon}` : 'z wózka mini-bar'}.`;
    case 'brak_bez_zastepstwa':
      return 'Informujemy, że w pociągu nie ma wagonu gastronomicznego, za co Państwa przepraszamy.';
    case 'brak':
      return `Informujemy, że w pociągu oferta gastronomiczna jest niedostępna, za co Państwa przepraszamy.`;
    default:
      return '';
  }
}

export function hasGastro(s: TrainSession): boolean {
  return s.gastroType !== 'brak';
}

// ─── Pomocnicze: tekst opóźnienia ─────────────────────────────────────────────

export function delayText(reason: string, minutes: string, serviceWagon: string): string {
  return `Informujemy, że w związku z ${reason} pociąg jest opóźniony o ${minutes} minut. Przepraszamy za opóźnienie. Osoby przesiadające się do innych pociągów prosimy o zgłaszanie tego zamiaru drużynie konduktorskiej. Przedział konduktorski znajduje się w wagonie numer ${serviceWagon}.`;
}

// ─── Pomocnicze: tekst przesiadki + lotnisko ──────────────────────────────────

function transferText(transfers: boolean, zka: boolean, zkaStation: string, airport: boolean, airportStation: string): string {
  let parts: string[] = [];
  if (transfers) {
    let t = 'Na stacji można przesiąść się do pociągów dalekobieżnych, regionalnych lub podmiejskich.';
    if (zka && zkaStation) t += ` oraz do Zastępczej Komunikacji Autobusowej do stacji ${zkaStation}.`;
    parts.push(t);
  }
  if (airport && airportStation) {
    const ap = airportForStation(airportStation);
    parts.push(`Ze stacji ${airportStation} odjeżdżają pociągi w kierunku ${ap ?? airportStation}.`);
  }
  return parts.join('\n\n');
}

function wagonsDetachText(stationName: string, groupNumbers: string, groupStation: string, endWagons: string): string {
  return `Przypominamy, że na stacji ${stationName} pociąg zostanie rozłączony. Wagony z numerami ${groupNumbers} kursują do stacji ${groupStation}. Wagony z numerami ${endWagons} kończą bieg. W trakcie przestawiania wagonów prosimy o zachowanie szczególnej ostrożności.`;
}

// ─── GENERATORY KOMUNIKATÓW ───────────────────────────────────────────────────

// Powitalny-Startowy
export function generatePStart(p: { nextStation: string }, s: TrainSession): string {
  const parts: string[] = [];
  if (p.nextStation) parts.push(`Następna stacja: ${p.nextStation}.`);
  if (hasGastro(s)) parts.push(gastroText(s));
  return parts.join('\n\n');
}

// Powitalny-Rozszerzony
export type PozegnalnyParams = {
  nextStation: string;
  timeOfDay: 'dzien' | 'wieczor';
  groupWagons: boolean;
  groupWagonsStation: string;
  delayed: boolean;
  delayMinutes: string;
  delayReason: string;
  longStop: boolean;
  departureTime: string;
  transfers: boolean;
  zka: boolean;
  zkaStation: string;
  airport: boolean;
  airportStation: string;
  wagonsDetach: boolean;
  detachGroupNumbers: string;
  detachGroupStation: string;
  detachEndWagons: string;
};

function trainId(s: TrainSession): string {
  return [s.category, s.trainName, s.trainNumber].filter(Boolean).join(' ');
}

export function generatePRozszerzony(
  p: { nextStation: string; timeOfDay: 'dzien' | 'wieczor'; groupWagons: boolean; groupWagonsStation: string; delayed: boolean; delayMinutes: string; delayReason: string },
  s: TrainSession
): string {
  const parts: string[] = [];
  const greeting = p.timeOfDay === 'wieczor' ? 'Dobry wieczór.' : 'Dzień dobry.';
  parts.push(greeting);

  let welcome = `Witamy w pociągu ${trainId(s)}`;
  if (s.stationStart && s.stationEnd) {
    welcome += ` ze stacji ${s.stationStart} do stacji ${s.stationEnd}`;
    if (s.stationsVia) welcome += ` przez ${s.stationsVia}`;
  }
  welcome += '.';
  if (p.groupWagons && p.groupWagonsStation) {
    welcome += ` Pociąg prowadzi grupę wagonów do stacji ${p.groupWagonsStation}.`;
  }
  parts.push(welcome);

  if (p.nextStation) parts.push(`Następna stacja: ${p.nextStation}.`);

  if (p.delayed && p.delayMinutes && p.delayReason) {
    parts.push(delayText(p.delayReason, p.delayMinutes, s.serviceWagon));
  }

  const serviceInfo = s.serviceWagon
    ? `Drużyna konduktorska pozostaje do Państwa dyspozycji w trakcie całej podróży. Przedział konduktorski znajduje się w wagonie numer ${s.serviceWagon}.`
    : 'Drużyna konduktorska pozostaje do Państwa dyspozycji w trakcie całej podróży.';
  parts.push(`W trosce o Państwa komfort i bezpieczeństwo, prosimy o zapoznanie się z informacjami zamieszczonymi w wagonach. ${serviceInfo}`);

  if (hasGastro(s)) parts.push(gastroText(s));

  return parts.join('\n\n');
}

// Powitalny-Skrócony
export function generatePSkrocony(
  p: { nextStation: string; delayed: boolean; delayMinutes: string; delayReason: string },
  s: TrainSession
): string {
  const parts: string[] = [];
  parts.push(`Następna stacja: ${p.nextStation}.`);
  if (p.delayed && p.delayMinutes && p.delayReason) {
    parts.push(`Informujemy, że w związku z ${p.delayReason} pociąg jest opóźniony o ${p.delayMinutes} minut. Osoby przesiadające się do innych pociągów prosimy o zgłaszanie tego zamiaru drużynie konduktorskiej.`);
  }
  if (hasGastro(s)) parts.push(gastroText(s));
  return parts.join('\n\n');
}

// Powitalno-Pożegnalny i Pożegnalny (wspólna logika)
export function generatePozegnalny(
  p: {
    stationName: string;
    isTransit: boolean;
    isFinal?: boolean;
    delayed: boolean;
    longStop: boolean;
    departureTime: string;
    transfers: boolean;
    zka: boolean;
    zkaStation: string;
    airport: boolean;
    airportStation: string;
    wagonsDetach: boolean;
    detachGroupNumbers: string;
    detachGroupStation: string;
    detachEndWagons: string;
  },
  s: TrainSession
): string {
  const parts: string[] = [];

  if (p.isTransit && hasGastro(s)) {
    parts.push('Zapraszamy do skorzystania z oferty gastronomicznej.');
  }

  const stationLine = p.isFinal
    ? `Zbliżamy się do stacji ${p.stationName}, stacji docelowej.`
    : `Zbliżamy się do stacji ${p.stationName}.`;
  parts.push(stationLine);

  if (p.delayed) parts.push('Przepraszamy za opóźnienie pociągu.');
  if (p.isTransit && p.longStop && p.departureTime) {
    parts.push(`Planowy odjazd pociągu o godzinie ${p.departureTime}.`);
  }

  parts.push('Osoby wysiadające prosimy o zabranie swoich rzeczy oraz o zachowanie ostrożności.');

  if (p.isTransit) {
    parts.push('Dziękujemy za podróż z PKP Intercity.');
  } else {
    parts.push('Dziękujemy za wspólną podróż i zapraszamy ponownie do korzystania z usług „PKP Intercity". Do widzenia!');
  }

  const transfer = transferText(p.transfers, p.zka, p.zkaStation, p.airport, p.airportStation);
  if (transfer) parts.push(transfer);

  parts.push('Prosimy o zwrócenie uwagi na informacje stacyjne.');

  if (p.wagonsDetach && p.detachGroupNumbers && p.detachGroupStation && p.detachEndWagons) {
    parts.push(wagonsDetachText(p.stationName, p.detachGroupNumbers, p.detachGroupStation, p.detachEndWagons));
  }

  return parts.join('\n\n');
}

// A1 — Opóźnienie
export function generateA1(
  p: { onSchedule: boolean; delayMinutes: string; delayReason: string },
  s: TrainSession
): string {
  if (p.onSchedule) return 'Informujemy, że pociąg jedzie zgodnie z rozkładem jazdy.';
  return delayText(p.delayReason, p.delayMinutes, s.serviceWagon);
}

// A2 — Przedłużony postój
export function generateA2(
  p: { delayReason: string; delayMinutes: string },
  s: TrainSession
): string {
  return `Informujemy, że w związku z ${p.delayReason} pociąg odjedzie z opóźnieniem około ${p.delayMinutes} minut. O zmianie opóźnienia będziemy informować na bieżąco. Przepraszamy za niedogodności. Osoby przesiadające się do innych pociągów prosimy o zgłoszenie tego zamiaru do drużyny konduktorskiej. Przedział konduktorski znajduje się w wagonie numer ${s.serviceWagon}.`;
}

// A3 — Przed semaforem
export function generateA3(
  p: {
    stationName: string;
    waitMinutes: string;
    connectionTrain: boolean;
    connectionNumber: string;
    connectionEnd: string;
    connectionVia: string;
    connectionTime: string;
    connectionPlatform: string;
  }
): string {
  const parts: string[] = [];
  parts.push(`Informujemy, że nasz pociąg wjedzie na stację ${p.stationName} za około ${p.waitMinutes} minut.`);
  if (p.connectionTrain && p.connectionNumber && p.connectionEnd) {
    let conn = `Pociąg ${p.connectionNumber} do stacji ${p.connectionEnd}`;
    if (p.connectionVia) conn += ` przez stacje ${p.connectionVia}`;
    if (p.connectionTime) conn += `, planowo odjeżdżający o godzinie ${p.connectionTime}`;
    if (p.connectionPlatform) conn += `, oczekuje przy peronie ${p.connectionPlatform}`;
    conn += '.';
    parts.push(conn);
  }
  parts.push('Ze względów bezpieczeństwa otwieranie drzwi wejściowych i opuszczanie pociągu jest zabronione.');
  return parts.join('\n\n');
}

// A4 — Skomunikowanie
export function generateA4(
  p: {
    refused: boolean;
    trainNumber: string;
    trainEnd: string;
    trainVia: string;
    waitingStation: string;
    serviceWagon: string;
  }
): string {
  if (p.refused) {
    return `Prosimy o uwagę. Pociąg ${p.trainNumber} do stacji ${p.trainEnd}${p.trainVia ? ` przez stacje ${p.trainVia}` : ''} nie będzie oczekiwał na Państwa. Przepraszamy za niedogodności. Dodatkowych informacji udzieli Państwu drużyna konduktorska. Przedział konduktorski znajduje się w wagonie ${p.serviceWagon}. (Komunikat należy wygłosić podwójnie.)`;
  }
  return `Prosimy o uwagę. Pociąg ${p.trainNumber} do stacji ${p.trainEnd}${p.trainVia ? ` przez stacje ${p.trainVia}` : ''} będzie oczekiwał na Państwa na stacji ${p.waitingStation}. Prosimy o zwrócenie uwagi na informacje stacyjne. (Komunikat należy wygłosić dwukrotnie.)`;
}

// C1 — Krótkie perony
export function generateC1(p: { stationName: string; wagonsOutside: string; wagonsInside: string }): string {
  return `Prosimy o uwagę! Informujemy, że na stacji ${p.stationName} ostatnie wagony w składzie pociągu, oznaczone numerami ${p.wagonsOutside}, zatrzymają się poza peronem. Podróżnych wysiadających na tej stacji prosimy o przejście do wagonów numer ${p.wagonsInside}, znajdujących się bliżej lokomotywy, z których możliwe będzie bezpieczne opuszczenie pociągu. Przepraszamy za niedogodności i prosimy o zachowanie ostrożności podczas wysiadania.`;
}

// C2 — Postój techniczny
export function generateC2(): string {
  return 'Informujemy, że obecny postój techniczny został uwzględniony w rozkładzie jazdy i nie powinien spowodować lub zwiększyć opóźnienia. Ze względów bezpieczeństwa, otwieranie drzwi wejściowych i opuszczanie pociągu jest zabronione.';
}

// C3 — Skład zastępczy
export function generateC3(p: { hasZastepczeMiejsca: boolean; wasED250: boolean }): string {
  const parts: string[] = [];
  parts.push('Informujemy, że pociąg został zestawiony dziś z wagonów klasycznych.');
  if (p.hasZastepczeMiejsca) parts.push('Prosimy o zwrócenie uwagi na informacje dotyczące wyznaczania miejsc zastępczych.');
  if (p.wasED250) parts.push('Równocześnie informujemy, że mogą Państwo ubiegać się o rekompensatę, w drodze reklamacji. Szczegółowe informacje dotyczące możliwości złożenia reklamacji dostępne są w przedsionkach wagonów i na stronie www.intercity.pl.');
  return parts.join('\n\n');
}
