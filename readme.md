# Kolejarz

Prywatna aplikacja na iPhone dla pracownika PKP Intercity. Dwa aktywne moduły: **Praca** (grafik, pociągi, komunikaty radiowe, kontrolki szlaków) i **Monitorowanie** (VPS, Docker).

> **Szybki start dla nowego dewelopera** → [setup.md](setup.md)

Design: natywny iOS feel, haptyczny feedback, spring animations, minimalistyczne UI zgodne z Apple HIG.

---

## Tech Stack

| Warstwa | Technologia |
|---|---|
| Mobile | React Native + Expo SDK 54 + TypeScript |
| Nawigacja | Expo Router |
| Backend | Node.js + Express 5 + Prisma 7 + SQLite |
| Auth | PIN + Face ID (SecureStore) + session token per tenant |
| Animacje | React Native Animated (bez Reanimated) |
| Haptics | expo-haptics |
| Portal sync | REST API IVU + Playwright (Chromium) |
| Pociągi | PLK API proxy (klucz tylko na VPS) |

---

## Środowisko deweloperskie

| Komponent | Wartość |
|---|---|
| Node.js | przez nvm (20+) |
| Testowanie | Expo Go na fizycznym iPhonie |
| Backend | Docker na VPS (maintainer) lub lokalnie |

---

## Struktura projektu

```
mind-app/
├── app/(auth)/           logowanie, rejestracja
├── app/(app)/
│   ├── work/             moduł Praca (grafik, pociągi, komunikaty, szlaki...)
│   └── monitoring/       moduł Monitorowanie (VPS, Docker, pingi)
├── services/             API helpers (work.ts, monitoring.ts)
├── constants/api.ts      BASE_URL → backend VPS
└── contexts/AuthContext  auth state, session token

mind-backend/
├── src/index.ts          endpointy Express
├── src/services/portal.ts  scraper IVU (REST + Playwright)
├── src/crypto.ts         szyfrowanie haseł portalu (AES-256-GCM)
├── prisma/schema.prisma  modele DB (Tenant, AppSession, Shift, ...)
└── templates/            stacje.json, sluzby.json, messages.json
```

---

## Aktywne moduły

| Moduł | Status |
|---|---|
| Auth (PIN + Face ID + session token) | ✅ |
| Dashboard | ✅ |
| Praca — Hub (najbliższa służba) | ✅ |
| Praca — Grafik miesięczny | ✅ |
| Praca — Pociągi PLK (live) | ✅ |
| Praca — Rozkład stacyjny | ✅ |
| Praca — Zestawienia składów (Dod. A+B) | ✅ |
| Praca — Komunikaty radiowe | ✅ |
| Praca — ABC Odprawa | ✅ |
| Praca — Kontrolki szlaków | ✅ |
| Praca — Wiadomości portalu | ✅ |
| Praca — Konta czasu pracy | ✅ |
| Praca — Karty pracy (timecard) | ✅ |
| Monitorowanie (VPS, Docker, urządzenia) | ✅ |

---

## PLK API

- **URL:** `https://pdp-api.plk-sa.pl/api/v1`
- **Auth:** `X-API-Key` (klucz wyłącznie w `.env` na VPS — nie umieszczać w repo)
- **Rate limit:** ~100 req/h
- Używane: schedules, live status pociągu, rozkład stacyjny
- Słownik stacji: `mind-backend/templates/stacje.json`

---

## Identyfikacja wizualna pociągów

Logika w `constants/trainBadge.ts` — używana w `trains.tsx`, `station.tsx`, `dodatki.tsx`.

| Przewoźnik/kategoria | Kolor |
|---|---|
| EIP | granatowy `#1E3A5F` |
| EIC | srebrny `#475569` |
| IC / TLK | pomarańczowy `#EA580C` |
| Polregio (PR) | czerwony `#DC2626` |
| Koleje Mazowieckie (KM) | zielony `#15803D` |
| RegioJet (RJ) | żółty `#EAB308` |
| Arriva (AR) | turkusowy `#0D9488` |

---

## Deploy (maintainer)

Szczegóły dostępu SSH, deploy i Docker — patrz `.local-credentials/AGENT-SSH-VPS.md` (gitignored, dostęp tylko dla maintainera).

```bash
# Quick smoke check
curl http://<VPS_IP>:3000/health
```

---

## Dokumentacja

| Plik | Zawartość |
|---|---|
| [setup.md](setup.md) | Instrukcja dla nowego dewelopera (OOTB) |
| [known-bugs.md](known-bugs.md) | Znane błędy i ograniczenia |
| [tasks.md](tasks.md) | Roadmapa i backlog |
| [API.md](API.md) | Endpointy backendu |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Architektura systemu |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Git workflow, code style, deploy |
| [komunikaty.md](komunikaty.md) | Oficjalne wzory PKP IC (źródło merytoryczne) |
