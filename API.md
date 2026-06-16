# API Reference — Kolejarz Backend

> Dokumentacja wszystkich endpointów backendu.
> Base URL: `http://<VPS_IP>:3000` (produkcja) / `http://localhost:3000` (development)

## Spis treści

1. [Health & Status](#health--status)
2. [Shifts (Służby)](#shifts-służby)
3. [Portal (IVU.pad)](#portal-ivupad)
4. [Expenses (Wydatki)](#expenses-wydatki)
5. [Routines (Rutyny)](#routines-rutyny)
6. [Notes (QuickNote)](#notes-quicknote)
7. [Markdown Notes (Notatnik)](#markdown-notes-notatnik)
8. [Devices & Monitoring](#devices--monitoring)
9. [Trains & Station (PLK)](#trains--station-plk)
10. [Templates](#templates)

---

## Health & Status

### GET /health
Status serwera.

```bash
curl http://<VPS_IP>:3000/health
```

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2026-03-21T10:46:52.491Z"
}
```

---

## Shifts (Służby)

Grafik służb zsynchronizowany z portalu IVU.pad, przechowywany w Prisma (SQLite).

### GET /shifts
Pobierz grafik na dany miesiąc.

| Parameter | Type | Required | Description |
|---|---|---|---|
| month | number | ✓ | Miesiąc (1-12) |
| year | number | ✓ | Rok |

```bash
curl "http://<VPS_IP>:3000/shifts?month=3&year=2026"
```

**Response (200):**
```json
[
  {
    "date": "2026-03-20",
    "sluzba": "KWR234",
    "start": "04:08",
    "end": "12:45",
    "statusKarty": "wydana",
    "allocationId": "18303413934",
    "planningLevel": "Wykonanie",
    "opis": "Konduktor",
    "skrot": "K",
    "typ": "praca",
    "kod": "KWR234"
  },
  {
    "date": "2026-03-21",
    "sluzba": "DWS",
    "statusKarty": null,
    "allocationId": null,
    "planningLevel": null,
    "opis": "Dzień wolny za święto",
    "skrot": "DWS",
    "typ": "wolne",
    "kod": "DWS"
  }
]
```

### GET /shifts/next
Następna zaplanowana służba (praca/inne).

```bash
curl http://<VPS_IP>:3000/shifts/next
```

**Response (200):**
```json
{
  "date": "2026-03-22",
  "sluzba": "KWR251a",
  "start": "14:00",
  "end": "22:30",
  "statusKarty": "edytowalna",
  "allocationId": "18305367292",
  "planningLevel": "Plan",
  "opis": "Konduktor",
  "skrot": "K",
  "typ": "praca",
  "kod": "KWR251a"
}
```

**Response (200, brak służb):**
```json
null
```

### GET /shifts/sluzby
Słownik kodów służb.

```bash
curl http://<VPS_IP>:3000/shifts/sluzby
```

**Response (200):**
```json
{
  "DWS": { "opis": "Dzień wolny za święto", "skrot": "DWS", "typ": "wolne" },
  "DW5": { "opis": "Dzień wolny za niedzielę", "skrot": "DW5", "typ": "wolne" },
  "S":   { "opis": "Szkolenie", "skrot": "S", "typ": "inne" },
  "C5":  { "opis": "Zwolnienie lekarskie", "skrot": "C5", "typ": "inne" }
}
```

### POST /shifts/sync
Ręczna synchronizacja grafiku z portalu.

| Field | Type | Required | Description |
|---|---|---|---|
| month | number | - | Miesiąc (domyślnie: bieżący) |
| year | number | - | Rok (domyślnie: bieżący) |

```bash
curl -X POST http://<VPS_IP>:3000/shifts/sync \
  -H "Content-Type: application/json" \
  -d '{"month": 3, "year": 2026}'
```

**Response (200):**
```json
{
  "count": 27,
  "month": 3,
  "year": 2026
}
```

**Response (502) — portal niedostępny:**
```json
{
  "error": "Sync error",
  "detail": "Portal login failed: 503 ..."
}
```

### GET /shifts/actual
Faktycznie zrealizowane służby (Ist-Dienst) z portalu.

| Parameter | Type | Required | Description |
|---|---|---|---|
| month | number | - | Miesiąc (domyślnie: bieżący) |
| year | number | - | Rok (domyślnie: bieżący) |

```bash
curl "http://<VPS_IP>:3000/shifts/actual?month=3&year=2026"
```

**Response (200):**
```json
{
  "month": 3,
  "year": 2026,
  "duties": [
    {
      "date": "2026-03-01",
      "shiftCode": "KWR212",
      "startTime": "04:08",
      "endTime": "12:45",
      "allocationId": "18276097675",
      "allocatableUrl": "actual-duty-details?allocatableId=18276097675",
      "approved": true
    }
  ]
}
```

### GET /shifts/:date/details
Rozbicie służby na elementy (z portalu, live).

| Parameter | Type | Required | Description |
|---|---|---|---|
| date | string | ✓ | Data YYYY-MM-DD |

```bash
curl http://<VPS_IP>:3000/shifts/2026-03-20/details
```

**Response (200):**
```json
{
  "date": "2026-03-20",
  "shiftCode": "KWR234",
  "crewType": "K",
  "depot": "Wrocław Główny (Drużyny Konduktorskie)",
  "startTime": "04:08",
  "paidTime": "08:37",
  "workTime": "08:37",
  "allocationId": "18303413934",
  "confirmUrl": null,
  "rejectUrl": null,
  "needsConfirmation": false,
  "components": [
    {
      "type": "ADM",
      "typeLongName": "DK Czas administracyjny",
      "tripNumber": null,
      "crewType": "K",
      "startStation": "Wrocław Główny",
      "startTime": "04:08",
      "endStation": "Wrocław Główny",
      "endTime": "04:23",
      "vehicleType": null
    },
    {
      "type": "OBJ",
      "typeLongName": "DK Objęcie pociągu",
      "tripNumber": "6200",
      "crewType": "K",
      "startStation": "Wrocław Główny",
      "startTime": "04:23",
      "endStation": "Wrocław Główny",
      "endTime": "04:38",
      "vehicleType": "ED161"
    },
    {
      "type": "Umlstk",
      "typeLongName": "Segment jazdy",
      "tripNumber": "6200",
      "crewType": "K",
      "startStation": "Wrocław Główny",
      "startTime": "04:38",
      "endStation": "Koniecpol",
      "endTime": "07:54",
      "vehicleType": "ED161"
    },
    {
      "type": "PRZ",
      "typeLongName": "DK Przekazanie pociągu",
      "tripNumber": "6200",
      "crewType": "K",
      "startStation": "Koniecpol",
      "startTime": "07:54",
      "endStation": "Koniecpol",
      "endTime": "08:09",
      "vehicleType": null
    }
  ]
}
```

**Response (200, brak danych):**
```json
{
  "date": "2026-03-21",
  "shiftCode": null,
  "components": []
}
```

---

## Portal (IVU.pad)

Endpointy passthrough do portalu PKP Intercity (IVU.pad).

### GET /portal/health
Sprawdzenie połączenia z portalem + czas ostatniego synca.

```bash
curl http://<VPS_IP>:3000/portal/health
```

**Response (200):**
```json
{
  "ok": true,
  "loggedIn": true,
  "lastSyncAt": "2026-03-21T10:47:09.813Z"
}
```

**Response (200, portal niedostępny):**
```json
{
  "ok": false,
  "loggedIn": false,
  "error": "Portal login failed: 503 ...",
  "lastSyncAt": "2026-03-21T04:00:00.000Z"
}
```

### GET /portal/messages
Wiadomości ze skrzynki portalu (inbox).

| Parameter | Type | Required | Description |
|---|---|---|---|
| page | number | - | Strona (domyślnie: 1) |

```bash
curl "http://<VPS_IP>:3000/portal/messages?page=1"
```

**Response (200):**
```json
{
  "page": 1,
  "messages": [
    {
      "id": "msg-12345",
      "subject": "Zmiana w grafiku",
      "sender": "Dyspozytor",
      "body": "Treść wiadomości...",
      "timestamp": "2026-03-20 14:30",
      "unread": true,
      "monthGroup": "Marzec 2026"
    }
  ],
  "nextPage": "2"
}
```

### GET /portal/accounts
Salda kont czasu pracy (nadgodziny, urlopy, etc.).

```bash
curl http://<VPS_IP>:3000/portal/accounts
```

**Response (200):**
```json
{
  "accounts": [
    {
      "name": "Nadgodziny",
      "value": "+12:30",
      "referenceDate": "2026-03-20"
    },
    {
      "name": "Urlop wypoczynkowy",
      "value": "18 dni",
      "referenceDate": "2026-03-20"
    }
  ]
}
```

### POST /portal/confirm-timecard
Potwierdzenie karty pracy (HTTP attempt → Playwright fallback).

| Field | Type | Required | Description |
|---|---|---|---|
| date | string | ✓ | Data YYYY-MM-DD |

```bash
curl -X POST http://<VPS_IP>:3000/portal/confirm-timecard \
  -H "Content-Type: application/json" \
  -d '{"date": "2026-03-20"}'
```

**Response (200, potwierdzona):**
```json
{
  "success": true,
  "method": "http",
  "message": "Confirmed for 2026-03-20",
  "date": "2026-03-20"
}
```

**Response (200, nie wymaga potwierdzenia):**
```json
{
  "success": false,
  "message": "Timecard does not need confirmation",
  "date": "2026-03-20"
}
```

**Response (502, portal error):**
```json
{
  "error": "Confirmation failed",
  "detail": "Portal login failed: ..."
}
```

---

## Expenses (Wydatki)

### GET /expenses
Pobierz wydatki (opcjonalny filtr miesiąca).

| Parameter | Type | Required | Description |
|---|---|---|---|
| month | number | - | Miesiąc (1-12) |
| year | number | - | Rok |

```bash
curl "http://<VPS_IP>:3000/expenses?month=3&year=2026"
```

**Response (200):**
```json
[
  {
    "id": 1,
    "title": "Rachunek za prąd",
    "amount": 150.50,
    "accountNumber": "12 3456 7890 1234 5678 9012 3456",
    "dueDate": "2026-03-20T00:00:00.000Z",
    "status": "unpaid",
    "recurring": true,
    "createdAt": "2026-03-01T10:00:00.000Z"
  }
]
```

### POST /expenses
Utwórz wydatek.

| Field | Type | Required | Description |
|---|---|---|---|
| title | string | ✓ | Nazwa |
| amount | number | ✓ | Kwota (PLN) |
| accountNumber | string | - | Numer konta |
| dueDate | string | - | Termin (ISO 8601) |
| status | string | - | `paid` / `unpaid` (domyślnie: `unpaid`) |
| recurring | boolean | - | Cykliczny? (domyślnie: false) |

```bash
curl -X POST http://<VPS_IP>:3000/expenses \
  -H "Content-Type: application/json" \
  -d '{"title": "Internet", "amount": 99.99, "dueDate": "2026-03-25"}'
```

### PATCH /expenses/:id
Edytuj wydatek. Body: dowolne pola z POST.

```bash
curl -X PATCH http://<VPS_IP>:3000/expenses/1 \
  -H "Content-Type: application/json" \
  -d '{"status": "paid"}'
```

### DELETE /expenses/:id
Usuń wydatek.

```bash
curl -X DELETE http://<VPS_IP>:3000/expenses/1
```
**Response: 204 No Content**

---

## Routines (Rutyny)

### GET /routines
Lista rutyn z `isDue` flag.

```bash
curl http://<VPS_IP>:3000/routines
```

**Response (200):**
```json
[
  {
    "id": 1,
    "name": "Ćwiczenia poranne",
    "type": "daily",
    "intervalDays": null,
    "lastDone": "2026-03-20T08:00:00.000Z",
    "createdAt": "2026-03-01T00:00:00.000Z",
    "isDue": true
  }
]
```

### POST /routines
Utwórz rutynę.

| Field | Type | Required | Description |
|---|---|---|---|
| name | string | ✓ | Nazwa |
| type | string | - | `daily` / `interval` / `monthly` (domyślnie: `daily`) |
| intervalDays | number | - | Dni interwału (tylko dla `interval`) |

```bash
curl -X POST http://<VPS_IP>:3000/routines \
  -H "Content-Type: application/json" \
  -d '{"name": "Pranie", "type": "interval", "intervalDays": 3}'
```

### POST /routines/:id/complete
Oznacz rutynę jako wykonaną (ustawia `lastDone` na teraz).

```bash
curl -X POST http://<VPS_IP>:3000/routines/1/complete
```

### DELETE /routines/:id
Usuń rutynę.

```bash
curl -X DELETE http://<VPS_IP>:3000/routines/1
```

---

## Notes (QuickNote)

Proste notatki tekstowe (legacy — dashboard QuickNote).

### GET /notes
```bash
curl http://<VPS_IP>:3000/notes
```

### POST /notes

| Field | Type | Required |
|---|---|---|
| content | string | ✓ |

```bash
curl -X POST http://<VPS_IP>:3000/notes \
  -H "Content-Type: application/json" \
  -d '{"content": "Kupić mleko"}'
```

### DELETE /notes/:id
```bash
curl -X DELETE http://<VPS_IP>:3000/notes/1
```

---

## Markdown Notes (Notatnik)

Obsidian-compatible notatki Markdown (filesystem `mind-notes/`).

### GET /mdnotes
Lista notatek.

```bash
curl http://<VPS_IP>:3000/mdnotes
```

**Response (200):**
```json
[
  {
    "slug": "ABC%20Odprawa",
    "title": "ABC Odprawa",
    "preview": "Instrukcja odprawy pociągu...",
    "updatedAt": "2026-03-15T10:00:00.000Z",
    "size": 4521
  }
]
```

### GET /mdnotes/:slug
Pełna treść notatki.

```bash
curl http://<VPS_IP>:3000/mdnotes/ABC%20Odprawa
```

### POST /mdnotes
Utwórz notatkę.

| Field | Type | Required |
|---|---|---|
| title | string | ✓ |
| content | string | - |

### PATCH /mdnotes/:slug
Edytuj treść.

| Field | Type | Required |
|---|---|---|
| content | string | ✓ |

### DELETE /mdnotes/:slug
Usuń notatkę. **Response: 204**

---

## Devices & Monitoring

### GET /devices
Lista urządzeń z aktualnym statusem (ping).

```bash
curl http://<VPS_IP>:3000/devices
```

**Response (200):**
```json
[
  {
    "id": 1,
    "name": "Router",
    "host": "192.168.1.1",
    "createdAt": "2026-03-01T00:00:00.000Z",
    "online": true
  }
]
```

### POST /devices

| Field | Type | Required |
|---|---|---|
| name | string | ✓ |
| host | string | ✓ |

### DELETE /devices/:id
**Response: 204**

### GET /monitoring/vps
Status VPS (uptime, RAM).

```bash
curl http://<VPS_IP>:3000/monitoring/vps
```

**Response (200):**
```json
{
  "uptime": "up 5 days, 12 hours",
  "totalMem": 3840,
  "usedMem": 1920,
  "memPercent": 50
}
```

### GET /monitoring/docker
Kontenery Docker na VPS.

```bash
curl http://<VPS_IP>:3000/monitoring/docker
```

**Response (200):**
```json
{
  "available": true,
  "containers": [
    {
      "name": "mind-backend",
      "status": "Up 2 hours",
      "image": "ubuntu-mind-backend",
      "running": true
    }
  ]
}
```

---

## Trains & Station (PLK)

Proxy do PLK API (Polskie Linie Kolejowe — rozkład jazdy i operacje).

**Uwaga:** odpowiedź `GET /trains/search` zawiera listę przystanków z czasami planowymi — nadaje się do przyszłego **importu trasy** w module Komunikaty (obecnie moduł Pociągi już z tego korzysta; komunikaty nadal opierają się na ręcznej sesji w aplikacji). Zob. [ARCHITECTURE.md — przepływ „Komunikaty radiowe”](ARCHITECTURE.md).

### GET /trains/search
Wyszukaj pociąg po numerze.

| Parameter | Type | Required |
|---|---|---|
| number | string | ✓ |
| date | string | ✓ |

```bash
curl "http://<VPS_IP>:3000/trains/search?number=6200&date=2026-03-20"
```

### GET /trains/:orderId/live
Pozycja live pociągu.

| Parameter | Type | Required |
|---|---|---|
| scheduleId | string | - |
| date | string | - |

```bash
curl "http://<VPS_IP>:3000/trains/12345/live?scheduleId=67890&date=2026-03-20"
```

### GET /station/search
Wyszukaj stację po nazwie.

| Parameter | Type | Required |
|---|---|---|
| q | string | ✓ (min 2 znaki) |

```bash
curl "http://<VPS_IP>:3000/station/search?q=wroclaw"
```

### GET /station/timetable
Rozkład stacji (odjazdy/przyjazdy).

| Parameter | Type | Required | Description |
|---|---|---|---|
| stationId | number | ✓ | ID stacji PLK |
| date | string | - | YYYY-MM-DD (domyślnie: dziś) |
| type | string | - | `departure` / `arrival` (domyślnie: `departure`) |
| fromTime | string | - | HH:MM (filtr od godziny) |

```bash
curl "http://<VPS_IP>:3000/station/timetable?stationId=7500&date=2026-03-20&type=departure&fromTime=06:00"
```

---

## Templates

### GET /templates/messages
Szablony komunikatów radiowych (JSON na serwerze). Niezależne od generatorów w `mind-app/constants/komunikaty.ts` — można rozszerzać treści bez wydania nowej wersji aplikacji, o ile klient zacznie z nich korzystać.

```bash
curl http://<VPS_IP>:3000/templates/messages
```

---

## Error Codes

| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 204 | No Content (deleted) |
| 400 | Bad Request (brak pól, zły format) |
| 404 | Not Found |
| 409 | Conflict (notatka istnieje) |
| 500 | Internal Server Error |
| 502 | Bad Gateway (portal / PLK niedostępne) |

---

## Cron Jobs

| Schedule | Action | Description |
|----------|--------|-------------|
| `0 */6 * * *` | `syncMonth()` | Auto-sync bieżącego + następnego miesiąca z portalu IVU.pad |
| startup + 30s | `runScheduledSync()` | Initial sync po uruchomieniu kontenera |

---

Ostatnia aktualizacja: 2026-03-21
