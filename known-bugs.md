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

**Diagnoza (2026-08-13, na żywym koncie, przez SSH+Tailscale na VPS):**

Przetestowano realną kartę (2026-08-12, `allocationId 18716971049`, konto tenantId=1):

1. **HTTP (`confirmAllocationHttp`)** — zapytanie dochodzi (status 200), portal odpowiada `{"success":false}` bez żadnego detalu błędu. Nie jest to blokada Akamai (nie ma 403/503) — sam backend portalu odrzuca żądanie.
2. **Playwright, POST przez `page.evaluate` (fetch z kontekstu przeglądarki)** — też `status=200, success=false`, mimo prawdziwego kontekstu przeglądarki z ciasteczkami Akamai (`bm_sv`). Czyli fingerprint bota **nie jest** (jedyną) przyczyną.
3. **Playwright, klik UI fallback** — element `.implicit-confirmation-needed` jest znajdowany (1 dopasowanie), klik wykonywany, ale **nie generuje żadnego requestu sieciowego** (`confirmedRequests: []`) i nie pojawia się przycisk potwierdzenia.
4. **Root cause kliku:** strona `duty-details` ładowana bezpośrednio (deep-link do fragmentu SPA) **nie ładuje jQuery** (`window.jQuery === undefined`, `pageerror: "$ is not defined"`) — `AllocationDetails.init()` (handler kliku) nigdy się nie wykonuje. To nie jest fragment samodzielny — normalnie jest wstrzykiwany przez router SPA do już zainicjalizowanej powłoki (`mbweb/main/...`), która ładuje jQuery/MDL/`AllocationDetails.js`. Nawigacja Playwrighta prosto na URL fragmentu pomija tę inicjalizację.
5. Próba naprawy: zalogowanie się przez **prawdziwy formularz** `https://portal.intercity.pl/pad/login` (IVU.pad Login) zamiast REST endpointu — logowanie się powiodło, ale przekierowuje na `https://portal.intercity.pl/pad/init-data/1` (endpoint zwracający JSON, nie HTML powłoki SPA) i tam się zawiesza. Sugeruje to, że `/pad/*` to protokół dla natywnej/tabletowej aplikacji **IVU.pad** (branding „IVU.pad Login”, komunikaty „będzie wysłane jak wrócisz online” typowe dla urządzenia z przerywanym łączem w pociągu), a nie dla przeglądarki desktopowej — `mbweb/main/matter/desktop/*` może wymagać **całkiem innej** sesji/logowania (SSO?, inny cookie), którego nie odkryto.

**Wniosek:** to nie jest prosty bug do naprawienia (np. brakujący header) — prawdopodobnie próbujemy zautomatyzować akcję przez niewłaściwy kanał (webshell desktopowy) podczas gdy realne potwierdzanie kart może być zaprojektowane pod dedykowaną aplikację IVU.pad (tablet/mobile), do której nie mamy wglądu.

**Zalecany następny krok (wymaga człowieka, nie da się zdalnie):** przy najbliższym **realnym, ręcznym** potwierdzeniu karty w prawdziwym kliencie (przeglądarka na komputerze, z otwartym DevTools → zakładka Network, „Preserve log”) zapisać **HAR** całej sesji od zalogowania do kliknięcia „potwierdź”. To pokaże dokładny URL logowania do `mbweb`, nagłówki/ciasteczka sesji i faktyczny request potwierdzenia — bez tego dalsze zdalne zgadywanie ma niską szansę powodzenia.

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

### [KB-014] HTTPS dla backendu (B4) — przygotowane, blokowane na 2 kroki manualne

**Kontekst (2026-08-13):** `server` (100.66.57.89 w tailnecie) to w rzeczywistości domowy serwer (interfejs `eno1` z adresem LAN `192.168.1.251`, brama domyślna `192.168.1.1`), nie klasyczny datacenter VPS — mimo że w dokumentacji/nazwach zmiennych używamy „VPS". Ma już działający **Caddy** (systemd, `active`/`enabled`) z automatycznym HTTPS dla `yg00r.com` (reverse proxy do innego kontenera), co potwierdza, że port 80/443 są poprawnie przekierowane z routera domowego/Cloudflare do tej maszyny.

**Plan B4:** dodać analogiczny blok Caddy `kolejarz.yg00r.com { reverse_proxy 127.0.0.1:3000 }` (backend Kolejarz, kontener `kolejarz`, ten sam port co dotychczasowe `BASE_URL`). Przygotowano gotowy skrypt `scripts/kolejarz-setup-https.sh` (skopiowany też na serwer jako `~/kolejarz-setup-https.sh`), który dopisuje blok do `/etc/caddy/Caddyfile` (z backupem), waliduje i przeładowuje Caddy.

**Blokery — wymagają człowieka, agent nie może ich wykonać zdalnie:**
1. **DNS w Cloudflare** — trzeba dodać rekord `kolejarz` (CNAME → `yg00r.com`, proxied/orange cloud, tak jak apex) w zonie `yg00r.com`. Agent nie ma dostępu do panelu/API Cloudflare (nie znaleziono tokenu API na serwerze, nie szukano głębiej ze względów bezpieczeństwa).
2. **Sudo na `server`** — użytkownik `ygor` jest w grupie `sudo`, ale nie ma `NOPASSWD`, a agent łączy się przez SSH bez możliwości interaktywnego podania hasła. Trzeba ręcznie odpalić na serwerze: `sudo bash ~/kolejarz-setup-https.sh`.

**Po wykonaniu obu kroków:** zweryfikować `curl -sI https://kolejarz.yg00r.com/health` (oczekiwane `200`, ważny certyfikat), potem zmienić `BASE_URL` w `mind-app/constants/api.ts` z `http://57.128.246.232:3000` na `https://kolejarz.yg00r.com` i zrobić commit.
