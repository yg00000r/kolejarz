# Kolejarz — Setup dla dewelopera

> **Cel:** działająca aplikacja na telefonie w mniej niż 10 minut, bez konfigurowania backendu.

---

## Szybki start — Expo Go (zalecane)

### Wymagania

- Node.js 20+ (`node --version`)
- npm 10+
- Expo Go na iPhonie (App Store)
- iPhone i komputer w **tej samej sieci WiFi**

### Kroki

```bash
# 1. Sklonuj repo
git clone <URL_REPO>
cd Mind/mind-app

# 2. Zainstaluj zależności
npm install

# 3. Uruchom Metro bundler
npx expo start --lan
# Jeśli jesteś w innej sieci niż VPS: npx expo start --tunnel
```

**4. Zeskanuj QR kod** w Expo Go (przycisk „Scan QR Code" w aplikacji)

**5. Rejestracja w aplikacji:**
- Wpisz swój login IVU (np. `jkowalski`)
- Wpisz hasło portalu IVU (to samo co na `portal.intercity.pl`)
- Ustaw PIN (4 cyfry) do codziennego logowania

**6. Gotowe!** Masz dostęp do:
- Grafiku (sync przez backend VPS)
- Pociągów PLK (proxy przez backend)
- Wiadomości z portalu IVU
- Kont czasu pracy
- Kart pracy
- Monitorowania VPS

**Nie musisz:**
- Uruchamiać własnego backendu
- Konfigurować pliku `.env`
- Mieć klucza PLK API
- Logować się do IVU w przeglądarce
- Mieć dostępu SSH do VPS

---

## Ograniczenie Expo Go na iOS

> Jeśli sync grafiku nie działa — patrz `known-bugs.md` [KB-001].

iOS blokuje HTTP do publicznego IP w Expo Go (ATS). Jeśli natrafisz na ten problem, użyj native buildu:

```bash
# Wymagane: Xcode + podane UDID urządzenia
npx expo run:ios --device <UDID> --configuration Release
```

Lub skontaktuj się z maintainerem, który zainstaluje native build przez `devicectl`.

---

## Weryfikacja po rejestracji

Sprawdź że wszystko działa:

1. **Praca** → „Zsynchronizuj grafik" → powinny pojawić się służby bieżącego miesiąca
2. **Pociągi** → wpisz numer pociągu → wyniki z PLK (dane przez backend)
3. **Monitorowanie** → zielony status VPS

Jeśli sync nie działa, sprawdź `known-bugs.md`.

---

## Struktura projektu (frontend)

```
mind-app/
├── app/(auth)/             logowanie, rejestracja
├── app/(app)/
│   ├── index.tsx           dashboard (2 kafelki: Praca, Monitorowanie)
│   ├── work/               moduł Praca
│   │   ├── index.tsx       hub (lista sub-modułów)
│   │   ├── schedule.tsx    grafik miesięczny
│   │   ├── trains.tsx      wyszukiwarka pociągów + live
│   │   ├── station.tsx     rozkład stacyjny
│   │   ├── duty-details.tsx rozbicie służby na elementy
│   │   ├── portal-messages.tsx wiadomości z portalu
│   │   ├── accounts.tsx    konta czasu pracy
│   │   ├── timecard.tsx    karty pracy
│   │   ├── routes.tsx      kontrolki szlaków
│   │   ├── messages/       komunikaty radiowe
│   │   ├── abc.tsx         ABC Odprawa
│   │   └── dodatki.tsx     zestawienia składów (Dod. A+B)
│   └── monitoring/         moduł Monitorowanie
├── services/
│   ├── api.ts              apiFetch helper (token Bearer)
│   ├── work.ts             API client dla modułu Praca
│   └── monitoring.ts       API client dla modułu Monitorowanie
├── contexts/AuthContext.tsx auth state, PIN, session token
└── constants/api.ts        BASE_URL → backend VPS
```

---

## Praca nad backendem (maintainer only)

> Wymagane: dostęp SSH do VPS + plik `.local-credentials/AGENT-SSH-VPS.md`

```bash
cd Mind/mind-backend
cp .env.example .env
# Uzupełnij .env: PLK_API_KEY, ENCRYPTION_KEY, CHROMIUM_PATH

npm install
npx prisma migrate dev
npm run dev
```

Zmień `BASE_URL` w `mind-app/constants/api.ts` na `http://localhost:3000` do lokalnego testowania.

### Deploy na VPS

```bash
cd mind-backend && npm run build

# Rsync skompilowanych plików
rsync -avz --exclude='node_modules' --exclude='.env' --exclude='dev.db' \
  dist/ mind-kolejarz-vps:~/mind-kolejarz/dist/

# Restart kontenera
ssh mind-kolejarz-vps "docker restart kolejarz"

# Weryfikacja
curl http://<VPS_IP>:3000/health
```

### Migracja Prisma po zmianie schematu

```bash
ssh mind-kolejarz-vps "docker exec kolejarz npx prisma migrate deploy"
```

---

## Szybkie debugowanie

```bash
# Backend health check
curl http://<VPS_IP>:3000/health

# Portal IVU status
curl http://<VPS_IP>:3000/portal/health

# Logi kontenera (maintainer)
ssh mind-kolejarz-vps "docker logs kolejarz --tail 50"
```

---

## Gdzie szukać pomocy

| Problem | Gdzie |
|---------|-------|
| Błędy sync, ATS, portal 503 | `known-bugs.md` |
| Endpointy API | `API.md` |
| Architektura | `ARCHITECTURE.md` |
| Git workflow, deploy | `CONTRIBUTING.md` |
| Dostęp VPS, SSH | Maintainer (nie w repo) |
