#!/usr/bin/env bash
# Migruje backlog z TASKS.md do GitHub Issues, z kodowaniem etap/zadanie (A1, A2, B1...),
# dopiskiem (MC) dla zadań wykonywalnych w całości przez agenta chmurowego (edycje kodu/
# konfiguracji, bez fizycznego urządzenia / VPS / Windows / Tailscale), i priorytetami.
#
# Wymaga: `gh` CLI zalogowane na koncie z uprawnieniem do zapisu Issues w tym repo
# (agent chmurowy Cursor NIE ma tego uprawnienia — stąd ten skrypt do odpalenia lokalnie).
#
# Użycie:
#   gh auth login          # jeśli jeszcze nie zalogowany, z uprawnieniami repo
#   ./scripts/create-github-issues.sh
#
# UWAGA: nieidempotentny — ponowne odpalenie utworzy duplikaty. Podgląd całej listy:
# docs/GITHUB_ISSUES_PLAN.md
set -euo pipefail

REPO="yg00000r/kolejarz"

echo "Repo: $REPO"
gh repo view "$REPO" >/dev/null || { echo "Brak dostępu do $REPO — sprawdź 'gh auth status'." >&2; exit 1; }

echo "Tworzę etykiety (jeśli nie istnieją)..."
gh label create "priority: high"   --repo "$REPO" --color d73a4a --description "Wysoki priorytet"   --force >/dev/null
gh label create "priority: medium" --repo "$REPO" --color fbca04 --description "Normalny priorytet"  --force >/dev/null
gh label create "priority: low"    --repo "$REPO" --color 0e8a16 --description "Niski priorytet"     --force >/dev/null
gh label create "cursor-mobile"    --repo "$REPO" --color 5319e7 --description "Da się zrobić samą edycją kodu (MC)" --force >/dev/null
for L in A B C D E F G H I J K; do
  gh label create "stage: $L" --repo "$REPO" --color ededed --description "Etap $L" --force >/dev/null
done

# create_issue <id> <title> <mc: yes|no> <priority: high|medium|low> <body via stdin>
create_issue() {
  local id="$1" title="$2" mc="$3" prio="$4"
  local full_title="${id}: ${title}"
  local stage_letter="${id:0:1}"
  local labels=("stage: ${stage_letter}" "priority: ${prio}")
  if [[ "$mc" == "yes" ]]; then
    full_title="${full_title} (MC)"
    labels+=("cursor-mobile")
  fi
  local label_args=()
  for l in "${labels[@]}"; do label_args+=(--label "$l"); done
  local body
  body="$(cat)"
  echo "→ ${full_title}"
  gh issue create --repo "$REPO" --title "$full_title" --body "$body" "${label_args[@]}" >/dev/null
}

# ── A — Infrastruktura i łączność ──────────────────────────────────────────
create_issue "A1" "Zweryfikować łączność z backendem VPS przez Tailscale" no high <<'EOF'
Backend jest osiągalny przez Tailscale, nie przez publiczne IP. Sprawdzić `GET /health`
i `GET /portal/health` z Windows/Pixela po skonfigurowaniu Tailscale.

Test bezpośredni na publiczne IP z środowiska bez Tailscale zawiódł
(`Connection reset`/timeout), ale to nie jest wiarygodny sygnał awarii.

Źródło: TASKS.md → Redesign MD3 → Faza 0.
EOF

create_issue "A2" "Nowy wpis w known-bugs.md, jeśli po teście przez Tailscale coś nie działa" no medium <<'EOF'
Zależne od wyniku A1. Jeśli po weryfikacji przez Tailscale backend/portal nadal
nie działa poprawnie, opisać w `known-bugs.md` jako nowy wpis (KB-013+).
EOF

# ── B — Backend: stabilność i bezpieczeństwo ───────────────────────────────
create_issue "B1" "Rate limiting na /auth/* i /shifts/sync" yes high <<'EOF'
Dodać `express-rate-limit` na endpointy `/auth/*` i `/shifts/sync` w
`mind-backend/src/index.ts`. Pakiet nadal nie jest zainstalowany.

Źródło: TASKS.md → Backlog (priorytet wysoki).
EOF

create_issue "B2" "Debug KB-005 — confirm-timecard (Playwright) niestabilny na VPS" no high <<'EOF'
`POST /portal/confirm-timecard` jest zaimplementowany (HTTP + fallback Playwright w
`mind-backend/src/services/portal-browser.ts`), ale działanie na produkcji jest
niestabilne. Debug flow na VPS albo reverse proxy z sieci firmowej (patrz KB-002).

Źródło: known-bugs.md KB-005, TASKS.md → Backend/multi-tenant.
EOF

create_issue "B3" "npx prisma migrate deploy na VPS po Tenant/AppSession" no high <<'EOF'
Migracja Prisma nie została zweryfikowana na produkcyjnej bazie VPS po dodaniu
modeli `Tenant`/`AppSession`. Wymaga dostępu SSH do VPS (maintainer).

Źródło: known-bugs.md KB-007, TASKS.md → Backend/multi-tenant.
EOF

create_issue "B4" "HTTPS na VPS (Caddy) — fix KB-001" no low <<'EOF'
Długoterminowy fix dla KB-001 (Expo Go + iOS ATS blokuje HTTP) — HTTPS z certyfikatem
Let's Encrypt (Caddy/Nginx) na VPS. Wymaga dostępu do VPS.

Źródło: known-bugs.md KB-001, TASKS.md → Backlog (priorytet niski).
EOF

# ── C — Jakość kodu i CI ───────────────────────────────────────────────────
create_issue "C1" "Naprawić błąd tsc: PressScale + accessibilityLabel" yes high <<'EOF'
`app/(app)/index.tsx:129` przekazuje `accessibilityLabel` do `PressScale`, którego typ
`Props` (`mind-app/components/PressScale.tsx`) tego propa nie zawiera. Znaleziony
automatycznie przez `npx tsc --noEmit` w mind-app.

Źródło: TASKS.md → Backlog (priorytet wysoki).
EOF

create_issue "C2" "CI: GitHub Actions — tsc --noEmit + prisma validate" yes low <<'EOF'
Brak `.github/workflows` w repo. Dodać workflow uruchamiający `tsc --noEmit` w obu
projektach i `prisma validate` na PR.

Źródło: TASKS.md → Backlog (priorytet niski).
EOF

create_issue "C3" "Ocenić altstoreSource.ts — uprościć/usunąć jeśli nieaktywny" yes low <<'EOF'
`mind-backend/src/altstoreSource.ts` jest aktywnie zarejestrowany w `index.ts`
(`registerAltStoreSourceRoutes`) — to nie jest dead code. Ocenić realną potrzebę
(domena AltStore może być nieaktywna) przed usunięciem/uproszczeniem. Powiązane z I4
(iOS-only distribution, zamrożone po decyzji Android-only).

Źródło: TASKS.md → Backlog (priorytet niski).
EOF

create_issue "C4" "Lepsze błędy sync w UI — parsować body 502" yes medium <<'EOF'
Pokazać przyczynę błędu synchronizacji (portal vs sieć) w UI, parsując body
odpowiedzi 502 z backendu, zamiast generycznego komunikatu.

Źródło: TASKS.md → Backlog (priorytet normalny).
EOF

# ── D — Android: fundament (zależności, konfiguracja natywna) ─────────────
create_issue "D1" "Dodać @pchmn/expo-material3-theme + material-color-utilities" yes high <<'EOF'
Dodać `@pchmn/expo-material3-theme` i `@material/material-color-utilities` do
`mind-app/package.json` — biblioteka dynamic color (Material You) na Androidzie 12+,
z generowaniem palety z seed color jako fallback.

Źródło: TASKS.md → Redesign MD3 → Faza 1.
EOF

create_issue "D2" "app.json: network security config / usesCleartextTraffic" yes high <<'EOF'
Android 9+ domyślnie blokuje cleartext HTTP. `mind-app/app.json` ma wyjątek ATS tylko
dla iOS — dodać odpowiednik dla Androida (network security config /
`usesCleartextTraffic`), inaczej sync grafiku nie zadziała na urządzeniu.

Źródło: TASKS.md → Redesign MD3 → Faza 1.
EOF

create_issue "D3" "app.json: expo-notifications plugin + dedupe permissions" yes high <<'EOF'
- Dodać `expo-notifications` do `plugins` w `mind-app/app.json` (obecnie brak — Android
  13+ `POST_NOTIFICATIONS` może wymagać explicit config).
- Wyczyścić zduplikowane wpisy w `android.permissions` (`USE_BIOMETRIC` /
  `USE_FINGERPRINT`, każdy 2×).

Źródło: TASKS.md → Redesign MD3 → Faza 1 / Port na Androida.
EOF

create_issue "D4" "eas.json: dodać profil android" yes medium <<'EOF'
`mind-app/eas.json` ma tylko profile iOS (`development`, `production`). Dodać sekcję
`android` do obu profili.

Źródło: TASKS.md → Redesign MD3 → Faza 1.
EOF

create_issue "D5" "Oznaczyć appUpdate.ts / altstoreSource.ts jako legacy dla Androida" yes low <<'EOF'
`mind-app/services/appUpdate.ts` (AltStore/IPA flow) i
`mind-backend/src/altstoreSource.ts` są nieaktywne dla Androida po decyzji o
zamrożeniu iOS. Oznaczyć jako legacy w kodzie/komentarzach, bez usuwania na tym etapie.

Źródło: TASKS.md → Redesign MD3 → Faza 1.
EOF

# ── E — Android/MD3: system tokenów (kolor, typografia, kształt) ──────────
create_issue "E1" "Tonalne palety MD3 z seed color w constants/theme.ts" yes high <<'EOF'
Zastąpić `Colors.dark`/`Colors.light` w `mind-app/constants/theme.ts` (obecne kolory
systemowe iOS) prawdziwymi tonalnymi paletami MD3 generowanymi z seed color
(`material-color-utilities`) — 6 obecnych presetów akcentu jako seed + 7. opcja
„Automatyczny (Material You)" jako domyślna na Androidzie 12+.

Źródło: TASKS.md → Redesign MD3 → Faza 2.
EOF

create_issue "E2" "Scalić useColors() i useTheme().colors w jedno API" yes high <<'EOF'
Dwa równoległe API kolorów (`useColors()` — custom 10 tokenów, `useTheme().colors` —
Paper MD3) nakładają się tylko częściowo. Scalić w jedno źródło prawdy z pełnym
zestawem ról MD3 (`primary`, `onPrimary`, `primaryContainer`, `surfaceVariant`,
`outline`...).

Pliki: `mind-app/contexts/ThemeContext.tsx`, `mind-app/hooks/useAppTheme.ts`.

Źródło: TASKS.md → Redesign MD3 → Faza 2.
EOF

create_issue "E3" "Wpisać useMaterial3Theme() (dynamic color) w app/_layout.tsx" yes high <<'EOF'
`PaperProvider` w `mind-app/app/_layout.tsx` ma dostać motyw dynamiczny (Android 12+,
z tapety użytkownika) albo statyczny z seed color jako fallback, przez hook
`useMaterial3Theme()` z D1.

Źródło: TASKS.md → Redesign MD3 → Faza 2.
EOF

create_issue "E4" "constants/layout.ts → MD3 shape scale + touch target 48dp" yes medium <<'EOF'
Zamienić `radius`/`iosContinuousCurve`/touch target 44pt w
`mind-app/constants/layout.ts` na skalę MD3 (shape 4/8/12/16/28dp, touch target 48dp,
elewacja poziomów 0–5 zamiast płaskich kart).

Źródło: TASKS.md → Redesign MD3 → Faza 2.
EOF

create_issue "E5" "Typografia MD3 (display/headline/title/body/label)" yes medium <<'EOF'
Zdefiniować typografię MD3 (role display/headline/title/body/label) w miejsce
ad-hoc rozmiarów w `mind-app/constants/layout.ts`.

Źródło: TASKS.md → Redesign MD3 → Faza 2.
EOF

create_issue "E6" "Usunąć iosContinuousCurve / Platform.OS ios developerki wizualne" yes medium <<'EOF'
Po decyzji o zamrożeniu iOS (jeden design, nie dwa) usunąć `iosContinuousCurve` i
warunki `Platform.OS === 'ios'` czysto wizualne w ~6 plikach (m.in. `login.tsx`,
`register.tsx`, `ScreenHeader.tsx`, dashboard, work hub).

Źródło: TASKS.md → Redesign MD3 → Faza 2.
EOF

# ── F — Android/MD3: komponenty bazowe ─────────────────────────────────────
create_issue "F1" "Screen.tsx + ScreenHeader.tsx → MD3 large top app bar" yes high <<'EOF'
Przebudować `mind-app/components/Screen.tsx` i `mind-app/components/ScreenHeader.tsx`
na MD3 „large top app bar" ze scroll-collapse (na `Animated.ScrollView` +
interpolacja, bez `reanimated` — zgodnie z decyzją o wydajności na średnim sprzęcie).

Źródło: TASKS.md → Redesign MD3 → Faza 3 (decyzja C5 — pełny wariant, nie uproszczony).
EOF

create_issue "F2" "Migracja PressScale/TouchableOpacity → komponenty Paper" yes high <<'EOF'
Zastąpić `PressScale`/`TouchableOpacity` + `activeOpacity` komponentami
`react-native-paper` (`Button`, `Card`, `List.Item`, `IconButton`) z natywnym ripple,
tam gdzie Paper nie pokrywa przypadku — `Pressable android_ripple`.

Źródło: TASKS.md → Redesign MD3 → Faza 3 (decyzja B2).
EOF

create_issue "F3" "Nowy komponent components/NavigationBar.tsx" yes high <<'EOF'
Nowy komponent MD3 dolnej nawigacji (Praca / Monitorowanie / Ustawienia),
renderowany warunkowo w trybie „Przyciski" (patrz G).

Źródło: TASKS.md → Redesign MD3 → Faza 3.
EOF

create_issue "F4" "Nowy hook hooks/useNavigationMode.ts" yes high <<'EOF'
Heurystyka wykrywania trybu nawigacji systemowej (gesty vs przyciski) na bazie
`useSafeAreaInsets().bottom`, plus odczyt override z Ustawień (Auto/Przyciski/Gesty),
zapis w AsyncStorage.

Źródło: TASKS.md → Redesign MD3 → Faza 3 / Faza 4 (decyzja C4).
EOF

create_issue "F5" "Uporządkować ErrorBoundary/HapticButton/Skeleton/SkeletonLoader" yes low <<'EOF'
- `mind-app/components/ErrorBoundary.tsx` — nigdzie zaimportowany, wpiąć w root layout
  albo usunąć.
- `mind-app/components/HapticButton.tsx` — nigdzie zaimportowany, scalić z nowym
  `Button` albo usunąć.
- `mind-app/components/Skeleton.tsx` vs `SkeletonLoader.tsx` — dwa równoległe
  warianty, zunifikować do jednego.

Źródło: TASKS.md → Redesign MD3 → Faza 3.
EOF

create_issue "F6" "Adopcja services/haptics.ts w miejsce ręcznych wywołań" yes low <<'EOF'
`mind-app/services/haptics.ts` istnieje (`haptic(type)`), ale jest niezaimportowany
mimo ~200 ręcznych wywołań `expo-haptics` w kodzie. Przejść na ten helper przy
przepisywaniu ekranów (Faza H).

Źródło: TASKS.md → Redesign MD3 → Faza 3.
EOF

# ── G — Android/MD3: adaptacyjna nawigacja ─────────────────────────────────
create_issue "G1" "Ustawienia: sekcja Styl nawigacji (Auto/Przyciski/Gesty)" yes high <<'EOF'
Nowa sekcja w `mind-app/app/(app)/settings/index.tsx` — wybór Auto / Przyciski / Gesty,
zapis w AsyncStorage (spięte z F4).

Źródło: TASKS.md → Redesign MD3 → Faza 4 (decyzja C4).
EOF

create_issue "G2" "Tryb Przyciski: trwały NavigationBar + pod-toggle Włącz gesty" yes high <<'EOF'
W trybie „Przyciski" renderować trwały `NavigationBar` (F3) u dołu ekranu, z
dodatkowym pod-toggle „Włącz gesty" (swipe-back nawet z widocznym bottom barem).

Źródło: TASKS.md → Redesign MD3 → Faza 4.
EOF

create_issue "G3" "Tryb Gesty: przemalować obecny model na MD3" yes high <<'EOF'
W trybie „Gesty" zostaje obecny model (dashboard-kafelki, `gestureEnabled: true`,
`slide_from_right`) bez trwałego bottom bara — tylko przemalowany na tokeny MD3 z
etapu E.

Źródło: TASKS.md → Redesign MD3 → Faza 4.
EOF

create_issue "G4" "Weryfikacja heurystyki nav mode na realnym Pixelu 9a" no medium <<'EOF'
Heurystyka insets (F4) nie jest oficjalnym API i może się różnić między producentami
(Samsung/OnePlus mają własne skiny). Zweryfikować na fizycznym Pixel 9a, override w
Ustawieniach jest siatką bezpieczeństwa, nie opcją.

Źródło: TASKS.md → Redesign MD3 → Faza 4 / Ryzyka.
EOF

# ── H — Android/MD3: redesign ekranów ──────────────────────────────────────
create_issue "H1" "Fundament layoutów (_layout.tsx x3)" yes high <<'EOF'
Redesign `mind-app/app/_layout.tsx`, `mind-app/app/(app)/_layout.tsx`,
`mind-app/app/(auth)/_layout.tsx` na nowy motyw/nawigację z etapów D–G.

Źródło: TASKS.md → Redesign MD3 → Faza 5, krok 1.
EOF

create_issue "H2" "Auth: login.tsx (PIN + biometria) + register.tsx" yes high <<'EOF'
Redesign `mind-app/app/(auth)/login.tsx` (PIN pad + przycisk biometrii) i
`mind-app/app/(auth)/register.tsx` na MD3.

Źródło: TASKS.md → Redesign MD3 → Faza 5, krok 2.
EOF

create_issue "H3" "Dashboard: app/(app)/index.tsx" yes high <<'EOF'
Redesign głównego ekranu dashboardu na MD3 (karty modułów Praca/Monitorowanie).

Źródło: TASKS.md → Redesign MD3 → Faza 5, krok 3.
EOF

create_issue "H4" "Ustawienia: settings/index.tsx + settings/diagnostics.tsx" yes high <<'EOF'
Redesign ekranów Ustawień (już częściowo używa Paper `Switch`) na pełne MD3.

Źródło: TASKS.md → Redesign MD3 → Faza 5, krok 4.
EOF

create_issue "H5" "Praca — hub: work/index.tsx" yes medium <<'EOF'
Redesign huba modułu Praca (grid/list sub-modułów) na MD3.

Źródło: TASKS.md → Redesign MD3 → Faza 5, krok 5.
EOF

create_issue "H6" "Praca — pozostałe 11 ekranów" yes medium <<'EOF'
Redesign: `schedule.tsx`, `accounts.tsx`, `timecard.tsx`, `trains.tsx`, `station.tsx`,
`abc.tsx`, `dodatki.tsx`, `routes.tsx`, `duty-details.tsx`, `portal-messages.tsx`,
`crew.tsx` — wszystkie w `mind-app/app/(app)/work/`.

Źródło: TASKS.md → Redesign MD3 → Faza 5, krok 6.
EOF

create_issue "H7" "Komunikaty — work/messages/ (8 ekranów)" yes medium <<'EOF'
Redesign modułu Komunikaty radiowe: `index.tsx`, `classic.tsx`, `compose.tsx`,
`preview.tsx`, `queue.tsx`, `session.tsx`, `setup-run.tsx`, `watch.tsx` w
`mind-app/app/(app)/work/messages/`.

Źródło: TASKS.md → Redesign MD3 → Faza 5, krok 7.
EOF

create_issue "H8" "Monitorowanie: monitoring/index.tsx" yes low <<'EOF'
Redesign ekranu Monitorowania (VPS, Docker, pingi urządzeń) na MD3.

Źródło: TASKS.md → Redesign MD3 → Faza 5, krok 8.
EOF

# ── I — Android: poprawki specyficzne ──────────────────────────────────────
create_issue "I1" "Copy biometrii: Face ID → generyczne + ikona fingerprint" yes high <<'EOF'
Zmienić copy „Face ID" na generyczne („Biometria"/„Odcisk palca") i ikonę
`face-recognition` → `fingerprint` na Androidzie (przez `Platform.select`, bez łamania
iOS).

Pliki: `mind-app/contexts/AuthContext.tsx`, `mind-app/contexts/biometricAuth.ts`,
`mind-app/app/(auth)/login.tsx`, `mind-app/app/(app)/settings/index.tsx`.

Źródło: TASKS.md → Redesign MD3 → Faza 6.
EOF

create_issue "I2" "Kanały powiadomień: channelId w stationNotifications.ts i work.ts" yes high <<'EOF'
`mind-app/services/stationNotifications.ts` i `scheduleTimecardReminder` w
`mind-app/services/work.ts` nie ustawiają `channelId` na Androidzie (w przeciwieństwie
do `services/notifications.ts`) — ryzyko cichych/zgubionych powiadomień na
Androidzie 8+.

Źródło: TASKS.md → Redesign MD3 → Faza 6.
EOF

create_issue "I3" "Ujednolicić branding tytułu powiadomień" yes low <<'EOF'
Niekonsekwentne tytuły powiadomień: „Asystent" (`services/notifications.ts`) vs
„Karta pracy" (`services/work.ts`). Ujednolicić.

Źródło: TASKS.md → Redesign MD3 → Faza 6.
EOF

create_issue "I4" "Strategia OTA/EAS Update na Androidzie" yes medium <<'EOF'
`checkForUpdatesOnLaunch()` w `mind-app/services/appUpdate.ts` jest obecnie całkowicie
wyłączone na Androidzie. Zdecydować o strategii OTA/EAS Update dla Androida (Play
Store vs EAS internal distribution vs APK).

Źródło: TASKS.md → Redesign MD3 → Faza 6.
EOF

# ── J — Android: transfer, build i test na urządzeniu ──────────────────────
create_issue "J1" "Transfer repo + sekretów na Windows" no high <<'EOF'
`git clone`/`git pull` na Windows (kod) + rozpakowanie zipa sekretów
(`scripts/pack-local-for-windows.sh`, LocalSend Mac → Windows).

Źródło: TASKS.md → Port na Androida.
EOF

create_issue "J2" "npm install w mind-app i mind-backend na Windows" no high <<'EOF'
Instalacja zależności obu projektów na Windows po transferze (J1).

Źródło: TASKS.md → Port na Androida.
EOF

create_issue "J3" "npx expo run:android --device na Pixel 9a" no high <<'EOF'
Pierwszy natywny build i uruchomienie na fizycznym Pixel 9a przez USB/ADB.

Wymaga etapów D (zależności/konfiguracja) i A1 (łączność przez Tailscale).

Źródło: TASKS.md → Redesign MD3 → Faza 7 / Port na Androida.
EOF

create_issue "J4" "Bugtest OOTB: rejestracja -> sync grafiku -> wyszukanie pociągu PLK" no high <<'EOF'
Pierwszy pełny przebieg funkcjonalny na Androidzie: rejestracja, sync grafiku z
portalu IVU, wyszukanie pociągu PLK.

Źródło: TASKS.md → Port na Androida.
EOF

create_issue "J5" "Manualna weryfikacja: dynamic color, nav mode, biometria, kanały, cleartext" no high <<'EOF'
Na fizycznym urządzeniu: zmiana tapety → zmiana motywu (dynamic color), heurystyka
nav mode (G4), biometria (odcisk palca), kanały powiadomień (w tym `TIME_INTERVAL` w
`stationNotifications.ts` — ograniczona niezawodność na Androidzie), cleartext HTTP
przez Tailscale.

Źródło: TASKS.md → Redesign MD3 → Faza 7.
EOF

create_issue "J6" "Nowe wpisy known-bugs.md (KB-013+) z bugtestu na Androidzie" no medium <<'EOF'
Spisać w `known-bugs.md` wszystko, co wyjdzie z J4/J5 jako nowe wpisy KB-013+.

Źródło: TASKS.md → Redesign MD3 → Faza 7 / Port na Androida.
EOF

# ── K — Testy funkcjonalne (smoke) ─────────────────────────────────────────
create_issue "K1" "Smoke test OOTB: rejestracja z Expo Go -> sync -> PLK" no medium <<'EOF'
Pełny smoke test onboardingu: rejestracja z Expo Go → sync grafiku → wyszukanie
pociągu PLK.

Źródło: TASKS.md → Backlog (priorytet normalny).
EOF

create_issue "K2" "Smoke test izolacji: 2 konta IVU -> osobne grafiki" no medium <<'EOF'
Zweryfikować izolację multi-tenant: dwa konta IVU zarejestrowane w aplikacji powinny
mieć całkowicie osobne grafiki/dane.

Źródło: TASKS.md → Backlog (priorytet normalny).
EOF

echo
echo "Gotowe. Utworzono 51 issues (A1-K2) w $REPO."
