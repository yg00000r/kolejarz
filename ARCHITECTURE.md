# Architecture — Kolejarz

> Szczegółowa dokumentacja architektury systemu, przepływów danych, i decyzji designu.

## Spis treści

1. [Overview](#overview)
2. [Warstwowa architektura](#warstwowa-architektura)
3. [Przepływy danych](#przepływy-danych) — m.in. komunikaty IC (podsekcja **6.** w tym rozdziale)
4. [Database schema](#database-schema)
5. [API architecture](#api-architecture)
6. [Security & Auth](#security--auth)
7. [Deployment](#deployment)
8. [Scaling & Performance](#scaling--performance)

---

## Overview

**Mind** to osobista aplikacja Life OS (iOS) wspierana przez backend na VPS. Architektura:

```
┌─────────────────────────────────────┐
│  iPhone (iOS 26+)                   │
│  ├─ React Native (Expo SDK 54)      │
│  ├─ Expo Router (file-based)        │
│  └─ TypeScript                      │
│         │                           │
│         │ HTTP                      │
│         ▼                           │
│ ┌─────────────────────────────────┐ │
│ │   VPS Backend (Docker)          │ │
│ │   (Ubuntu 25.04)                │ │
│ │  ├─ Express 5 + Node.js v22    │ │
│ │  ├─ Prisma 7 ORM (SQLite)      │ │
│ │  ├─ Portal IVU.pad (HTTP)      │ │
│ │  ├─ Playwright (Chromium)      │ │
│ │  ├─ node-cron (auto-sync 6h)   │ │
│ │  └─ PLK API (pociągi)          │ │
│ │         │                       │ │
│ │         ├─→ portal.intercity.pl │ │ Grafik, karty pracy, wiadomości
│ │         ├─→ PLK API             │ │ Live tracking pociągów
│ │         └─→ FS (mind-notes/)    │ │ Markdown notatki
│ └─────────────────────────────────┘ │
│  57.128.225.171:3000                  │
└─────────────────────────────────────┘
```

---

## Warstwowa architektura

### Frontend (React Native + Expo)
```
┌─────────────────────────────────────────┐
│           PRESENTATION LAYER            │
│  ┌──────────────────────────────────┐   │
│  │   Screens (app/(app)/*)          │   │
│  │  ├─ Dashboard (index)            │   │
│  │  ├─ Work Hub + Grafik            │   │
│  │  │  ├─ duty-details              │   │
│  │  │  ├─ portal-messages           │   │
│  │  │  ├─ accounts                  │   │
│  │  │  ├─ timecard                  │   │
│  │  │  ├─ trains / station          │   │
│  │  │  └─ messages / abc / dodatki  │   │
│  │  ├─ Expenses (list, form, [id])  │   │
│  │  ├─ Notes (list, form, [slug])   │   │
│  │  ├─ Routines                     │   │
│  │  └─ Monitoring                   │   │
│  └──────────────────────────────────┘   │
│                  ▲                       │
│                  │                       │
│  ┌──────────────────────────────────┐   │
│  │   Components (components/*)      │   │
│  │  ├─ HapticButton                 │   │
│  │  ├─ SkeletonLoader               │   │
│  │  ├─ PressScale (spring anim)     │   │
│  │  ├─ FadeSlideIn (stagger)        │   │
│  │  └─ ErrorBoundary                │   │
│  └──────────────────────────────────┘   │
│                  ▲                       │
│                  │                       │
│  ┌──────────────────────────────────┐   │
│  │   Services (services/*)          │   │
│  │  ├─ work.ts (shifts, portal)     │   │
│  │  ├─ expenses.ts                  │   │
│  │  └─ fetch wrappers              │   │
│  └──────────────────────────────────┘   │
│                  ▲                       │
│                  │                       │
│  ┌──────────────────────────────────┐   │
│  │   State Management               │   │
│  │  ├─ AuthContext (SecureStore)     │   │
│  │  └─ ThemeContext (dark/light)     │   │
│  └──────────────────────────────────┘   │
│                  ▲                       │
│                  │ HTTP (fetch)          │
└──────────────────┼──────────────────────┘
                   │
                   ▼
              Backend API
```

### Backend (Node.js + Express)
```
┌─────────────────────────────────────────┐
│          API LAYER (Express 5)          │
│  ┌──────────────────────────────────┐   │
│  │  Routes (src/index.ts — inline)  │   │
│  │  ├─ /health                      │   │
│  │  ├─ /notes, /mdnotes            │   │
│  │  ├─ /expenses                    │   │
│  │  ├─ /shifts, /shifts/sync        │   │
│  │  ├─ /shifts/:date/details        │   │
│  │  ├─ /shifts/actual               │   │
│  │  ├─ /portal/messages             │   │
│  │  ├─ /portal/accounts             │   │
│  │  ├─ /portal/health               │   │
│  │  ├─ /portal/confirm-timecard     │   │
│  │  ├─ /devices, /monitoring        │   │
│  │  ├─ /routines                    │   │
│  │  ├─ /trains, /station            │   │
│  │  └─ /templates/messages          │   │
│  └──────────────────────────────────┘   │
│                  ▲                       │
│                  │                       │
│  ┌──────────────────────────────────┐   │
│  │ Middleware: cors, helmet,        │   │
│  │ express.json()                   │   │
│  └──────────────────────────────────┘   │
│                  ▲                       │
│                  │                       │
│  ┌──────────────────────────────────┐   │
│  │   SERVICES                        │   │
│  │  ┌──────────────────────────┐    │   │
│  │  │ portal.ts                │    │   │
│  │  │  ├─ login (JWT)          │    │   │
│  │  │  ├─ fetchDutyTable       │    │   │
│  │  │  ├─ fetchDutyDetails     │    │   │
│  │  │  ├─ fetchActualDuties    │    │   │
│  │  │  ├─ fetchMessages        │    │   │
│  │  │  ├─ fetchAccounts        │    │   │
│  │  │  ├─ confirmAllocationHttp│    │   │
│  │  │  ├─ portalHealthCheck    │    │   │
│  │  │  └─ parse* (cheerio)     │    │   │
│  │  └──────────────────────────┘    │   │
│  │  ┌──────────────────────────┐    │   │
│  │  │ portal-browser.ts        │    │   │
│  │  │  └─ confirmTimecard      │    │   │
│  │  │     (Playwright/Chromium)│    │   │
│  │  └──────────────────────────┘    │   │
│  └──────────────────────────────────┘   │
│                  ▲                       │
│                  │                       │
│  ┌──────────────────────────────────┐   │
│  │   CRON (node-cron)               │   │
│  │  └─ 0 */6 * * * → syncMonth()   │   │
│  │     (bieżący + następny miesiąc) │   │
│  └──────────────────────────────────┘   │
│                  ▲                       │
│                  │                       │
│  ┌──────────────────────────────────┐   │
│  │   DATA ACCESS: Prisma 7          │   │
│  │   (SQLite via @libsql/client)    │   │
│  └──────────────────────────────────┘   │
│                  ▲                       │
└──────────────────┼──────────────────────┘
                   │
          ┌────────┼────────┬──────────┐
          ▼        ▼        ▼          ▼
       SQLite   Portal    PLK API   FileSystem
      (dev.db) (IVU.pad) (pociągi)  (mind-notes/)
```

---

## Przepływy danych

### 1. Służby — sync z portalu IVU.pad

```
                        ┌─────────────────┐
                        │  node-cron       │
                        │  co 6h + startup │
                        └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │ syncMonth()     │
                        │ (year, month)   │
                        └────────┬────────┘
                                 │
            ┌────────────────────┼────────────────────┐
            │                    │                     │
            ▼                    ▼                     ▼
    POST /pad/admin/      GET _-duty-table      Prisma upsert
    rest/login            ?beginDate=...        Shift model
    → JWT token           → HTML fragment       → SQLite
                          → cheerio parse
                          → ParsedShift[]
                                 │
                                 ▼
                        ┌─────────────────┐
                        │ iPhone App      │
                        │ GET /shifts     │
                        │ GET /shifts/next│
                        └─────────────────┘
```

### 2. Rozbicie służby (Duty Details)

```
  iPhone App
  klik na dzień pracy
       │
       │ GET /shifts/2026-03-20/details
       ▼
  Backend → portalLogin() → ensureSession()
       │
       │ GET duty-details?beginDate=2026-03-20&sync=true
       │ (IVU.pad portal — HTML fragment)
       ▼
  parseDutyDetails (cheerio)
  ├─ header: crewType, depot, paidTime, workTime
  └─ components[]: ADM → OBJ → Umlstk → PRZ
       │
       ▼
  JSON response → DutyDetails
       │
       ▼
  duty-details.tsx
  (timeline z kolorami, ikonami, stacjami, pociągami)
```

### 3. Potwierdzenie karty pracy

```
  POST /portal/confirm-timecard
  { date: "2026-03-20" }
       │
       ├─ fetchDutyDetails → needsConfirmation?
       │
       ├─ Attempt 1: HTTP POST
       │   confirmAllocationHttp (fetch)
       │   → _-json-confirm-allocation
       │   (może zablokować Akamai)
       │
       └─ Attempt 2: Playwright (fallback)
           confirmTimecardPlaywright
           ├─ chromium.launch()
           ├─ REST login → JWT cookie
           ├─ navigate to duty-details
           └─ POST from browser context
                │
                ▼
           Prisma update → timecardStatus = 'zatwierdzona'
```

### 4. Wydatki (Expenses)

```
  iPhone App → GET /expenses?month=3&year=2026
       │
       ▼
  Prisma query → SELECT FROM Expense WHERE dueDate in range
       │
       ▼
  JSON → ExpenseListScreen (FlatList, badge paid/unpaid)
```

### 5. Notatki Markdown

```
  iPhone App → GET /mdnotes (lista) / GET /mdnotes/:slug (treść)
       │
       ▼
  Backend → fs.readdir/readFile (mind-notes/*.md)
       │
       ▼
  JSON → Markdown viewer (react-native-markdown-display)
```

### 6. Komunikaty radiowe (PKP IC — moduł Praca)

**Architektura (zaimplementowana)**

Moduł Komunikaty składa się z dwóch trybów dostępnych z `messages/index.tsx`:

1. **Pilnowanie** (domyślny) — automatyczne generowanie komunikatów na podstawie trasy:
   - `setup-run.tsx` — konfiguracja trasy: wyszukiwanie pociągu w PLK (`searchTrain`), wybór odcinka pracy, pola ręczne (wagon służbowy, gastronomia). Fallback do ręcznego `session.tsx`.
   - `watch.tsx` — lista stacji w odcinku z gotowymi komunikatami pożegnalnymi/powitalnymi; regulacja opóźnienia; powiadomienia lokalne (−5 min).
2. **Klasyczne szablony** (`classic.tsx`) — ręczne wybieranie typu → formularz → podgląd → kolejka.

**Modele danych**: `TrainSession` (v1) — legacy ręczny; `TrainRunSession` (v2) — rozszerzony z PLK (`orderId`, `stops[]`, `workStartIndex/EndIndex`, `delayMinutes`). Konwersja v2→v1 przez `runSessionToTrainSession()`.

**Katalog komunikatów**: `constants/messageCatalog.ts` (szablony z placeholderami + `renderTemplate()`), `constants/komunikaty.ts` (generatory `generate*()`, `DELAY_REASONS_CATALOG` — 26 przyczyn PL+EN), `services/messageQueue.ts` (kolejka).

**Powiadomienia**: `services/stationNotifications.ts` — `expo-notifications`, planowanie −5 min od rozkładu; anulowanie/replanowanie przy zmianie opóźnienia.

**Backend / API PLK**: `searchTrain` → `GET /trains/search` (stacje planowe); `fetchTrainLive` → `GET /trains/:orderId/live` (opóźnienia live); `GET /templates/messages` — statyczne szablony JSON (niezależne od generatorów TS).

**Źródło merytoryczne**: `komunikaty.md` (katalog root) — pełne wzory PKP IC, katalog przyczyn PL+EN, lotniska.

**Ewolucja (przyszłość)**: korekta czasów z `fetchTrainLive` (faza 2); GPS (niski priorytet); automatyzacja reguł typu komunikatu na podstawie klasyfikacji stacji.

**Źródło merytoryczne w repozytorium (zachowane jako reference)**

- `komunikaty.md` (katalog root) — pełne wzory PKP IC (komunikaty podstawowe A/B/C, gastronomia, katalog przyczyn opóźnień PL+EN, lotniska). Aplikacja implementuje **podzbiór** typów; pełna zgodność z plikiem jest celem przyszłej warstwy katalogu (np. JSON + szablony).

**Elementy zrealizowane z poniższej listy (FAZA 9 — zaimplementowano):**

1. Rozszerzona sesja trasy: import z PLK + wybór odcinka pracy + pola nadal ręczne (wagon służbowy, gastronomia); fallback całkowicie ręczny jak obecnie.
2. Tryb **„Pilnowanie”**: lista stacji w obrębie odcinka, gotowe teksty pożegnalne przed stacją i powitalne po stacji, konfiguracja opóźnień.
3. Katalog komunikatów: `messageCatalog.json` (lub równoważny) z placeholderami + ewentualny skrypt parsujący `komunikaty.md` wyłącznie jako **szkic** (wymaga weryfikacji ludzkiej).
4. Powiadomienia lokalne (np. 5 min przed stacją wg rozkładu); ewentualna korekta z `fetchTrainLive` w drugiej kolejności; GPS — świadomie niski priorytet (ograniczenia iOS/tła).

Szczegółowy plan zadań: `TASKS.md` → sekcja „FAZA 9 — Komunikaty v2”.

---

## Database schema

### Prisma Schema (`prisma/schema.prisma`)

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "sqlite"
}

model Note {
  id        Int      @id @default(autoincrement())
  content   String
  createdAt DateTime @default(now())
}

model Expense {
  id            Int       @id @default(autoincrement())
  title         String
  amount        Float
  accountNumber String?
  dueDate       DateTime?
  status        String    @default("unpaid")
  recurring     Boolean   @default(false)
  createdAt     DateTime  @default(now())
}

model Device {
  id        Int      @id @default(autoincrement())
  name      String
  host      String
  createdAt DateTime @default(now())
}

model Routine {
  id           Int       @id @default(autoincrement())
  name         String
  type         String    @default("daily")   // "daily" | "interval" | "monthly"
  intervalDays Int?
  lastDone     DateTime?
  createdAt    DateTime  @default(now())
}

model Shift {
  id             Int      @id @default(autoincrement())
  date           String   @unique            // "YYYY-MM-DD"
  shiftCode      String                      // KWR251, DWS, S, C5...
  startTime      String?                     // "06:30"
  endTime        String?                     // "14:30"
  type           String   @default("presence") // presence | offday
  allocationId   String?                     // IVU allocation ID
  planningLevel  String?                     // Plan | Wykonanie
  timecardStatus String?                     // do_potwierdzenia | zatwierdzona | wydana | rozliczona | edytowalna
  createdAt      DateTime @default(now())
  updatedAt      DateTime @default(now()) @updatedAt
}
```

---

## API architecture

### Request/Response Flow

```
Frontend Request (JSON)
       │
       │ HTTP
       ▼
┌────────────────────┐
│ Middleware Stack    │
├────────────────────┤
│ 1. cors            │
│ 2. helmet          │
│ 3. express.json()  │
└────────────────────┘
       │
       ▼
┌────────────────────────────────────┐
│ Route Handler (inline w index.ts)  │
│                                    │
│ ├─ Prisma endpointy (local DB)     │
│ │  → szybkie, cache w DB           │
│ │                                  │
│ ├─ Portal passthrough              │
│ │  → login → fetch HTML → parse    │
│ │  → 502 jeśli portal niedostępny  │
│ │                                  │
│ └─ PLK proxy                       │
│    → fetch external API             │
│    → 502 jeśli PLK niedostępne     │
└────────────────────────────────────┘
       │
       ▼
JSON Response + HTTP status code
```

### Error Handling

```
Request Error
     │
     ├─→ 400 Bad Request     (brak wymaganych pól, zły format daty)
     ├─→ 404 Not Found       (zasób nie istnieje, brak służby na dany dzień)
     ├─→ 409 Conflict        (notatka o tej nazwie już istnieje)
     ├─→ 500 Internal Error  (błąd Prisma, nieoczekiwany exception)
     └─→ 502 Bad Gateway     (portal niedostępny, PLK API timeout, login failed)
```

### Portal Session Management

```
┌─────────────────────────────────────────┐
│ Portal IVU.pad — sesja                  │
│                                         │
│ 1. POST /pad/admin/rest/login           │
│    → JWT token (TTL ~24h, cache 20h)    │
│                                         │
│ 2. GET _-duty-table (pierwszy request)  │
│    → Set-Cookie: JSESSIONID=...         │
│    → sesja mbweb ustanowiona            │
│                                         │
│ 3. Kolejne requesty:                    │
│    Cookie: IvuPadAuthToken=JWT;         │
│            JSESSIONID=...               │
│    Authorization: Bearer JWT            │
│                                         │
│ 4. &sync=true — wymagany parametr       │
│    (omija blokadę Akamai CDN/WAF)       │
│                                         │
│ 5. Hasło: {Miesiąc}{Rok}               │
│    (auto-generowane, np. Marzec2026)    │
└─────────────────────────────────────────┘
```

---

## Security & Auth

### Authentication Flow (App)

```
┌──────────────────────────────┐
│ First Launch (No PIN set)    │
└──────────┬───────────────────┘
           │
           ▼
  ┌────────────────────┐
  │ SetupPinScreen     │
  │ - Enter 4 digits   │
  │ - Confirm digits   │
  └────────┬───────────┘
           │
           ▼
  ┌────────────────────────────┐
  │ SecureStore (iOS Keychain) │
  │ Key: "pin"                 │
  └────────┬───────────────────┘
           │
           ▼
  Dashboard (authenticated)
```

### Data Security

- **PIN:** Stored encrypted w SecureStore (iOS Keychain)
- **API Calls:** No auth headers (single-user app, VPS not exposed publicly)
- **Portal credentials:** `PORTAL_USER` / auto-generated password — only in `.env` on VPS
- **VPS Access:** SSH key-based auth (`~/.ssh/id_ed25519`)
- **Environment:** `.env` na VPS w Docker volume — nie w repo
- **Akamai:** Portal za CDN/WAF — `sync=true` omija blokadę, Playwright fallback dla POST

---

## Deployment

### Production Stack
```
VPS (57.128.225.171)
├─ Ubuntu 25.04
├─ Docker
│  ├─ mind-backend (port 3000)
│  │  ├─ node:22-slim + Chromium
│  │  ├─ node-cron (auto-sync co 6h)
│  │  ├─ playwright-core (confirm-timecard)
│  │  └─ SQLite (dev.db via volume)
│  └─ obsidian-remote (port 8080, Tailscale)
├─ Syncthing (mind-notes/ sync)
└─ SSH key auth (ubuntu@vps)
```

### Deployment Steps

1. **Build locally**
   ```bash
   cd mind-backend
   npm run build    # tsc → dist/
   ```

2. **Rsync to VPS**
   ```bash
   rsync -avz --exclude='node_modules' --exclude='.env' --exclude='dev.db' \
     --exclude='mind-notes' mind-backend/ vps:~/mind-backend/
   ```

3. **Rebuild & restart Docker**
   ```bash
   ssh vps
   cd ~/mind-backend
   docker stop mind-backend && docker rm mind-backend
   docker build -t ubuntu-mind-backend .
   docker run -d --name mind-backend -p 3000:3000 \
     --env-file .env \
     -v $(pwd)/dev.db:/app/dev.db \
     -v $(pwd)/mind-notes:/app/mind-notes \
     --restart unless-stopped \
     ubuntu-mind-backend
   ```

4. **Verify**
   ```bash
   curl http://57.128.225.171:3000/health
   curl http://57.128.225.171:3000/portal/health
   docker logs mind-backend --tail 20
   ```

### Dockerfile
```dockerfile
FROM node:22-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends chromium fonts-liberation && \
    rm -rf /var/lib/apt/lists/*

ENV CHROMIUM_PATH=/usr/bin/chromium

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY dist ./dist
COPY templates ./templates

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

---

## Scaling & Performance

### Current Optimizations

| Area | Solution |
|------|----------|
| Shifts | Prisma cache (sync co 6h via cron, GET z DB) |
| Portal session | JWT cached 20h, JSESSIONID persisted in-memory |
| PLK schedule | Full-day cache (~34MB routes, fetched once per day) |
| Station dict | Cached 24h |
| HTML parsing | cheerio (fast, no browser overhead) |
| Timecard confirm | HTTP attempt first, Playwright only as fallback |

### Bottlenecks & Solutions

| Problem | Cause | Solution |
|---------|-------|----------|
| Portal slow | Akamai CDN latency | Cache parsed data in Prisma, cron sync |
| PLK rate limit | External API | Full schedule cache, debounce searches |
| Chromium memory | Playwright browser | Launch per-request, close immediately |
| Docker image size | Chromium in image (~400MB) | Only needed for confirm-timecard |

---

## Dependency Tree

```
Frontend (mind-app):
├─ expo v54 (SDK 54)
│  ├─ expo-router (file-based navigation)
│  ├─ expo-secure-store (PIN auth)
│  ├─ expo-haptics (tactile feedback)
│  ├─ expo-clipboard (copy to clipboard)
│  └─ expo-notifications (station reminders)
├─ react-native v0.76+
├─ @expo/vector-icons (MaterialCommunityIcons)
├─ react-native-reanimated (animations)
├─ react-native-markdown-display
└─ TypeScript

Backend (mind-backend):
├─ express v5
├─ @prisma/client v7 + @prisma/adapter-libsql
├─ @libsql/client (SQLite driver)
├─ cheerio v1.2 (HTML parsing)
├─ node-cron (scheduled sync)
├─ playwright-core (browser automation)
├─ cors, helmet, dotenv
└─ TypeScript (compiled to CommonJS)
```

---

Ostatnia aktualizacja: 2026-03-21
