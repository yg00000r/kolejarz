# Migracja `TASKS.md` → GitHub Issues

> Ten plik jest materiałem źródłowym/podglądem dla `scripts/create-github-issues.sh`. Kodowanie: litera = etap, cyfra = zadanie w etapie (np. `A1`, `A2`, `B1`...). `(MC)` w tytule = zadanie da się zrealizować w całości przez agenta chmurowego (edycje kodu/konfiguracji, bez fizycznego urządzenia, VPS, Windows czy Tailscale). Priorytet: **Wysoki / Normalny / Niski**.
>
> **Jak to uruchomić:** ten agent nie ma dostępu do GitHub Issues z tego środowiska (`403 Resource not accessible by integration` na `gh api .../issues` i `.../labels`, mimo że apka "Cursor" ma w ustawieniach zaznaczone "Read and write" dla Issues — token wydawany agentowi w tym środowisku i tak nie ma prawa zapisu do Issues; to nie jest coś, co można odblokować z ustawień integracji na GitHubie).
>
> Dwie opcje, które **nie** zależą od tego ograniczenia:
>
> 1. **Z telefonu, bez terminala** (np. iPhone): w repo na GitHubie (web albo appka) wejdź w zakładkę **Actions** → workflow **„Utwórz GitHub Issues z planu Android/MD3”** → **Run workflow** → w polu `confirm` wpisz `tak` → **Run workflow**. Workflow (`.github/workflows/create-github-issues.yml`) używa wbudowanego `GITHUB_TOKEN` z uprawnieniem `issues: write` i sam odpala `scripts/create-github-issues.sh`.
> 2. **Lokalnie, z komputera z terminalem**: `gh auth login` (własne, uprawnione konto) → `./scripts/create-github-issues.sh`.
>
> Skrypt jest **nieidempotentny** — odpalenie drugi raz utworzy duplikaty 51 issues.

| ID | Tytuł | MC | Priorytet | Źródło w `TASKS.md` |
|---|---|---|---|---|
| **A — Infrastruktura i łączność** |
| A1 | Zweryfikować łączność z backendem VPS przez Tailscale (Windows/Pixel) | — | Wysoki | Faza 0 |
| A2 | Nowy wpis w `known-bugs.md`, jeśli po teście przez Tailscale coś nie działa | — | Normalny | Faza 0 |
| **B — Backend: stabilność i bezpieczeństwo** |
| B1 | Rate limiting na `/auth/*` i `/shifts/sync` (`express-rate-limit`) | MC | Wysoki | Backlog wysoki |
| B2 | Debug KB-005 — `confirm-timecard` (Playwright) niestabilny na VPS | — | Wysoki | Backlog wysoki |
| B3 | `npx prisma migrate deploy` na VPS po `Tenant`/`AppSession` | — | Wysoki | Backend/multi-tenant |
| B4 | HTTPS na VPS (Caddy) — fix KB-001 | — | Niski | Backlog niski |
| **C — Jakość kodu i CI** |
| C1 | Naprawić błąd `tsc`: `PressScale` + `accessibilityLabel` w `app/(app)/index.tsx` | MC | Wysoki | Backlog wysoki |
| C2 | CI: GitHub Actions — `tsc --noEmit` + `prisma validate` | MC | Niski | Backlog niski |
| C3 | Ocenić `altstoreSource.ts` — uprościć/usunąć jeśli nieaktywny | MC | Niski | Backlog niski |
| C4 | Lepsze błędy sync w UI — parsować body 502, pokazać przyczynę | MC | Normalny | Backlog normalny |
| **D — Android: fundament (zależności, konfiguracja natywna)** |
| D1 | Dodać `@pchmn/expo-material3-theme` + `@material/material-color-utilities` | MC | Wysoki | Faza 1 |
| D2 | `app.json`: network security config / `usesCleartextTraffic` dla HTTP do VPS | MC | Wysoki | Faza 1 |
| D3 | `app.json`: dodać `expo-notifications` do `plugins` + wyczyścić zduplikowane `permissions` | MC | Wysoki | Faza 1 |
| D4 | `eas.json`: dodać profil `android` | MC | Normalny | Faza 1 |
| D5 | Oznaczyć `services/appUpdate.ts` / `altstoreSource.ts` jako legacy dla Androida | MC | Niski | Faza 1 |
| **E — Android/MD3: system tokenów (kolor, typografia, kształt)** |
| E1 | Tonalne palety MD3 z seed color w `constants/theme.ts` (6 presetów + Auto/Material You) | MC | Wysoki | Faza 2 |
| E2 | Scalić `useColors()` i `useTheme().colors` w jedno API z pełnym zestawem ról MD3 | MC | Wysoki | Faza 2 |
| E3 | Wpisać `useMaterial3Theme()` (dynamic color) w `app/_layout.tsx` | MC | Wysoki | Faza 2 |
| E4 | `constants/layout.ts` → MD3 shape scale (4/8/12/16/28dp) + touch target 48dp | MC | Normalny | Faza 2 |
| E5 | Typografia MD3 (display/headline/title/body/label) | MC | Normalny | Faza 2 |
| E6 | Usunąć `iosContinuousCurve` / `Platform.OS === 'ios'` developerki wizualne | MC | Normalny | Faza 2 |
| **F — Android/MD3: komponenty bazowe** |
| F1 | `Screen.tsx` + `ScreenHeader.tsx` → MD3 large top app bar ze scroll-collapse | MC | Wysoki | Faza 3 |
| F2 | Migracja `PressScale`/`TouchableOpacity` → komponenty Paper (`Button`, `Card`, `List.Item`, `IconButton`) | MC | Wysoki | Faza 3 |
| F3 | Nowy komponent `components/NavigationBar.tsx` (MD3 dolna nawigacja) | MC | Wysoki | Faza 3 |
| F4 | Nowy hook `hooks/useNavigationMode.ts` (heurystyka gestów/przycisków) | MC | Wysoki | Faza 3 |
| F5 | Uporządkować `ErrorBoundary`/`HapticButton`/`Skeleton`/`SkeletonLoader` (nieużywane/duplikaty) | MC | Niski | Faza 3 |
| F6 | Adopcja `services/haptics.ts` w miejsce ręcznych wywołań `expo-haptics` | MC | Niski | Faza 3 |
| **G — Android/MD3: adaptacyjna nawigacja** |
| G1 | Ustawienia: sekcja „Styl nawigacji" (Auto / Przyciski / Gesty) | MC | Wysoki | Faza 4 |
| G2 | Tryb „Przyciski": trwały `NavigationBar` + pod-toggle „Włącz gesty" | MC | Wysoki | Faza 4 |
| G3 | Tryb „Gesty": przemalować obecny model (dashboard-kafelki + swipe-back) na MD3 | MC | Wysoki | Faza 4 |
| G4 | Weryfikacja heurystyki nav mode na realnym Pixelu 9a | — | Normalny | Faza 4 |
| **H — Android/MD3: redesign ekranów** |
| H1 | Fundament layoutów: `app/_layout.tsx`, `app/(app)/_layout.tsx`, `app/(auth)/_layout.tsx` | MC | Wysoki | Faza 5.1 |
| H2 | Auth: `app/(auth)/login.tsx` (PIN + biometria) + `register.tsx` | MC | Wysoki | Faza 5.2 |
| H3 | Dashboard: `app/(app)/index.tsx` | MC | Wysoki | Faza 5.3 |
| H4 | Ustawienia: `settings/index.tsx` + `settings/diagnostics.tsx` | MC | Wysoki | Faza 5.4 |
| H5 | Praca — hub: `work/index.tsx` | MC | Normalny | Faza 5.5 |
| H6 | Praca — pozostałe 11 ekranów (`schedule`, `accounts`, `timecard`, `trains`, `station`, `abc`, `dodatki`, `routes`, `duty-details`, `portal-messages`, `crew`) | MC | Normalny | Faza 5.6 |
| H7 | Komunikaty — `work/messages/` (8 ekranów) | MC | Normalny | Faza 5.7 |
| H8 | Monitorowanie: `monitoring/index.tsx` | MC | Niski | Faza 5.8 |
| **I — Android: poprawki specyficzne** |
| I1 | Copy biometrii: „Face ID" → generyczne + ikona `fingerprint` na Androidzie | MC | Wysoki | Faza 6 |
| I2 | Kanały powiadomień: `channelId` w `stationNotifications.ts` i `scheduleTimecardReminder` (`work.ts`) | MC | Wysoki | Faza 6 |
| I3 | Ujednolicić branding tytułu powiadomień („Asystent" vs „Karta pracy") | MC | Niski | Faza 6 |
| I4 | Strategia OTA/EAS Update na Androidzie (`services/appUpdate.ts`) | MC | Normalny | Faza 6 |
| **J — Android: transfer, build i test na urządzeniu** |
| J1 | Transfer repo + sekretów na Windows (`git clone` + LocalSend) | — | Wysoki | Port na Androida |
| J2 | `npm install` w `mind-app` i `mind-backend` na Windows | — | Wysoki | Port na Androida |
| J3 | `npx expo run:android --device` na Pixel 9a | — | Wysoki | Faza 7 |
| J4 | Bugtest OOTB: rejestracja → sync grafiku → wyszukanie pociągu PLK | — | Wysoki | Port na Androida |
| J5 | Manualna weryfikacja: dynamic color, nav mode, biometria, kanały powiadomień, cleartext HTTP | — | Wysoki | Faza 7 |
| J6 | Nowe wpisy `known-bugs.md` (KB-013+) z bugtestu na Androidzie | — | Normalny | Faza 7 / Port na Androida |
| **K — Testy funkcjonalne (smoke)** |
| K1 | Smoke test OOTB: rejestracja z Expo Go → sync grafiku → wyszukanie pociągu PLK | — | Normalny | Backlog normalny |
| K2 | Smoke test izolacji: 2 konta IVU → osobne grafiki | — | Normalny | Backlog normalny |

**Podsumowanie:** 11 etapów (A–K), 51 zadań, z czego **34 oznaczone (MC)** (edycje kodu/konfiguracji w tym repo — da się zrobić z tego samego cloud-agenta) i **17 wymagających fizycznego urządzenia / VPS / Windows / Tailscale**.

## Etykiety, które skrypt tworzy w repo

- `priority: high`, `priority: medium`, `priority: low`
- `stage: A` … `stage: K` (11 etykiet)
- `cursor-mobile` (zadania (MC))
