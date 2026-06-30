# Portal IVU.pad — Discovery & API Reference

> Wyniki rekonesansu nowego portalu PKP Intercity (http://portal.intercity.pl)
> Data: 2026-03-21 | Sesje: recon_portal.py, recon_features.py, recon_timecard.py

---

## Architektura portalu

Portal to **IVU.pad 6.10.2** — komercyjny system zarządzania załogą od IVU Traffic Technologies (Berlin).
Stary backend mbweb (Irena) wciąż działa pod spodem — IVU.pad to nowa nakładka frontend + CouchDB sync.

```
┌─────────────────────────────────────────────┐
│  IVU.pad Frontend (SPA)                     │
│  ├─ Material Design Lite UI                 │
│  ├─ CouchDB (offline sync, config)          │
│  └─ REST login: /pad/admin/rest/login       │
│              │                              │
│              ▼                              │
│  ┌───────────────────────────────────────┐  │
│  │  mbweb Backend (legacy, Java)         │  │
│  │  /mbweb/main/matter/desktop/...       │  │
│  │  /mbweb/main/matter/pad/...           │  │
│  └───────────────────────────────────────┘  │
│              │                              │
│         Akamai CDN/WAF                      │
│              │                              │
│  http://portal.intercity.pl                 │
└─────────────────────────────────────────────┘
```

## Autentykacja

1. **REST login**: `POST http://portal.intercity.pl/pad/admin/rest/login`
   - Body: `{"user": "<PORTAL_USERNAME>", "password": "<PORTAL_PASSWORD>"}`
   - Hasło: `{Miesiąc}{Rok}` (auto-generowane co miesiąc)
   - Zwraca JWT → cookie `IvuPadAuthToken`

2. **Form login**: klasyczny formularz na stronie głównej (fallback)

3. **Akamai**: blokuje HTTPS z zewnątrz, HTTP działa. Blokuje POST-y bez kontekstu przeglądarkowego.

## Kluczowe dane

- Employee ID: `<EMPLOYEE_ID_IVU>` (wewnętrzny IVU)
- Employee number: `<EMPLOYEE_NUMBER>`
- Name: `<IMIE NAZWISKO>`
- Abbreviation: `<Skrot>`
- Depot: `Wrocław Główny (Drużyny Konduktorskie)`
- Crew type: `K` (konduktor)

---

## Endpointy API

Bazowy URL: `http://portal.intercity.pl/mbweb/main/matter/desktop/`

**WAŻNE**: parametr `&sync=true` jest wymagany żeby ominąć blokadę Akamai na większości endpointów.

### 1. Grafik służb (PLAN)

| Endpoint | Opis | Format |
|----------|------|--------|
| `_-duty-table?beginDate=YYYY-MM-01&sync=true` | Tabela miesięczna z kodami służb | HTML |
| `duty-details?beginDate=YYYY-MM-DD&sync=true` | Szczegóły dnia + rozbicie na elementy | HTML |
| `duties?sync=true` | Widok kalendarza (nagłówek) | HTML |

Dane w `_-duty-table`: kod służby (`title-text`), godziny (start–end), daty (`data-date`), typ (`type_presence`, `type_offday`).

### 2. Rozbicie służby na elementy (duty-details)

Tabela `<table class="duty-details-table">` z wierszami `<tr class="duty-components-table-row">`.
Każdy wiersz ma kolumny:

| Kolumna (CSS class) | Opis | Przykład |
|---------------------|------|---------|
| `type_abbreviation` | Kod elementu | ADM, AblHin, OBJ, Umlstk, PRZ |
| `type_long_name` | Pełna nazwa | DK Czas administracyjny, DK Objęcie pociągu |
| `start_location_long_name` | Stacja początkowa | Wrocław Główny |
| `start_time` | Czas rozpoczęcia | 04:08 |
| `end_location_long_name` | Stacja końcowa | Koniecpol |
| `end_time` | Czas zakończenia | 07:54 |
| `trip_numbers` | Numer pociągu | 6200 |
| `crew_type_abbreviation` | Typ obsady | K |
| `vehicle_type` | Typ pojazdu | ED161 |

**Typy elementów (skróty):**
- `ADM` — Czas administracyjny
- `AblHin` — Dojście do zmiany (Ablösewegezeit Hin)
- `AblRück` — Powrót ze zmiany
- `OBJ` — Objęcie pociągu
- `PRZ` — Przekazanie pociągu
- `Umlstk` — Segment jazdy (Umlaufstück) — to jest właściwa praca na pociągu

Nagłówek duty-details zawiera:
- `data-allocationId` — ID alokacji (np. `18293492275`)
- `data-submit="_-json-confirm-allocation"` — URL potwierdzenia karty
- `data-submitRejection="_-json-reject-allocation"` — URL odrzucenia
- Klasa `implicit-confirmation-needed` — karta czeka na potwierdzenie
- Pola: Dienstnummer, Datum, Besatzungstyp, Betriebshof, Beginn, Bezahlte Zeit, Arbeitszeit

### 3. Faktyczne służby (WYKONANIE / Ist-Dienst)

| Endpoint | Opis |
|----------|------|
| `_-actual-duties-table?beginDate=YYYY-MM-01&sync=true` | Tabela zrealizowanych służb |
| `actual-duty-details?allocatableId=ID` | Szczegóły zrealizowanej służby |

Zawiera `data-allocationid` i `data-url` do szczegółów. Tytuł: "Ist-Dienstübersicht für: <IMIE NAZWISKO>".

Alokacje na marzec 2026:
- 2026-03-01: ID=18276097675, KWR212
- 2026-03-02: ID=18246400233, KWR234
- 2026-03-04: ID=18303413934, KWR251a
- 2026-03-05: ID=18305367292, KWR218
- (itd.)

### 4. Plan długoterminowy

| Endpoint | Opis |
|----------|------|
| `_-long-term-planing-duty-table?beginDate=YYYY-MM-01&sync=true` | Grafik długoterminowy |
| `long-term-duty-details?beginDate=YYYY-MM-DD&sync=true` | Szczegóły dnia (długoterminowy) |

### 5. Wiadomości

| Endpoint | Opis |
|----------|------|
| `messages?sync=true` | Widok skrzynki (init) |
| `_-messages-table?page=N&sync=true` | Stronicowana lista wiadomości |
| `messages-outbox?sync=true` | Wysłane wiadomości |

Struktura wiadomości: `<li id="MSG_ID" class="message">` z nadawcą, tematem, datą. Paginacja: `<span id="next">_-messages-table?page=N+1</span>`.

### 6. Konta czasu pracy

| Endpoint | Opis |
|----------|------|
| `accounts-overview?sync=true` | Salda kont: nadgodziny, urlopy, etc. |

Zwraca tabelę z datą referencyjną (Stichtag) i saldami godzin.

### 7. Wnioski urlopowe / życzenia

| Endpoint | Opis |
|----------|------|
| `wish-request?sync=true` | Wnioski (42KB!) z typami, statusami, priorytetami |
| `_-request-table?beginDate=YYYY-MM-01&sync=true` | Tabela wniosków na miesiąc |

### 8. Wymiana służb

| Endpoint | Opis |
|----------|------|
| `exchange?sync=true` | Oferty wymiany |
| `exchange-overview?sync=true` | Moja wymiana |

### 9. Obsada pociągu (Crew on Trip)

| Endpoint | Opis |
|----------|------|
| `/mbweb/main/matter/pad/crew-on-trip` | Formularz: data + numer pociągu (pad path) |
| `/mbweb/main/matter/pad/_-crew-on-trip-table?beginDate=YYYY-MM-DD&tripNumber=XXXX&sync=true` | **Tabela załogi (JSON-less HTML). NIE blokowany przez Akamai.** |

> **Recon 2026-06-20 (`recon_crew.py`):** endpoint danych to `_-crew-on-trip-table`.
> Kluczowe: parametr daty to **`beginDate`** (jak reszta portalu), NIE `date`.
> Zła nazwa param → błąd `"Cannot invoke String.length() because text is null"`.
> Desktop path zwraca 403, ale **pad path działa** (200, bez Akamai).

**Struktura odpowiedzi HTML:**

Nagłówek `.tripInfo`:
| Selektor | Pole | Przykład |
|----------|------|----------|
| `.trip-title` | Numer pociągu | 6200 |
| `.trip-info-header .mdl-cell` (`.desc`/`.cont`) | Fahrtnummer, Von, Beginn, Nach, Ende | 6200 / Wrocław Główny / 05:41 / Lublin Główny / 10:47 |

Załoga — kontener `.crew-data` (może być kilka grup `#crew-data-0`, `#crew-data-1`),
każdy członek to `.ivupad-card` z `ul.crew-table-row` i pozycjami `li.crew-info-column[title]`:

| `title` atrybutu | Pole | Przykład |
|------------------|------|----------|
| `Name` | Imię i nazwisko | `<IMIE NAZWISKO>` |
| `Telefonnummer` | Telefon (`<a href="tel:...">`) | `<TEL>` (opcjonalne) |
| `Besatzungstyp` | Typ obsady | `K`, `KP`, `M` |
| `Beginn und Anfangsort` | Czas + stacja startu | `05:41 WR_GL` |
| `Ende und Zielort` | Czas + stacja końca | `07:56 KONIE` |

**Typy obsady (Besatzungstyp):**
- `KP` — Kierownik Pociągu
- `K` — Konduktor
- `M` — Maszynista (Triebfahrzeugführer)

Stacje w skrócie (np. `WR_GL` = Wrocław Główny, `KONIE` = Koniecpol, `CZE_STR`, `LUB` = Lublin).
Każdy członek ma własny odcinek (od/do) — różne osoby na różnych częściach trasy.

### 10. Wyszukiwanie służb

| Endpoint | Opis |
|----------|------|
| `any-duty?sync=true` | Formularz: data + numer służby |

### 11. Użytkownik (JSON)

| Endpoint | Opis |
|----------|------|
| `/mbweb/main/matter/pad/json-user` | `{"data":{"abbreviation":"<Skrot>"}}` |

### 12. Potwierdzenie karty pracy

| Endpoint | Metoda | Opis |
|----------|--------|------|
| `_-json-confirm-allocation` | POST | Potwierdzenie karty (wymaga kontekstu browser — Akamai blokuje bezpośrednie POST) |
| `_-json-reject-allocation` | POST | Odrzucenie karty |

Wymaga Playwright — nie można bezpośrednio POST-ować.

### 13. Menu główne

| Endpoint | Opis |
|----------|------|
| `_-main-menu?sync=true` | Menu z modułami i badge'ami (9KB) |

### 14. Sync URL list

| Endpoint | Opis |
|----------|------|
| `sync` | Lista 89 URL-i do synchronizacji offline — konfiguracja storageIntervalInDays: 3 |

---

## Uwagi techniczne

1. **`sync=true`** — parametr kluczowy. Bez niego Akamai blokuje większość endpointów (403).
2. **Format danych** — HTML fragmenty, nie JSON. Wymagają parsera HTML (cheerio/BeautifulSoup).
3. **Locale** — Portal w `de-DE` (IVU to firma niemiecka): Beginn/Ende, Dienstnummer, Umlaufstück.
4. **Planning levels** — `planning_level_shortname_Plan` (planowany) vs `planning_level_shortname_Wykonanie` (zrealizowany).
5. **Statusy kart** — CSS klasy: `implicit-confirmation-needed`, `status_Zatwierdzona_Wydana`, `status_Rozliczona_Edytowalny`.
6. **Token expiry** — JWT token ma ograniczony czas życia, potrzeba logowania co sesję.
7. **PAD vs Desktop paths** — niektóre endpointy działają tylko przez `/pad/` (crew-on-trip), inne tylko przez `/desktop/`.

---

## Pliki referencyjne

| Plik | Zawartość |
|------|-----------|
| `recon_output/features_*/sync_urls.json` | 89 sync URL-i |
| `recon_output/features_*/all_endpoints.json` | Wyniki probing wszystkich URL |
| `recon_output/timecard_*/duty_details_2026-03-10.html` | Pełny HTML rozbicia KWR251a |
| `recon_output/timecard_*/duty_details_2026-03-20.html` | Pełny HTML rozbicia KWR234 |
| `recon_output/timecard_*/actual_duties_allocations.json` | ID alokacji na marzec |
