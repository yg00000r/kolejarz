# Kolejarz — Tasks

> Format: `- [x]` zrobione · `- [ ]` do zrobienia · `- [~]` w trakcie / częściowo
>
> **Zweryfikowano automatycznie:** 2026-08-13 (cloud agent) — `npx tsc --noEmit` w obu projektach, `npx prisma generate`, przegląd kodu backendu/frontend względem tego, co ten plik wcześniej deklarował jako zrobione. Punkty oznaczone **[KOREKTA]** zostały poprawione, bo nie zgadzały się ze stanem repo.

---

## Stan repo w skrócie

| Co | Stan |
|---|---|
| Branch główny | `main` |
| Branch roboczy Android | `cursor/android-port-0f40` — zawiera **tylko** helper do transferu sekretów (`scripts/pack-local-for-windows.sh`), **bez** faktycznego portu na Androida |
| Backend `tsc --noEmit` | ✅ OK (wymaga wcześniejszego `npx prisma generate` — bez tego 2 błędy „Cannot find module './generated/prisma/client'") |
| Frontend `tsc --noEmit` | ❌ 1 błąd — `app/(app)/index.tsx:129`, `PressScale` nie przyjmuje propa `accessibilityLabel` w swoim typie `Props` |
| `react-native-reanimated` / `lottie-react-native` | **Nie są zainstalowane** (brak w `package.json` i w całej historii gita) — patrz sekcja UI/UX poniżej |

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
| Załoga w trasie (Crew on Trip) | `work/crew.tsx` |

### Monitorowanie
| Sub-moduł | Plik |
|-----------|------|
| VPS status, Docker, ping urządzeń | `monitoring/index.tsx` |

---

## Port na Androida (Windows + Pixel 9a)

> **[KOREKTA]** Wcześniejszy plan „`git checkout android` + `git pull`" jest nieaktualny — branch `android` **nigdy nie istniał** w tym repo (zdalnie jest tylko `main`). Roboczym branchem jest `cursor/android-port-0f40`.

- [x] Branch `cursor/android-port-0f40` utworzony i wypchnięty na origin
- [x] `scripts/pack-local-for-windows.sh` — pakuje `.local-credentials/`, `.env*`, `dev.db` do zipa z hasłem, do transferu Mac → Windows przez LocalSend
- [x] `app.json` — sekcja `android` już skonfigurowana: `package: com.ygor.kolejarz`, adaptive icon (foreground/background/monochrome — assety obecne w `assets/`), permissions biometrii
- [ ] Transfer: `git clone`/`git pull` na Windows (kod) + rozpakowanie zipa sekretów (LocalSend)
- [ ] `npm install` w `mind-app` i `mind-backend` na Windows
- [ ] Konfiguracja sieciowa (Tailscale) Windows ↔ Mac/VPS
- [ ] `npx expo run:android --device` na Pixel 9a
- [ ] Bugtest OOTB na Androidzie: rejestracja → sync grafiku → wyszukanie pociągu PLK → nowe wpisy w `known-bugs.md` (KB-013+)
- [ ] Drobny porządek: `app.json → android.permissions` ma zduplikowane wpisy `USE_BIOMETRIC` / `USE_FINGERPRINT` (każdy 2×) — do wyczyszczenia przy najbliższej edycji

---

## Powiadomienia lokalne (bez płatnego Apple Developer) ✅

- [x] `aps-environment` usunięte z `ios/Kolejarz/Kolejarz.entitlements`
- [x] `expo-notifications` poza `plugins` w `app.json` → prebuild nie dodaje entitlementu push
- [x] `services/notifications.ts` — `scheduleShiftAlarm`, `scheduleTimecardReminder`-owy flow, `configureNotifications` (kanał „Asystent", handler foreground), `cancelByType`/`cancelAllAssistantNotifications`
- [x] FCM zbadane → **niemożliwe na iOS bez płatnego Apple Developer** (APNs zawsze wymagane). Na iOS: lokalne. FCM ew. do rozważenia na Androida, gdzie nie jest blokowany.
- [x] Ekran ustawień powiadomień w `settings/index.tsx`, hook `useNotificationSetup` (AsyncStorage + reschedule z grafiku)
- [x] Dodatkowo: `services/stationNotifications.ts` — powiadomienia stacyjne (−5 min od rozkładu) w module „Pilnowanie" (`work/messages/watch.tsx`)

---

## UI / UX (Personal Team)

> ℹ️ Animacje działają na core `Animated` z React Native (`FadeSlideIn`, `PressScale`, `AnimatedEmptyState`), **nie** na `react-native-reanimated` — potwierdzone w kodzie.

- [x] `components/Skeleton.tsx` (shimmer na core `Animated`) → `Skeleton`, `SkeletonRow`, `SkeletonList`; wpięte w accounts, portal-messages, schedule
- [x] Pull-to-refresh (`RefreshControl`) w `accounts.tsx`, `portal-messages.tsx`, `schedule.tsx`
- [x] `services/haptics.ts` — helper `haptic(type)`
- [x] Responsywny layout — `constants/layout.ts` + `useAppLayout.ts` + `Screen.tsx` (fluid padding, `maxContentWidth` na tabletach, wyliczane `tileWidth`)
- [x] Praca: przełącznik widoków (kompaktowy / grid), zapis w AsyncStorage
- [x] Animacje przejść ekranów w `app/(app)/_layout.tsx` (`slide_from_right`, 260 ms, gesture back)
- [x] `accentColor` — `useColors()` w `ThemeContext`, picker 6 kolorów + AsyncStorage
- [x] Fluid typography — skala S/M/L (`textScaleFactor`), łączona z systemowym Dynamic Type
- [x] `AnimatedEmptyState` (core `Animated` — pulsująca ikona) w pustych stanach (konta, wiadomości)
- [ ] **[KOREKTA]** ~~`react-native-reanimated` 4.1.1 + `lottie-react-native` 7.3.1 zainstalowane~~ — **nieprawda**: brak tych pakietów w `package.json` i w całej historii gita repo. `components/LottieState.tsx` **nie istnieje**. Jeśli te biblioteki są potrzebne, trzeba je dodać od zera (`npx expo install react-native-reanimated lottie-react-native` + babel plugin) — to nowy natywny build, nie tylko OTA.
- [~] Shared element / hero transitions — punkt zależał od `reanimated`, którego nie ma; obecnie: `FadeInDown`-owe wejścia na core `Animated` jako przybliżenie, bez prawdziwych shared-element transitions

---

## Live Activities / Dynamic Island

- [ ] ODROCZONE — wymaga płatnego Apple Developer (ActivityKit = `.appex`, niemożliwe na Personal Team)

---

## Backend / multi-tenant — zweryfikowane w kodzie ✅

- [x] `requireAuth` (Bearer token) zastosowany na praktycznie wszystkich endpointach Praca/Monitorowanie w `index.ts` — celowo bez auth: `/health`, `/portal/health`, `/debug/*`
- [x] `portalSessionForTenant(tenantId)` — login do portalu IVU danymi z `Tenant` w DB (hasło odszyfrowane AES-256-GCM), **nie** globalnym env
- [x] Cron auto-sync (`0 */6 * * *`) iteruje po **wszystkich** tenantach w bazie (`runScheduledSync` → `prisma.tenant.findMany()`) — `known-bugs.md` KB-008 ma nieaktualny tytuł „jeden tenant", opis w środku jest już poprawny
- [x] `POST /portal/confirm-timecard` — kod zaimplementowany (HTTP + fallback Playwright), **ale** działanie na produkcji jest niestabilne → patrz `known-bugs.md` KB-005 (nie jest to już „TODO do napisania", to „napisane, ale wymaga debugowania na VPS")
- [ ] `npx prisma migrate deploy` na VPS po dodaniu `Tenant`/`AppSession` — nie do zweryfikowania zdalnie z tego środowiska, do potwierdzenia przez maintainera na VPS (patrz `known-bugs.md` KB-007)

---

## Backlog

### Priorytet wysoki
- [ ] Rate limiting na `/auth/*` i `/shifts/sync` (`express-rate-limit`) — pakiet nadal **nie jest zainstalowany**
- [ ] Naprawić błąd `tsc` w `app/(app)/index.tsx` (`PressScale` + `accessibilityLabel` — prop nieobecny w typie `Props` komponentu)
- [ ] Zdecydować co dalej z KB-005 (Playwright `confirm-timecard` niestabilny na VPS) — debug flow albo reverse proxy z sieci firmowej (patrz KB-002)

### Priorytet normalny
- [ ] Smoke test OOTB: rejestracja z Expo Go → sync grafiku → wyszukanie pociągu PLK
- [ ] Smoke test izolacji: 2 konta IVU → osobne grafiki
- [ ] Lepsze błędy sync w UI: parsować body 502, pokazać przyczynę (portal/sieć)

### Priorytet niski
- [ ] `altstoreSource.ts` — **uwaga:** aktywnie zarejestrowany w `index.ts` (`registerAltStoreSourceRoutes`), to nie jest dead code; ocenić realną potrzebę przed usunięciem/uproszczeniem
- [ ] HTTPS na VPS (Caddy) — fix dla KB-001
- [ ] CI: GitHub Actions — `tsc --noEmit` + `prisma validate` (folder `.github/workflows` obecnie nie istnieje)
- [ ] `tsc --noEmit` bez błędów w obu projektach — backend: ✅ (po `prisma generate`); frontend: ❌ 1 błąd, patrz wyżej

---

## Fazy zamknięte (skrócone)

### Faza 1 — Audyt i rebranding ✅
Usunięcie dead code backendu, deduplikacja `PLK_KEY`, JSDoc kluczowych modułów, rebranding konfiguracji (`package.json`, `app.json`, `docker-compose.yml`) na „Kolejarz".

### Faza 2 — Bezpieczeństwo repo ✅
`.gitignore` rozszerzony (klucze, `dist/`, `dev.db`, `.local-credentials/`), `.env.example` dla obu projektów, redakcja PII/haseł/IP z dokumentacji, `docs/AGENT-SSH-VPS.md` → stub + realne dane w `.local-credentials/`.

### Faza 3 — Multi-tenant i OOTB onboarding ✅
Modele Prisma `Tenant`/`AppSession`, szyfrowanie AES-256-GCM haseł portalu, `authMiddleware.ts`, endpointy `/auth/register`, `/auth/me`, `/auth/logout`, `apiFetch()` z Bearer tokenem po stronie frontendu.

### Faza 4 — Dokumentacja ✅
`known-bugs.md`, `setup.md`, `readme.md` zaktualizowane.

---

## Ryzyka

| Ryzyko | Status |
|--------|--------|
| Zmiana bundle ID → utrata OTA | Zaplanować nowy EAS build + `npx expo run:ios` |
| Portal IVU blokuje IP VPS (Akamai 503) | Znany bug KB-002 — bez fix krótkookresowego |
| Expo Go bez ATS na iOS | Znany bug KB-001 — native build jako obejście |
| Prisma migrate nie uruchomiona na VPS | Nie do zweryfikowania zdalnie — wymaga potwierdzenia przez maintainera (KB-007) |
| Confirm-timecard (Playwright) niestabilny na VPS | Znany bug KB-005 — karty potwierdzane ręcznie w portalu |
| Brak `reanimated`/`lottie` mimo wcześniejszych wpisów w tym pliku | Ryzyko nieporozumienia w planowaniu — patrz sekcja UI/UX |
