# Kolejarz — Tasks

> Format: `- [x]` zrobione · `- [ ]` do zrobienia · `- [~]` w trakcie / częściowo
>
> **Zweryfikowano automatycznie:** 2026-08-13 (cloud agent) — `npx tsc --noEmit` w obu projektach, `npx prisma generate`, przegląd kodu backendu/frontend względem tego, co ten plik wcześniej deklarował jako zrobione. Punkty oznaczone **[KOREKTA]** zostały poprawione, bo nie zgadzały się ze stanem repo.
>
> **Migracja do GitHub Issues (2026-08-13):** cały backlog z tego pliku został rozpisany z kodowaniem etap/zadanie (A1, A2, B1...) w [docs/GITHUB_ISSUES_PLAN.md](docs/GITHUB_ISSUES_PLAN.md), z priorytetami i dopiskiem `(MC)` dla zadań wykonywalnych w całości przez agenta chmurowego. Do faktycznego utworzenia issues służy `scripts/create-github-issues.sh` — agent chmurowy nie ma uprawnienia do zapisu w GitHub Issues tego repo (`403 Resource not accessible by integration`), więc skrypt trzeba odpalić lokalnie z uprawnionym `gh`. Ten plik zostaje źródłem prawdy do czasu wykonania migracji.

---

## Stan repo w skrócie

| Co | Stan |
|---|---|
| Branch główny | `main` — od 2026-08-13 zawiera już cały plan portu na Androida/MD3 (branch `cursor/android-port-0f40` zmergowany fast-forward, PR #1) |
| Łączność z backendem | ✅ Zweryfikowana przez Tailscale (agent chmurowy dołączony do tailnetu) — `GET /health` i `GET /portal/health` na `100.66.57.89:3000` odpowiadają 200. Węzeł `vps-edge` jest offline — **pomijamy go na czas developmentu**, praca idzie przez SSH bezpośrednio na `server` (`ygor@100.66.57.89`, Tailscale SSH, bez kluczy) |
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

> **[KOREKTA]** Wcześniejszy plan „`git checkout android` + `git pull`" jest nieaktualny — branch `android` **nigdy nie istniał** w tym repo (zdalnie jest tylko `main`). Roboczym branchem jest `cursor/android-port-0f40` — na nim zostaje cała dalsza praca (redesign MD3 włącznie).

- [x] Branch `cursor/android-port-0f40` utworzony i wypchnięty na origin
- [x] `scripts/pack-local-for-windows.sh` — pakuje `.local-credentials/`, `.env*`, `dev.db` do zipa z hasłem, do transferu Mac → Windows przez LocalSend
- [x] `app.json` — sekcja `android` już skonfigurowana: `package: com.ygor.kolejarz`, adaptive icon (foreground/background/monochrome — assety obecne w `assets/`), permissions biometrii
- [ ] Transfer: `git clone`/`git pull` na Windows (kod) + rozpakowanie zipa sekretów (LocalSend)
- [ ] `npm install` w `mind-app` i `mind-backend` na Windows
- [ ] Łączność Windows ↔ backend VPS **przez Tailscale** (nie przez publiczne IP) — do skonfigurowania na Windows/VPS; test bezpośredni na publiczne IP z zewnętrznego środowiska (bez Tailscale) dał `Connection reset`/timeout, ale to nie jest realny sygnał awarii, bo produkcyjna ścieżka dostępu to Tailscale
- [ ] `npx expo run:android --device` na Pixel 9a
- [ ] Bugtest OOTB na Androidzie: rejestracja → sync grafiku → wyszukanie pociągu PLK → nowe wpisy w `known-bugs.md` (KB-013+)
- [ ] Drobny porządek: `app.json → android.permissions` ma zduplikowane wpisy `USE_BIOMETRIC` / `USE_FINGERPRINT` (każdy 2×) — do wyczyszczenia przy najbliższej edycji

---

## Redesign Material Design 3 (Android jako jedyna platforma)

> **Decyzje (2026-08-13):** iOS — koniec developmentu, Android to jedyna aktywna platforma, ewentualne kolejne wersje iOS byłyby portem *z* Androida (nie równoległy tor) → nie trzymamy dwóch systemów designu, jeden MD3 wszędzie. Komponenty: realne `react-native-paper` (już zależność, prawie nieużywana) zamiast custom `TouchableOpacity`/`PressScale`, bez `reanimated`/`lottie` (wydajność na średnim sprzęcie). Dynamic color: `@pchmn/expo-material3-theme` (Material You z tapety na Androidzie 12+, fallback statyczny poniżej). Nawigacja: hybrydowa — wykrywanie trybu systemowego (przyciski vs gesty) + override w Ustawieniach (Auto/Przyciski/Gesty); tryb „Przyciski" → trwały `NavigationBar`, tryb „Gesty" → obecny model (dashboard-kafelki + swipe-back). Top app bar: pełny MD3 „large top app bar" ze scroll-collapse, nie uproszczony. Zakres: pełny redesign wszystkich 27 ekranów jako główny nurt (nie tylko port funkcjonalny + fixy później).

### Faza 0 — Infrastruktura (przed czymkolwiek innym)
- [x] Backend VPS: potwierdzić łączność **przez Tailscale** (`GET /health`, `GET /portal/health`) — **zweryfikowane 2026-08-13**: agent chmurowy dołączony do tailnetu (`tailscale up`), oba endpointy odpowiadają 200 (`/portal/health` zwraca nawet `loggedIn: true` ze świeżym `lastSyncAt`). Węzeł `server` (100.66.57.89) online, dostępny też po SSH bez kluczy (Tailscale SSH). Węzeł `vps-edge` offline — pomijamy, pracujemy bezpośrednio na `server`
- [ ] Portal IVU: `https://portal.intercity.pl/` z IP VPS — zwraca 403 (Akamai blokuje IP centrów danych), to znany, odroczony problem — **KB-002**, nie nowa awaria
- [x] Jeśli po weryfikacji przez Tailscale coś nadal nie działa — nowy wpis w `known-bugs.md` — **nie potrzebne, wszystko działa poprawnie**

### Faza 1 — Fundament: zależności i konfiguracja natywna
- [ ] Dodać `@pchmn/expo-material3-theme` + `@material/material-color-utilities` do `mind-app/package.json`
- [ ] `app.json`: network security config / `usesCleartextTraffic` dla HTTP do VPS (odpowiednik ATS-exception, którą ma iOS) — bez tego Android 9+ blokuje sync grafiku
- [ ] `app.json`: dodać `expo-notifications` do `plugins` (obecnie brak — Android 13+ `POST_NOTIFICATIONS` może wymagać explicit config)
- [ ] `app.json`: wyczyścić zduplikowane `android.permissions`
- [ ] `eas.json`: dodać sekcję `android` (obecnie tylko iOS)
- [ ] Oznaczyć jako legacy (bez usuwania na tym etapie): `services/appUpdate.ts` (AltStore/IPA flow), `mind-backend/src/altstoreSource.ts` — nieaktywne dla Androida

### Faza 2 — System tokenów MD3 (kolor, typografia, kształt)
- [ ] Zastąpić `Colors.dark`/`Colors.light` w `constants/theme.ts` (obecne kolory systemowe iOS) prawdziwymi tonalnymi paletami MD3 generowanymi z seed color — 6 obecnych presetów akcentu jako seed + 7. opcja „Automatyczny (Material You)" jako domyślna na Androidzie 12+
- [ ] Scalić dwa równoległe API kolorów (`useColors()` vs `useTheme().colors`) w jedno źródło prawdy z pełnym zestawem ról MD3 (`primary`, `onPrimary`, `primaryContainer`, `surfaceVariant`, `outline`...)
- [ ] Wpisać `useMaterial3Theme()` w `app/_layout.tsx` — `PaperProvider` dostaje motyw dynamiczny (Android 12+) albo statyczny z seed (fallback)
- [ ] `constants/layout.ts`: zamienić `radius`/`iosContinuousCurve`/touch target 44pt na skalę MD3 (shape 4/8/12/16/28dp, touch target 48dp, elewacja poziomów 0–5 zamiast płaskich kart)
- [ ] Zdefiniować typografię MD3 (display/headline/title/body/label) w miejsce ad-hoc rozmiarów
- [ ] Usunąć `Platform.OS === 'ios'` developerki wizualne (`iosContinuousCurve` w ~6 plikach) — jeden design

### Faza 3 — Biblioteka komponentów bazowych
- [ ] `components/Screen.tsx` + `components/ScreenHeader.tsx` → MD3 large top app bar ze scroll-collapse (na `Animated.ScrollView` + interpolacja, bez reanimated)
- [ ] `PressScale`/`TouchableOpacity` + `activeOpacity` → komponenty Paper (`Button`, `Card`, `List.Item`, `IconButton`) z natywnym ripple
- [ ] Nowy `components/NavigationBar.tsx` (MD3 dolna nawigacja: Praca / Monitorowanie / Ustawienia), renderowany warunkowo w trybie „Przyciski"
- [ ] Nowy `hooks/useNavigationMode.ts` — heurystyka gestów vs przycisków (`useSafeAreaInsets().bottom`) + override z Ustawień, zapis AsyncStorage
- [ ] Uporządkować nieużywane komponenty: `ErrorBoundary.tsx` (nigdzie zaimportowany), `HapticButton.tsx` (nigdzie zaimportowany), zunifikować `Skeleton.tsx`/`SkeletonLoader.tsx`
- [ ] `services/haptics.ts` — niezaimportowany mimo ~200 ręcznych wywołań `expo-haptics` — przejść na ten helper przy przepisywaniu ekranów

### Faza 4 — Adaptacyjna nawigacja
- [ ] Ustawienia: nowa sekcja „Styl nawigacji" — Auto / Przyciski / Gesty
- [ ] Tryb „Przyciski": trwały `NavigationBar` + pod-toggle „Włącz gesty"
- [ ] Tryb „Gesty": bez trwałego bottom bara, model jak dotychczas (dashboard-kafelki, swipe-back), przemalowany na MD3
- [ ] Do zweryfikowania na Pixelu — heurystyka insets nie jest 100% pewna na wszystkich OEM-ach, override w Ustawieniach to siatka bezpieczeństwa, nie opcja

### Faza 5 — Redesign ekranów (27 plików), w kolejności
1. Fundament: `app/_layout.tsx`, `app/(app)/_layout.tsx`, `app/(auth)/_layout.tsx`
2. Auth: `app/(auth)/login.tsx` (PIN pad + biometria), `app/(auth)/register.tsx`
3. Dashboard: `app/(app)/index.tsx`
4. Ustawienia (już częściowo Paper): `settings/index.tsx`, `settings/diagnostics.tsx`
5. Praca — hub: `work/index.tsx`
6. Praca — pozostałe 11 ekranów (`schedule`, `accounts`, `timecard`, `trains`, `station`, `abc`, `dodatki`, `routes`, `duty-details`, `portal-messages`, `crew`)
7. Komunikaty (`work/messages/` — 8 ekranów)
8. Monitorowanie: `monitoring/index.tsx`

### Faza 6 — Poprawki Android-specific (niezależne od wizualnego redesignu)
- [ ] Copy biometrii: „Face ID" → generyczne („Biometria"/„Odcisk palca"), ikona `face-recognition` → `fingerprint` na Androidzie (`AuthContext.tsx`, `biometricAuth.ts`, `login.tsx`, `settings/index.tsx`)
- [ ] Kanały powiadomień: dodać `channelId` w `services/stationNotifications.ts` i `scheduleTimecardReminder` w `services/work.ts` (dziś tylko `services/notifications.ts` to robi) + ujednolicić branding tytułu („Asystent" vs „Karta pracy")
- [ ] `services/appUpdate.ts`: `checkForUpdatesOnLaunch()` obecnie wyłączone na Androidzie — zdecydować o strategii OTA/EAS Update

### Faza 7 — Test na urządzeniu (Windows + Pixel 9a)
- [ ] `npx expo run:android --device` po transferze na Windows
- [ ] Manualnie: dynamic color (zmiana tapety), heurystyka nav mode, biometria (odcisk palca), kanały powiadomień (w tym `TIME_INTERVAL` w `stationNotifications.ts` — ograniczona niezawodność na Androidzie), cleartext HTTP przez Tailscale
- [ ] Nowe wpisy `known-bugs.md` (KB-013+)

### Ryzyka MD3/Android
- `@pchmn/expo-material3-theme` wymaga native build — nie działa w Expo Go, tylko `expo run:android`
- Heurystyka wykrywania trybu nawigacji nie jest oficjalnym API — różni się między producentami, override w Ustawieniach obowiązkowy
- Skala: 27 ekranów, ~1665 linii custom stylów — pełny redesign (nie tylko port funkcjonalny) to duży, wieloetapowy nakład pracy

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
- [x] `npx prisma migrate deploy` na VPS po dodaniu `Tenant`/`AppSession` — **zweryfikowane 2026-08-13** przez SSH na `server`: kontener `kolejarz` ma obie tabele z realnymi danymi (`Tenant.count() = 2`, `AppSession.count() = 8`), migracja przeszła poprawnie (patrz `known-bugs.md` KB-007)

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
