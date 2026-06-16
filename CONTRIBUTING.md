# Contributing Guide — Kolejarz

> Zasady pracy nad projektem. Czytaj ARCHITECTURE.md i API.md przed rozpoczęciem.

## Spis treści

1. [Workflow](#workflow)
2. [Podział pracy na sesje](#podział-pracy-na-sesje)
3. [Code style](#code-style)
4. [Testowanie przed deployem](#testowanie-przed-deployem)
5. [Deployment](#deployment)
6. [Debugging](#debugging)
7. [Dokumentacja](#dokumentacja)

---

## Git Workflow

### Gałęzie
- `main` — produkcja / stabilna. **Nie commituj bezpośrednio** (z wyjątkiem hotfixów).
- `feature/<opis>` — każda nowa funkcja lub zmiana na osobnej gałęzi, np. `feature/multi-tenant`, `feature/timecard-confirm`.

### Cykl pracy
```bash
# 1. Zacznij od aktualnego main
git checkout main && git pull

# 2. Utwórz gałąź feature
git checkout -b feature/moja-zmiana

# 3. Commituj małe logiczne kroki
git add -p   # lub wskaż konkretne pliki
git commit -m "Dodaj szyfrowanie hasła portalu w Tenant"

# 4. Push i pull request do main
git push -u origin feature/moja-zmiana
# → otwórz PR na GitHub, poproś o review (nawet przy 2 devach)
```

### Konwencja commitów
- Krótkie, imperatywne zdanie po polsku lub angielsku
- Opisuj **DLACZEGO**, nie tylko co
- Dobry: `Usuń brute-force loop haseł — wymagamy explicit credentials`
- Zły: `Zmiany w portal.ts`

### Czego NIGDY nie commitować
- `.env`, `*.key`, `*.pem`, `id_rsa`, `dev.db`
- `mind-backend/dist/` (compiled output)
- `.local-credentials/` (SSH, deploy docs)
- Prawdziwe hasła, klucze API, adresy IP VPS

---

## Workflow

### Ogólna zasada
1. **Zaplanuj** — przejrzyj `tasks.md`, wybierz zadanie
2. **Implementuj** — pisz kod zgodnie z style guide poniżej
3. **Testuj** — frontend (Expo Go) + backend (lokalnie lub na VPS)
4. **Dokumentuj** — zaktualizuj `API.md`, `tasks.md` jeśli nowe endpointy
5. **Deploy** — rsync + Docker restart na VPS (maintainer)

---

## Podział pracy na sesje

### Limit tokenów na sesję
- **Kontekst:** Pliki projektu + TASKS.md + bieżące zmiany
- **Reguła:** Każde zadanie powinno zmieścić się w jednej sesji albo być podzielone na sub-fazy (np. 8A, 8B, 8C)

### Kiedy dzielić sesję
- **3+ nowe ekrany w frontendzie** → osobne sesje na UI (zmiany) i UI (nowe ekrany)
- **Duży moduł backendu** (np. portal IVU.pad) → podziel na serwis, endpointy, frontend, infra
- **Duże refaktoryzacje** → najpierw backend, potem frontend

### Szablonowe rozkłady sesji
| Sesja | Zawartość | Czas |
|---|---|---|
| Lekka | Setup, konfiguracja, dokumentacja | 30–60 min |
| Średnia | 1–2 ekrany UI + API endpoint | 1–2 h |
| Ciężka | Cały moduł (UI + backend + deploy) | 2–4 h |
| Bardzo ciężka | Duży refactor lub migracja (np. FAZA 8) | 4–6 h |

---

## Code style

### Frontend (React Native / TypeScript)

**Komponenty:**
```typescript
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface ShiftCardProps {
  date: string;
  shiftCode: string;
  startTime?: string;
  onPress?: () => void;
}

export function ShiftCard({ date, shiftCode, startTime, onPress }: ShiftCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.code}>{shiftCode}</Text>
      {startTime && <Text style={styles.time}>{startTime}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 12 },
  code: { fontSize: 18, fontWeight: '700' },
  time: { fontSize: 14, color: '#666' },
});
```

**Services (API client):**
```typescript
const BASE_URL = 'http://<STARY_VPS_IP>:3000';

export async function fetchShifts(month: number, year: number) {
  const res = await fetch(`${BASE_URL}/shifts?month=${month}&year=${year}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
```

**Hooks:**
```typescript
useEffect(() => {
  loadData();
}, [month, year]); // zawsze jawne dependency array
```

### Backend (Node.js / TypeScript / Express)

**Setup:**
```bash
npm run dev     # ts-node-dev (development)
npm run build   # tsc → dist/ (production)
npm start       # node dist/index.js (production)
```

**Struktura:**
- `src/index.ts` — Express app + wszystkie route handlers (inline)
- `src/services/portal.ts` — logika portalu IVU.pad (login, fetch, parse)
- `src/services/portal-browser.ts` — Playwright browser automation
- `prisma/schema.prisma` — modele danych

**Error handling — zawsze try/catch na route handlers:**
```typescript
app.get('/shifts', async (req, res) => {
  try {
    const rows = await prisma.shift.findMany({ ... });
    return res.json(rows);
  } catch (e) {
    return res.status(500).json({ error: 'query failed', detail: String(e) });
  }
});
```

**Portal passthrough — obsługa 502:**
```typescript
app.get('/portal/messages', async (req, res) => {
  try {
    const token = await portalLogin();
    const html = await fetchMessages(token, page);
    const result = parseMessages(html);
    return res.json(result);
  } catch (e) {
    const msg = String(e);
    if (msg.includes('auth expired') || msg.includes('login failed')) clearToken();
    return res.status(502).json({ error: 'Portal error', detail: msg });
  }
});
```

**Prisma:**
```typescript
import { PrismaClient } from './generated/prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL ?? 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });
```

---

## Testowanie przed deployem

### Backend
```bash
cd mind-backend

# TypeScript check
npx tsc --noEmit

# Build
npm run build

# Test endpointy (lokalnie)
npm run dev &
curl http://localhost:3000/health
curl http://localhost:3000/portal/health
curl "http://localhost:3000/shifts?month=3&year=2026"
```

### Frontend
```bash
cd mind-app

# Start Expo
npx expo start

# Na iPhonie: Expo Go → skanuj QR kod
# Jeśli inna sieć: npx expo start --tunnel
```

### Integration
```bash
# Terminal 1: Backend
cd mind-backend && npm run dev

# Terminal 2: Frontend
cd mind-app && npx expo start

# Na iPhonie w Expo Go:
# 1. Zaloguj się (PIN)
# 2. Dashboard → Praca → Grafik
# 3. Kliknij dzień pracy → rozbicie służby
# 4. Sprawdź Wiadomości, Konta, Karty pracy
```

---

## Deployment

### Pre-deploy checklist
- [ ] `npx tsc --noEmit` przechodzi
- [ ] `npm run build` OK
- [ ] Nowe endpointy przetestowane lokalnie
- [ ] TASKS.md zaktualizowany
- [ ] API.md zaktualizowany (jeśli nowe endpointy)

### Deploy na VPS

```bash
# 1. Build
cd mind-backend
npm run build

# 2. Rsync (pomija node_modules, .env, DB, notatki)
rsync -avz --exclude='node_modules' --exclude='.env' --exclude='dev.db' \
  --exclude='mind-notes' mind-backend/ vps:~/mind-backend/

# 3. Rebuild kontener na VPS
ssh vps
cd ~/mind-backend
docker stop mind-backend && docker rm mind-backend
docker build -t ubuntu-mind-backend .
docker run -d --name mind-backend -p 3000:3000 \
  --env-file .env \
  -v $(pwd)/dev.db:/app/dev.db \
  -v $(pwd)/mind-notes:/app/mind-notes \
  --restart unless-stopped \
  ubuntu-mind-backend

# 4. Weryfikacja
curl http://<STARY_VPS_IP>:3000/health
curl http://<STARY_VPS_IP>:3000/portal/health
docker logs mind-backend --tail 20
```

### VPS .env
```env
PORT=3000
DATABASE_URL="file:./dev.db"
PORTAL_USER=<PORTAL_USERNAME>  # credentials teraz per tenant w DB
# PORTAL_PASSWORD — auto-generowane jeśli puste
CHROMIUM_PATH=/usr/bin/chromium
```

### SSH config (lokalna maszyna)
```
Host vps
    HostName <STARY_VPS_IP>
    User ubuntu
    IdentityFile ~/.ssh/id_ed25519
    IdentitiesOnly yes
```

---

## Debugging

### Backend logs (Docker)
```bash
# Ostatnie logi
ssh vps "docker logs mind-backend --tail 50"

# Follow (live)
ssh vps "docker logs mind-backend -f"

# Restart kontenera
ssh vps "docker restart mind-backend"

# Shell w kontenerze
ssh vps "docker exec -it mind-backend /bin/bash"
```

### Portal connectivity
```bash
# Sprawdź czy portal odpowiada
curl http://<STARY_VPS_IP>:3000/portal/health

# Sprawdź logi logowania
ssh vps "docker logs mind-backend 2>&1 | grep Portal"

# Test sync ręczny
curl -X POST http://<STARY_VPS_IP>:3000/shifts/sync \
  -H "Content-Type: application/json" -d '{}'
```

### Chromium / Playwright
```bash
# Sprawdź czy Chromium jest w kontenerze
ssh vps "docker exec mind-backend chromium --version"

# Test confirm-timecard
curl -X POST http://<STARY_VPS_IP>:3000/portal/confirm-timecard \
  -H "Content-Type: application/json" \
  -d '{"date": "2026-03-20"}'
```

### Frontend (Expo Go)
- **Metro bundler logs:** widoczne w terminalu gdzie uruchomiono `npx expo start`
- **Reload:** shake iPhone → "Reload"
- **Console:** shake iPhone → "Open JS Debugger"

### Face ID / biometria (Kolejarz)
- **Expo Go** hostuje JS w aplikacji „Expo Go”, nie w natywnym binary projektu — `LocalAuthentication` sprawdza `Bundle.main` hosta; część ścieżek zwraca `missing_usage_description` albo od razu **kod iPhone’a** zamiast Face ID.
- Aplikacja próbuje kolejno: **tylko biometria** → przy typowych błędach hosta **jedna próba** z `deviceOwnerAuthentication` (biometria lub kod urządzenia).
- **Pełny Face ID jako pierwszy ekran** — buduj **development client**: `npx expo run:ios` lub `eas build` (nie samo Expo Go).
- Logika: `mind-app/contexts/biometricAuth.ts` + komunikaty na ekranie PIN.

---

## Dokumentacja

### Konwencje
- **Komentarze w kodzie** — wyjaśnij złożoną logikę (nie co robisz, ale dlaczego)
- **Bez komentarzy narracyjnych** — nie `// import modułu`, nie `// zwróć wynik`

### Co aktualizować przy zmianach
| Zmiana | Pliki do aktualizacji |
|--------|----------------------|
| Nowy endpoint | API.md, TASKS.md |
| Nowy ekran UI | TASKS.md |
| Nowy serwis backend | ARCHITECTURE.md, TASKS.md |
| Zmiana schematu DB | ARCHITECTURE.md (schema section) |
| Zmiana deployu | ARCHITECTURE.md (deployment), CONTRIBUTING.md |
| Nowa zależność | ARCHITECTURE.md (dependency tree) |
| Moduł Komunikaty (logika / PLK / sesja) | ARCHITECTURE.md (§ Przepływy → pkt 6), `readme.md`, `TASKS.md` (FAZA 9); źródło treści: `komunikaty.md` |

### Pre-commit checklist
- [ ] TypeScript kompiluje się (`npx tsc --noEmit`)
- [ ] Frontend uruchomiony i przetestowany na iPhonie
- [ ] TASKS.md zaktualizowany
- [ ] Dokumentacja zaktualna
- [ ] Nie commitujesz `.env`, `dev.db`, `node_modules`

---

Ostatnia aktualizacja: 2026-03-21 (dokumentacja komunikatów: ARCHITECTURE + TASKS FAZA 9)
