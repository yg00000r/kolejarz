# Kolejarz — Tasks

> Format: `- [x]` = zrobione, `- [ ]` = do zrobienia, `- [~]` = w trakcie

---

## Aktywne moduły

### Praca
| Sub-moduł | Plik |
|-----------|------|
| Hub (najbliższa służba) | `work/index.tsx` |
| Grafik miesięczny | `work/schedule.tsx` |
| Szczegóły służby | `work/duty-details.tsx` |
| Wiadomości portalu | `work/portal-messages.tsx` |
| Konta czasu pracy | `work/accounts.tsx` |
| Karty pracy (timecard) | `work/timecard.tsx` |
| Pociągi PLK | `work/trains.tsx` |
| Rozkład stacyjny | `work/station.tsx` |
| ABC Odprawa | `work/abc.tsx` |
| Zestawienia składów | `work/dodatki.tsx` |
| Kontrolki szlaków | `work/routes.tsx` |
| Komunikaty radiowe | `work/messages/` |

### Monitorowanie
| Sub-moduł | Plik |
|-----------|------|
| VPS status, Docker, ping urządzeń | `monitoring/index.tsx` |

---

## Na dzisiaj (2026-06-20)

### 1. Panel załogi (Crew on Trip) ✅
- [x] `scraper/recon_crew.py` — endpoint to `_-crew-on-trip-table?beginDate=...&tripNumber=...&sync=true` (GET, NIE blokowany przez Akamai; param daty = `beginDate` nie `date`). Struktura w `PORTAL_DISCOVERY.md` §9
- [x] Backend: `fetchCrewOnTrip` + `parseCrewOnTrip` w `portal.ts`, typy `CrewMember[]` / `CrewOnTrip` (rola, imię, telefon, odcinek). Zwalidowane na realnym HTML
- [x] Backend: endpoint `GET /crew?date=YYYY-MM-DD&trip=XXXX` w `index.ts`
- [x] Frontend: ekran `work/crew.tsx` (stepper daty + numer, lista załogi z rolami/odcinkami/telefonami), kafelek w `work/index.tsx`, `fetchCrewOnTrip` w `services/work.ts`, trasa w `work/_layout.tsx`

### 2. Powiadomienia (bez płatnego Apple Developer)
- [x] `aps-environment` usunięte z `ios/Kolejarz/Kolejarz.entitlements` (puste `<dict/>`)
- [x] `expo-notifications` poza `plugins` w `app.json` → prebuild nie dodaje entitlementu push (lokalne działają bez niego)
- [x] `services/notifications.ts` — lokalne: `scheduleTimecardReminder`, `scheduleShiftAlarm`, `configureNotifications` (kanał „Asystent", handler foreground); wpięte w `app/_layout.tsx`
- [x] FCM zbadane → **niemożliwe na iOS bez płatnego Apple Developer**: iOS push zawsze przez APNs (gated za $99/rok), FCM to nakładka na APNs. Jedyny darmowy push na iOS = Web Push/PWA (nie dotyczy apki natywnej). Decyzja: na iOS lokalne; FCM ew. później dla Androida.
- [x] Ekran ustawień powiadomień w `settings/index.tsx` (toggle: alarm przed służbą + wyprzedzenie 30/60/120 min, przypomnienie o karcie), hook `useNotificationSetup` (AsyncStorage + reschedule z grafiku), kanał „Asystent"

### 3. Zmiany UI (Personal Team)
> ℹ️ `react-native-reanimated`, `expo-linear-gradient`, `lottie-react-native` NIE są zainstalowane. Animacje robione na core `Animated` (jak `FadeSlideIn`/`PressScale`), bez nowych zależności natywnych → OTA-friendly. Zadania zależne od reanimated/lottie wymagają decyzji o instalacji (= nowy build natywny).
- [x] `components/Skeleton.tsx` z shimmer (core `Animated` — ruchomy pasek, bez gradientu) → `Skeleton`, `SkeletonRow`, `SkeletonList`; wpięte w accounts, portal-messages, schedule
- [x] Pull-to-refresh (`RefreshControl`) w `accounts.tsx`, `portal-messages.tsx` (`schedule.tsx` miał już wcześniej)
- [x] `services/haptics.ts` — helper `haptic(type)` (light/medium/heavy/selection/success/warning/error); crew.tsx/duty-details już mają bogaty feedback
- [x] **Responsywny layout** — `fluidHorizontalPadding` (mniejsze marginesy 12–20 px wg szerokości), `maxContentWidth` tylko na tabletach (telefony wypełniają szerokość), `tileWidth` wyliczany (koniec martwych pasów po `47%`), kolumny 2/3 wg szerokości; `constants/layout.ts` + `useAppLayout.ts` + `Screen.tsx`
- [x] **Praca: przełącznik widoków** — kompaktowy (lista modułów) / normalny (grid), zapis w AsyncStorage, ikona w nagłówku
- [x] Animacje przejść ekranów w `app/(app)/_layout.tsx` (`slide_from_right`, 260 ms, gesture back)
- [x] **reanimated 4.1.1 + lottie 7.3.1** zainstalowane (`npx expo install`), `babel.config.js` (babel-preset-expo → worklets plugin), Metro `-c`, bundle zweryfikowany (HTTP 200, 13 MB)
- [x] **accentColor** — `useColors()` w `ThemeContext`, migracja **26 ekranów** z `Colors.dark/light`, picker 6 kolorów + zapis AsyncStorage; Paper `primary` też = akcent
- [x] **Fluid typography** — skala tekstu S/M/L w ustawieniach (`textScaleFactor` w `useAppTheme`/`useAppLayout`), łączona z systemowym Dynamic Type (`PixelRatio.getFontScale()`)
- [x] State-driven animations — `AnimatedEmptyState` (reanimated `useSharedValue`+`withRepeat`+`withTiming`, pulsująca ikona) w pustych stanach (konta, wiadomości)
- [x] `components/LottieState.tsx` — wrapper `lottie-react-native` gotowy na JSON w `assets/lottie/`; działające puste stany dostarczone przez `AnimatedEmptyState` (bez assetów)
- [~] Shared element / hero transitions — `sharedTransitionTag` NIEDOSTĘPNY w reanimated 4.1.1 (wymaga ≥4.2.0 + feature flag + New Arch + screens ≥4.16, niewspierane w Expo Go). Zamiast tego: `entering={FadeInDown}` (hero-like entrances)

### 3B. Live Activities / Dynamic Island
- [ ] ODROCZONE — wymaga płatnego Apple Developer (ActivityKit = `.appex`, niemożliwe na Personal Team). Plan w `.cursor/plans/plan_na_dzisiaj`.

### 4–5. Git i Android
- [ ] Commit zmian iOS na `main`
- [ ] `git checkout android` + `git pull`, weryfikacja różnic względem main
- [ ] `npx expo run:android --device` na Pixel 9a
- [ ] Bugtest OOTB na Androidzie: rejestracja → sync grafiku → wyszukanie pociągu PLK; nowe wpisy w `known-bugs.md` (KB-013+)

---

## Faza 1: Audyt i rebranding ✅

- [x] Usunięcie dead code backendu (expenses, routines, notes, mdnotes, NOTES_DIR)
- [x] Usunięcie martwych modeli Prisma (Expense, Routine, Note)
- [x] Deduplikacja PLK_KEY — wyłącznie przez `process.env.PLK_API_KEY`
- [x] Usunięcie `mind-backend/dist/`, `mind-app/trash/`
- [x] Usunięcie zagnieżdżonego `.git` w `mind-app/` (monorepo)
- [x] JSDoc dla `portal.ts` (login, fetchDutyTable, parseDutyTable, deprecated auto-password)
- [x] JSDoc dla kluczowych endpointów w `index.ts` (`/shifts/sync`, `GET /shifts`, `/shifts/:date/details`)
- [x] JSDoc dla `services/work.ts` (syncShifts, fetchShifts, fetchDutyDetails)
- [x] Rebranding konfiguracji: `package.json`, `app.json` (slug, bundleIdentifier `com.ygor.kolejarz`), `docker-compose.yml`, `altstoreSource.ts`
- [x] Nagłówki plików `.md` zaktualizowane do „Kolejarz"

> **Uwaga:** Foldery `mind-app/` i `mind-backend/` zachowują obecne nazwy na dysku (zmiana folderów wymagałaby migracji repo). Konfiguracje i dokumentacja używają nazwy Kolejarz.

---

## Faza 2: Bezpieczeństwo repo ✅

- [x] `.gitignore` — dodano klucze (`id_rsa`, `*.key`, `*.pem`, `*.p12`), `dist/`, `dev.db`, `.local-credentials/`
- [x] `.env.example` dla backendu — zmienne dla maintainera VPS, bez `PORTAL_USER/PASSWORD`
- [x] `.env.example` dla frontendu — opcjonalny, z informacją że nie jest wymagany
- [x] `readme.md` — usunięto hasła, stare IP, Grażyna/sync_grafik.py, moduły Life OS
- [x] `CONTRIBUTING.md` — usunięto `sshpass`, stare IP; dodano Git workflow (gałęzie, commity, zasady)
- [x] `API.md` — IP zastąpione placeholderem `<VPS_IP>`
- [x] `SETUP.md` — usunięto prawdziwy klucz PLK, KOLEJARZ_DB_PATH, Telegram ID
- [x] `scraper/PORTAL_DISCOVERY.md` — zredagowane PII (username, employee ID, hasła przykładowe)
- [x] `docs/ALTSTORE-SOURCE.md` — **usunięty** (nieaktywna domena)
- [x] `docs/AGENT-SSH-VPS.md` — przeniesiony do `.local-credentials/AGENT-SSH-VPS.md` (gitignored); stub w `docs/`
- [x] Git workflow opisany w `CONTRIBUTING.md`

---

## Faza 3: Multi-tenant i OOTB onboarding ✅

- [x] Model Prisma `Tenant` (`id`, `portalUsername`, `portalPasswordEncrypted`, `createdAt`)
- [x] Model Prisma `AppSession` (`token`, `tenantId`, `expiresAt`)
- [x] `Shift.tenantId` — opcjonalne powiązanie z tenantym
- [x] `src/crypto.ts` — szyfrowanie AES-256-GCM haseł portalu (`encrypt`, `decrypt`)
- [x] `src/authMiddleware.ts` — Bearer token middleware (`requireAuth`, `AuthRequest`)
- [x] `POST /auth/register` — jedna próba logowania IVU, zapis szyfrowanego hasła w Tenant, sessionToken (30 dni), walidator wzorca MiesiącRok
- [x] `GET /auth/me` — weryfikacja tokenu, zwrot tenantId + portalUsername
- [x] `POST /auth/logout` — usunięcie sesji
- [x] `POST /auth/verify-portal` — zachowany jako `@deprecated` alias
- [x] CORS — zachowane otwarte z obsługą `exp://`, `localhost`, LAN
- [x] `services/api.ts` — `apiFetch()` helper z Bearer tokenem (SecureStore)
- [x] `hooks/useApi.ts` — axios interceptor dodający Bearer token
- [x] `services/work.ts` — wszystkie `fetch(BASE_URL/...)` zastąpione `apiFetch(/...)`
- [x] `app/(auth)/register.tsx` — uproszczony flow: zawsze login + hasło, bez auto-hasła miesięcznego, zapis `sessionToken` w SecureStore

---

## Faza 4: Dokumentacja ✅

- [x] `tasks.md` — ten plik (zastąpił TASKS.md z historią FAZ 0–9)
- [x] `known-bugs.md` — katalog znanych błędów (KB-001…KB-009)
- [x] `setup.md` — instrukcja OOTB dla nowego dewelopera
- [x] `readme.md` — zaktualizowany entry point z linkami do dokumentacji

---

## Backlog

### Priorytet wysoki
- [ ] Zastosować `requireAuth` middleware na endpointach Praca/Monitorowanie w `index.ts` (DB Tenant gotowy, middleware gotowy)
- [ ] `portalLogin(tenantId)` — credentials z DB tenanta zamiast globalnego env
- [ ] Cron auto-sync per tenant — iteracja po wszystkich tenantach (teraz: globalny env)
- [ ] `npx prisma migrate deploy` na VPS po dodaniu Tenant/AppSession

### Priorytet normalny
- [ ] Smoke test OOTB: rejestracja z Expo Go → sync grafiku → wyszukanie pociągu PLK
- [ ] Smoke test izolacji: 2 konta IVU → osobne grafiki
- [ ] Rate limiting na `/auth/*` i `/shifts/sync` (`express-rate-limit`)
- [ ] Lepsze błędy sync w UI: parsować body 502, pokazać przyczynę (portal/sieć)
- [ ] `POST /portal/confirm-timecard` — Playwright confirm (oznaczony TODO)

### Priorytet niski
- [ ] Usunąć lub uprościć `altstoreSource.ts` (domena nieaktywna)
- [ ] HTTPS na VPS (Caddy) — fix dla KB-001
- [ ] CI: GitHub Actions — `tsc --noEmit` + `prisma validate`
- [ ] Testy TypeScript: `npx tsc --noEmit` w obu projektach bez błędów

---

## Ryzyka

| Ryzyko | Status |
|--------|--------|
| Zmiana bundle ID → utrata OTA | Zaplanować nowy EAS build + `npx expo run:ios` |
| Portal IVU blokuje IP VPS (Akamai 503) | Znany bug KB-002 — bez fix krótkookresowego |
| Expo Go bez ATS na iOS | Znany bug KB-001 — native build jako obejście |
| Prisma migrate nie uruchomiona na VPS | Backlog — wymagane ręcznie po każdej zmianie schematu |
