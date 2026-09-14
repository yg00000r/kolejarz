# Kolejarz — Tasks

> Format: `- [x]` zrobione · `- [ ]` do zrobienia · `- [~]` w trakcie / częściowo
>
> **Zweryfikowano automatycznie:** 2026-08-13 (cloud agent) — `npx tsc --noEmit` w obu projektach, `npx prisma generate`, przegląd kodu backendu/frontend względem tego, co ten plik wcześniej deklarował jako zrobione. Punkty oznaczone **[KOREKTA]** zostały poprawione, bo nie zgadzały się ze stanem repo.
>
> **Migracja do GitHub Issues (2026-08-13):** cały backlog z tego pliku został rozpisany z kodowaniem etap/zadanie (A1, A2, B1...) w [docs/GITHUB_ISSUES_PLAN.md](docs/GITHUB_ISSUES_PLAN.md), z priorytetami i dopiskiem `(MC)` dla zadań wykonywalnych w całości przez agenta chmurowego. Do faktycznego utworzenia issues służy `scripts/create-github-issues.sh` — agent chmurowy nie ma uprawnienia do zapisu w GitHub Issues tego repo (`403 Resource not accessible by integration`), więc skrypt trzeba odpalić lokalnie z uprawnionym `gh`. Ten plik zostaje źródłem prawdy do czasu wykonania migracji.

---

## Przygotowanie lokalne pod iOS (prywatny Mac) — aktywne

Cel: pliki na prywatnym komputerze, zależności, odbudowa sekretów, gotowość pod kolejne fazy iOS.

- [x] Dokumentacja pobrania repo + toolchain Mac/Xcode/Expo — `docs/LOCAL_IOS_SETUP.md`
- [x] Audyt sekretów w kodzie + procedura rotacji — `docs/SECRETS_AUDIT.md`
- [x] `scripts/setup-local-env.sh` — bootstrap `.env`, `ENCRYPTION_KEY`, `npm install`
- [x] `EXPO_PUBLIC_API_URL` faktycznie czytany w `mind-app/constants/api.ts`
- [x] Usunięty hardcoded fallback loginu IVU z `defaultPortalUser()` (wymaga `PORTAL_USER` lub explicit user)
- [ ] **Na prywatnym Macu (Ty):** `git clone` / `git pull`, `bash scripts/setup-local-env.sh`
- [ ] **Na prywatnym Macu:** uzupełnić `PLK_API_KEY` (nowy, jeśli stary mógł wyciec)
- [ ] **Na VPS (jeśli wyciek `.env`):** nowy `ENCRYPTION_KEY` + re-rejestracja tenantów + rotacja SSH
- [ ] Smoke: Expo Go lub `npx expo run:ios --device` → rejestracja → sync

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
- [x] Drobny porządek: `app.json → android.permissions` miał zduplikowane wpisy `USE_BIOMETRIC` / `USE_FINGERPRINT` (każdy 2×) — wyczyszczone w ramach **D3**

---

## Redesign Material Design 3 (Android jako jedyna platforma)

> **Decyzje (2026-08-13):** iOS — koniec developmentu, Android to jedyna aktywna platforma, ewentualne kolejne wersje iOS byłyby portem *z* Androida (nie równoległy tor) → nie trzymamy dwóch systemów designu, jeden MD3 wszędzie. Komponenty: realne `react-native-paper` (już zależność, prawie nieużywana) zamiast custom `TouchableOpacity`/`PressScale`, bez `reanimated`/`lottie` (wydajność na średnim sprzęcie). Dynamic color: `@pchmn/expo-material3-theme` (Material You z tapety na Androidzie 12+, fallback statyczny poniżej). Nawigacja: hybrydowa — wykrywanie trybu systemowego (przyciski vs gesty) + override w Ustawieniach (Auto/Przyciski/Gesty); tryb „Przyciski" → trwały `NavigationBar`, tryb „Gesty" → obecny model (dashboard-kafelki + swipe-back). Top app bar: pełny MD3 „large top app bar" ze scroll-collapse, nie uproszczony. Zakres: pełny redesign wszystkich 27 ekranów jako główny nurt (nie tylko port funkcjonalny + fixy później).

### Faza 0 — Infrastruktura (przed czymkolwiek innym)
- [x] Backend VPS: potwierdzić łączność **przez Tailscale** (`GET /health`, `GET /portal/health`) — **zweryfikowane 2026-08-13**: agent chmurowy dołączony do tailnetu (`tailscale up`), oba endpointy odpowiadają 200 (`/portal/health` zwraca nawet `loggedIn: true` ze świeżym `lastSyncAt`). Węzeł `server` (100.66.57.89) online, dostępny też po SSH bez kluczy (Tailscale SSH). Węzeł `vps-edge` offline — pomijamy, pracujemy bezpośrednio na `server`
- [ ] Portal IVU: `https://portal.intercity.pl/` z IP VPS — zwraca 403 (Akamai blokuje IP centrów danych), to znany, odroczony problem — **KB-002**, nie nowa awaria
- [x] Jeśli po weryfikacji przez Tailscale coś nadal nie działa — nowy wpis w `known-bugs.md` — backend/portal działają poprawnie, ale węzeł `vps-edge` jest offline → opisane jako **KB-013** (niski priorytet, nie blokuje)

### Faza 1 — Fundament: zależności i konfiguracja natywna ✅ (2026-08-13, D1–D5)
- [x] **D1** — Dodano `@pchmn/expo-material3-theme` (^1.4.0) + `@material/material-color-utilities` (^0.4.0) do `mind-app/package.json`. Tylko instalacja — wiring (`useMaterial3Theme()` w `_layout.tsx`) to Faza 2 (E3)
- [x] **D2** — `app.json`: nowy plik `network-security-config.xml` (odpowiednik ATS-exception z iOS) + plugin `expo-network-security-config` — cleartext HTTP dozwolony tylko dla `57.128.246.232` (aktualny `BASE_URL`), plus `<debug-overrides>` pozwalające na cleartext do dowolnego LAN IP w buildach `debuggable` (dev-client/`expo run:android`, testy z Windows/Pixel na osiedlowej sieci). Zweryfikowane realnym `npx expo prebuild --platform android` — atrybut `android:networkSecurityConfig` i plik w `res/xml/` wygenerowane poprawnie. Do usunięcia po domknięciu **B4/KB-014** (HTTPS)
- [x] **D3** — `app.json`: dodano `expo-notifications` do `plugins` (ikona `android-icon-monochrome.png`, kolor `#007AFF` — Android 13+ `POST_NOTIFICATIONS` + kanały mają teraz explicit config) i wyczyszczono zduplikowane `android.permissions`
- [x] **D4** — `eas.json`: sekcja `android` dla wszystkich profili — `development`/nowy `preview` (APK, do sideloadu na Pixela), `production` (`app-bundle`, na przyszłość pod Play Store)
- [x] **D5** — Oznaczone jako `LEGACY` komentarzem w kodzie (bez usuwania): `mind-backend/src/altstoreSource.ts` (zrobione przy **C3**), `mind-app/services/appUpdate.ts` (cała ścieżka `nativeUpdate`/AltStore/IPA — iOS-only, zamrożona; część OTA przez `expo-updates` zostaje, ale docelowa strategia dla Androida to osobne zadanie **I4**)

### Faza 2 — System tokenów MD3 (kolor, typografia, kształt) ✅ (2026-08-13, E1–E6)
- [x] **E1** — `constants/theme.ts`/`hooks/useAppTheme.ts`: `Colors.dark`/`Colors.light` (statyczne kolory iOS) zastąpione tonalnymi paletami MD3 generowanymi z seed color (`@pchmn/expo-material3-theme` + `@material/material-color-utilities`, zainstalowane w D1) — 6 presetów akcentu jako seed + 7. opcja „Automatyczny (Material You)" (`ACCENT_AUTO`), domyślna dla nowych instalacji, dynamic color z tapety na Androidzie 12+ (fallback na seed niżej)
- [x] **E2** — `useColors()` i `useTheme().colors` scalone w jedno źródło prawdy: `Palette` = pełny `Material3Scheme` (wszystkie role MD3: `primary`, `onPrimary`, `primaryContainer`, `surfaceVariant`, `outline`, `surfaceContainer*`...) + aliasy zgodności (`text`, `textSecondary`, `accent`, `border`, `surfaceSecondary`) dla ~30 istniejących ekranów — zero zmian w tych ekranach, jeden zamiast dwóch niezależnie utrzymywanych systemów
- [x] **E3** — `useMaterial3Theme()` wpięty przez `hooks/useAppTheme.ts` → `ThemeProvider` w `app/_layout.tsx` → `PaperProvider theme={theme}`; reaktywne przełączanie motywu przy zmianie akcentu w Ustawieniach przez `updateTheme()`/`resetTheme()` (hook nie jest domyślnie reaktywny na propsy — wymaga explicit wywołania, obsłużone w `useEffect`)
- [x] **E4** — `constants/layout.ts`: `radius` → prawdziwa skala MD3 (xs 4 / sm 8 / md 12 / lg 16 / xl 28dp, zamiast dawnych 12/16/20/24), `touchTargetMin` 44→48dp (MD3 minimum) — automatycznie propaguje się przez wszystkie ~180 użyć `borderRadius`/`touchTargetMin` w kodzie bez zmian w komponentach
- [x] **E5** — Nowy `hooks/useTypography.ts`: pełna skala MD3 (display/headline/title/body/label × large/medium/small) z `theme.fonts` (`react-native-paper` `MD3LightTheme`/`MD3DarkTheme`, już wpięte przez E1), przeskalowana o `textScaleFactor` (S/M/L z Ustawień). Ad-hoc rozmiary w `constants/layout.ts` (`typography.title` itd.) zostają — użycie nowej skali w komponentach to Faza 3+
- [x] **E6** — Usunięto `iosContinuousCurve` (`borderCurve: 'continuous'` — własność tylko iOS, bez efektu na Androidzie) i towarzyszące `Platform.OS === 'ios'` branche wizualne w 5 plikach (`work/index.tsx`, `app/(app)/index.tsx`, `ScreenHeader.tsx`, `login.tsx`, `register.tsx`) — jeden wygląd. Przy tej samej okazji usunięto 24 martwe importy `import { Colors } from constants/theme` (nigdy realnie nie odwoływały się do `Colors.dark`/`Colors.light`, tylko duplikat z wcześniejszego refaktoru)
- Zweryfikowane: `tsc --noEmit` bez błędów w obu projektach, `npx expo prebuild --platform android` (pluginy z D2/D3 nadal działają), `npx expo export --platform android` (Metro bundluje 1521 modułów bez błędów importów)

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
- [x] Rate limiting na `/auth/*` i `/shifts/sync` (`express-rate-limit`) — **zrobione i zdeployowane 2026-08-13**: `authLimiter` (20 req / 15 min) na `/auth/*`, `syncLimiter` (10 req / 5 min) na `/shifts/sync`. Zweryfikowane lokalnie i **na produkcji** (przez SSH na `server`, `docker compose build && up -d`) — `429` + nagłówki `RateLimit-*`/`Retry-After` po przekroczeniu limitu, `/health`/`/portal/health`/`/consists` dalej działają
- [x] **B5 — Backport produkcyjnych zmian do gita** — **zrobione 2026-08-13**: przy deployu B1 wykryto, że VPS miał kod nigdy niewpushowany do repo (rsync z Maca, nie git): cały feature „składy pociągów" (`services/vagonweb.ts`, model `TrainConsist` + migracja `20260630000000_add_train_consist`, endpointy `GET /consists`, `GET /consists/*cislo`, `POST /consists/sync`, cron tygodniowy) oraz fix bezpieczeństwa w `services/portal.ts` (obsługa `PORTAL_PASSWORD` z env + niedrukowanie surowego hasła w logach, tylko długość). Wszystko backportowane do repo — `mind-backend/src/index.ts`, `services/portal.ts`, `services/vagonweb.ts`, `prisma/schema.prisma` są teraz **bit w bit identyczne** z tym, co faktycznie działa na VPS. **Wniosek na przyszłość:** deploy na VPS musi iść przez git (albo repo staje się źródłem prawdy), nie przez ręczny rsync z lokalnej maszyny — inaczej ta desynchronizacja wróci
- [x] **C1** — Naprawiony błąd `tsc` w `app/(app)/index.tsx` (2026-08-13): `PressScale` dostał `accessibilityLabel`/`accessibilityHint`/`accessibilityRole`/`testID` w typie `Props`, przekazywane do wewnętrznego `Pressable`. `npx tsc --noEmit` przechodzi bez błędów
- [~] **B2** — KB-005 zdiagnozowane 2026-08-13 (przez SSH+Tailscale, na żywej karcie konta tenantId=1): ani HTTP, ani Playwright POST z realnym kontekstem przeglądarki nie działają (portal zwraca `200 {"success":false}` bez błędu — to nie blokada Akamai). Klik UI nie generuje requestu, bo `duty-details` ładowany deep-linkiem nie inicjalizuje jQuery/`AllocationDetails.js` (fragment SPA bez powłoki). Próba logowania przez prawdziwy formularz (`/pad/login`) prowadzi do JSON endpointu `/pad/init-data/1`, nie do powłoki `mbweb` — sugeruje to, że `/pad/*` to protokół natywnej appki **IVU.pad** (tablet/mobile), różny od desktopowego `mbweb/main/matter/desktop/*`, do którego może być wymagana zupełnie inna sesja. **Nie da się kontynuować zdalnie** — potrzebny HAR z realnego, ręcznego potwierdzenia karty (DevTools → Network → Preserve log) od człowieka. Szczegóły w `known-bugs.md` KB-005

### Priorytet normalny
- [ ] Smoke test OOTB: rejestracja z Expo Go → sync grafiku → wyszukanie pociągu PLK
- [ ] Smoke test izolacji: 2 konta IVU → osobne grafiki
- [x] **C4** — Lepsze błędy sync w UI (2026-08-13): `syncShifts`/`syncPortalStatus` parsują teraz body błędu (`{error, detail}`) i klasyfikują przyczynę (login do portalu / blokada Akamai-503 / problem sieciowy) na komunikat PL zamiast generycznego "Nie udało się..."; `work/index.tsx` i `work/timecard.tsx` wyświetlają ten komunikat w `Alert`

### Priorytet niski
- [x] **C3** — `altstoreSource.ts` oceniony (2026-08-13): aktywnie zarejestrowany w `index.ts`, ale **funkcjonalnie bezczynny** (brak `.ipa` w `app-releases/` na VPS → `GET /altstore/source.json` zwraca 404). Zdecydowano: **nie usuwać teraz** — oznaczony komentarzem `LEGACY` w kodzie jako zamrożony po decyzji Android-only, nieszkodliwy w bezczynności. Do ponownej oceny, jeśli iOS zostanie ostatecznie zamknięty (nie tylko zamrożony)
- [~] **B4** — HTTPS na `server` (Caddy) — fix dla KB-001, **przygotowane 2026-08-13, blokowane na 2 kroki manualne**: `server` ma już działający Caddy z automatycznym HTTPS dla `yg00r.com` (systemd, `caddy` aktywny). Przygotowano `scripts/kolejarz-setup-https.sh` (skopiowany też na serwer jako `~/kolejarz-setup-https.sh`), który doda analogiczny blok `kolejarz.yg00r.com → 127.0.0.1:3000`. **Brakuje:** (1) rekord DNS w Cloudflare (`kolejarz` CNAME → `yg00r.com`, proxied) — agent nie ma dostępu do panelu Cloudflare; (2) agent nie ma passwordless sudo na `server` (potrzebne do edycji `/etc/caddy/Caddyfile` i `systemctl reload caddy`) — trzeba ręcznie odpalić `sudo bash ~/kolejarz-setup-https.sh`. Po tych 2 krokach: zweryfikować `curl -sI https://kolejarz.yg00r.com/health`, potem zmienić `BASE_URL` w `mind-app/constants/api.ts` na `https://kolejarz.yg00r.com`. Szczegóły w `known-bugs.md` KB-014
- [x] **C2** — CI: GitHub Actions — `.github/workflows/ci.yml` (2026-08-13): job `backend` (`prisma validate` + `prisma generate && tsc --noEmit`) i job `app` (`tsc --noEmit`), na `pull_request` i push do `main`. Zweryfikowane lokalnie, oba przechodzą
- [x] `tsc --noEmit` bez błędów w obu projektach — backend: ✅ (po `prisma generate`); frontend: ✅ (po fixie C1)

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
