# Kolejarz — Znane błędy i ograniczenia

> Katalog aktywnych problemów, o których nowy deweloper musi wiedzieć przed pracą z projektem.

---

## KRYTYCZNE

### [KB-001] Expo Go + HTTP API — blokada iOS ATS

**Objaw:** Sync grafiku lub inne requesty do backendu failują cicho w Expo Go na iOS. Błąd w UI: „Nie udało się zsynchronizować grafiku".

**Przyczyna:** iOS App Transport Security (ATS) blokuje HTTP do publicznego IP w Expo Go. Aplikacja Expo Go nie zawiera wyjątku ATS dla naszego VPS IP — taki wyjątek jest tylko w native buildzie (`ios/Kolejarz/Info.plist`).

**Obejście:** Używaj native buildu do testowania integracji z backendem:
```bash
npx expo run:ios --device <UDID>
```
Expo Go działa poprawnie tylko gdy backend jest na tej samej sieci LAN (np. lokalny `http://192.168.x.x:3000`).

**Fix długoterminowy:** HTTPS na VPS (Caddy/Nginx z certyfikatem Let's Encrypt).

---

### [KB-002] Portal IVU blokuje IP datacenter (Akamai 503)

**Objaw:** `POST /shifts/sync` zwraca 502. Logi Docker kontenera: `Portal login failed: 503` lub odpowiedź Akamai/edgesuite.

**Przyczyna:** System anty-bot Akamai blokuje żądania z adresów IP centrów danych (OVH, AWS, Hetzner itp.). IP VPS `<VPS_IP>` jest IP datacenter.

**Obejście tymczasowe:** Restart kontenera często pomaga na kilka godzin:
```bash
ssh mind-kolejarz-vps "docker restart kolejarz"
```

**Fix długoterminowy:** Mini-PC w sieci firmowej PKP IC + Tailscale jako reverse proxy do VPS.

---

## OSTRZEŻENIA

### [KB-003] Parser grafiku — „No shifts parsed"

**Objaw:** Sync kończy się HTTP 200, ale grafik w aplikacji jest pusty. Logi: `No shifts parsed from portal for YYYY-MM`.

**Przyczyna:** Portal IVU może zmienić strukturę HTML tabeli grafiku między wersjami systemu. Parser Cheerio w `portal.ts → parseDutyTable()` jest wrażliwy na zmiany selektorów CSS.

**Diagnoza:**
```bash
curl -X GET http://<VPS_IP>:3000/portal/health
```
Sprawdź logi Dockera pod kątem raw HTML z portalu.

**Fix:** Zaktualizuj selektory w `parseDutyTable()` zgodnie z aktualnym HTML portalu.

---

### [KB-004] Logowanie IVU w Safari na telefonie nie wpływa na sync

**Objaw:** Użytkownik zalogował się do `portal.intercity.pl` w Safari, ale aplikacja nadal nie synchronizuje grafiku.

**Przyczyna:** Backend na VPS ma własną sesję do portalu (REST + Playwright), niezależną od sesji w przeglądarce na telefonie. Sync = backend VPS → portal IVU, nie telefon → portal.

---

### [KB-005] Karty pracy — wysyłanie nie działa (Playwright)

**Objaw:** W module Karty pracy widać listę kart do wysłania (`statusKarty: do_potwierdzenia`), ale próba potwierdzenia/wysłania kończy się błędem. Bulk send (`POST /portal/confirm-timecards-bulk`) również nie działa.

**Co działa:** Podgląd niezatwierdzonych kart, nawigacja do szczegółów służby, odczyt statusu z portalu po sync grafiku.

**Co nie działa:**
- `POST /portal/confirm-timecard` — pojedyncza karta (Playwright w Dockerze zwraca error)
- `POST /portal/confirm-timecards-bulk` — masowe wysyłanie kart
- Automatyczne potwierdzenie z poziomu aplikacji

**Przyczyna:** Potwierdzenie karty wymaga kliknięcia w UI portalu IVU — backend próbuje HTTP, potem fallback Playwright (`portal-browser.ts`). Na VPS headless Chromium często nie przechodzi flow potwierdzenia (timeout, zmiana markupu portalu, brak stabilnej sesji JSESSIONID przy akcji klik).

**Obejście:** Karty trzeba nadal potwierdzać ręcznie w portalu IVU (przeglądarka / aplikacja portalu).

**Fix:** Debug Playwright flow na VPS, ewentualnie reverse proxy z sieci firmowej (patrz KB-002).

---

### [KB-006] Zmiana Bundle ID po rebrandingu

**Objaw:** Aplikacja zainstalowana jako `com.ygor.mind` nie aktualizuje się przez OTA (EAS Update) po zmianie bundle ID na `com.ygor.kolejarz`.

**Fix:** Nowy native build + reinstalacja na urządzeniu przez Xcode lub EAS:
```bash
npx expo run:ios --device <UDID> --configuration Release
```

---

### [KB-010] Komunikaty radiowe — logika i UI do dopracowania

**Objaw:** Moduł Komunikaty działa „względnie” — generatory i tryb Pilnowanie uruchamiają się, ale pojawiają się błędy logiczne (np. złe szablony przy opóźnieniu, niepełne stacje w odcinku, niespójność między trybem klasycznym a watch).

**Stan:**
- Generatory w `constants/komunikaty.ts` + katalog w `messageCatalog.ts` — podstawowy flow OK
- Tryb Pilnowanie (`work/messages/watch.tsx`) — wymaga weryfikacji na realnych trasach
- UI — zbyt rozbudowane, planowane uproszczenie nawigacji i formularzy

**Fix:** Przejść scenariusze z `komunikaty.md`, dopisać testy ręczne per typ komunikatu, uprościć UI (mniej ekranów pośrednich).

---

### [KB-011] Pociąg w trasie — brak przybliżonej lokalizacji

**Objaw:** Wyszukiwanie pociągu i live status działają, ale wcześniej widoczna była przybliżona lokalizacja pociągu na trasie (aktualna stacja / postęp). Po zmianach w integracji PLK lub UI ta informacja zniknęła.

**Prawdopodobna przyczyna:** Endpoint `GET /trains/:orderId/live` zwraca dane, ale frontend (`work/trains.tsx`) nie mapuje już pola lokalizacji / `currentStation` na widok mapy lub listy stacji w sposób widoczny dla użytkownika. Możliwa też zmiana struktury odpowiedzi PLK API.

**Diagnoza:**
```bash
curl "http://<VPS_IP>:3000/trains/<orderId>/live?scheduleId=...&date=YYYY-MM-DD" \
  -H "Authorization: Bearer <token>"
```
Sprawdź czy `currentStation` i `stations[]` są w odpowiedzi.

**Fix:** Zweryfikować mapowanie w `trains.tsx` i `services/work.ts` względem aktualnego kontraktu PLK.

---

### [KB-012] Zestawienia składów (Dod. A / Dod. B) — dane archiwalne

**Objaw:** Ekran Zestawienia (`work/dodatki.tsx`) pokazuje składy z plików `dodatek_a.json` / `dodatek_b.json` wbudowanych w aplikację. Dane są nieaktualne względem bieżącego rozkładu.

**Kontekst:** Oficjalny dodatek składów jest publikowany / aktualizowany ok. co 2 dni. Aplikacja **nie** pobiera go automatycznie z żadnego API — JSON w repo to snapshot z momentu ostatniego ręcznego importu.

**Obejście (obecne):** Maintainer musi ręcznie sparsować nowy dodatek (Excel/PDF → JSON) i wgrać do `constants/dodatek_a.json` / `dodatek_b.json`, potem OTA lub nowy build.

**Fix długoterminowy:** Skrypt importu (np. z pliku XLSX w repo lub z wewnętrznego źródła PKP IC) + opcjonalny endpoint backendu do serwowania aktualnego dodatku bez przebudowy aplikacji.

---

## INFORMACYJNE

### [KB-007] Prisma migrate na VPS — ręcznie

Przy każdej zmianie schematu Prisma (`schema.prisma`) należy uruchomić migrację na produkcyjnej bazie VPS:
```bash
ssh mind-kolejarz-vps "docker exec kolejarz npx prisma migrate deploy"
```
Brak migracji = aplikacja może crashować przy dostępie do nowych kolumn/tabel.

**Zweryfikowano (2026-08-13):** przez SSH (Tailscale) na `server` (100.66.57.89), kontener `kolejarz` — `Tenant`/`AppSession` istnieją i mają dane (2 tenantów, 8 sesji), migracja po dodaniu tych modeli przeszła poprawnie na produkcji.

### [KB-008] Cron auto-sync — jeden tenant

Automatyczny sync co 6h (cron) aktualnie iteruje po wszystkich tenantach w bazie. Jeśli tenant ma nieważne credentials (zmiana hasła w portalu), sync dla niego failuje w logu ale nie blokuje pozostałych tenantów. Wymagana ręczna re-rejestracja przez aplikację.

### [KB-009] Expo Go i sesja — token w SecureStore

Token sesji (`kolejarz_session_token`) jest przechowywany w SecureStore — persystuje między restartami aplikacji. Po reinstalacji aplikacji (np. po zmianie bundle ID) token jest tracony i wymagana jest ponowna rejestracja z danymi IVU.

### [KB-013] Węzeł `vps-edge` offline w tailnecie

**Objaw:** W `tailscale status` węzeł `vps-edge` (100.121.166.6) pokazuje się jako `offline` (ostatnio widziany kilka–kilkanaście godzin przed sprawdzeniem, 2026-08-13).

**Wpływ:** Brak — backend jest osiągalny bezpośrednio przez węzeł `server` (100.66.57.89, kontener `kolejarz` na porcie 3000), zweryfikowane `GET /health` i `GET /portal/health` (200, patrz `TASKS.md` → Faza 0). `vps-edge` wygląda na osobny reverse proxy/edge, nieaktualnie wykorzystywany — na czas developmentu pomijamy go i łączymy się bezpośrednio z `server`.

**Do zrobienia (niski priorytet, nie blokuje developmentu):** Sprawdzić, czy `vps-edge` powinien działać (jaka jest jego rola — reverse proxy? backup?) i ewentualnie przywrócić albo zdemontować, jeśli nieaktywny.
