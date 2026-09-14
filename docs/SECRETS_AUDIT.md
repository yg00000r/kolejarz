# Audyt sekretów i odbudowa `.env`

Założenie: pliki `.env` / credentiale **mogły wyciec lub zaginąć**. Traktuj wszystkie dotychczasowe sekrety jako **skompromitowane** i wygeneruj nowe. Ten dokument mapuje kod → zmienne → procedurę rotacji.

Nic z poniższego nie powinno trafić do gita (`.gitignore` już blokuje `.env`, `.local-credentials/`, klucze).

---

## 1. Inventory — co kod naprawdę czyta

### Backend (`mind-backend`)

| Zmienna | Gdzie użyta | Wymagana? | Jak wygenerować / skąd |
|---|---|---|---|
| `PORT` | `src/index.ts` | nie (domyślnie 3000) | `3000` lokalnie |
| `DATABASE_URL` | Prisma, `index.ts`, `authMiddleware.ts` | tak | lokalnie: `file:./dev.db` |
| `NODE_ENV` | runtime | zalecane | `development` lokalnie / `production` VPS |
| `PLK_API_KEY` | proxy PLK w `index.ts` | tak (pociągi/stacje) | od dostawcy PLK / maintainer — **nie** z historii chatu |
| `ENCRYPTION_KEY` | `src/crypto.ts` (AES-256-GCM haseł portalu w DB) | **tak na produkcji** | `openssl rand -hex 32` (dokładnie 64 znaki hex) |
| `CHROMIUM_PATH` | `portal-browser.ts` (Playwright / timecard) | opcjonalnie | Mac: ścieżka z Playwright; VPS: `/usr/bin/chromium` |
| `APP_PUBLIC_URL` | release / AltStore routes | zalecane | lokalnie `http://localhost:3000`; VPS = publiczny URL |
| `CORS_ORIGINS` | `index.ts` | nie | lista originów oddzielona przecinkami; puste = otwarte |
| `TEMPLATES_DIR` / `RELEASES_DIR` | `index.ts` | nie | domyślne ścieżki w cwd |
| `PORTAL_USER` | `portal.ts` → `defaultPortalUser()` — **legacy** endpointy bez tenanta | lokalnie tylko jeśli używasz starych ścieżek | Twój login IVU — **bez** hardcodu w kodzie |
| `PORTAL_PASSWORD` | tylko w deprecated auto-password path | nie | hasło IVU; preferuj rejestrację `POST /auth/register` |

Hasła portalu użytkowników są w SQLite (`Tenant.portalPasswordEncrypted`), szyfrowane `ENCRYPTION_KEY`. Sesje aplikacji: tabela `AppSession` (Bearer token).

### Frontend (`mind-app`)

| Zmienna / sekret | Gdzie | Uwagi |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | `constants/api.ts` | opcjonalna; bez niej = produkcyjny URL z kodu |
| Session token | SecureStore `kolejarz_session_token` | po rejestracji; nie w `.env` |
| PIN / biometria / employee | SecureStore (`AuthContext`) | lokalne na urządzeniu |

### Poza `.env` (też „sekrety operacyjne”)

| Asset | Status w repo | Akcja przy wycieku |
|---|---|---|
| SSH do VPS | tylko `.local-credentials/` (gitignore) | nowy klucz, usunąć stary z `authorized_keys` |
| Apple Development Team / certy | lokalnie w Keychain / Xcode | revoke w developer.apple.com jeśli wyciek |
| EAS / Expo project | `app.json` → `extra.eas.projectId` (publiczne ID projektu) | rotuj tokeny `eas login`, nie projectId |
| Publiczny IP VPS | hardcoded w `constants/api.ts`, `app.json` ATS | to nie sekret, ale infrastruktura — rozważ HTTPS + domenę |
| Domyślny login IVU w kodzie | usunięty fallback osobowy — wymaga `PORTAL_USER` | nie wracać do hardcodu PII |

---

## 2. Co NIE jest w repo (i nie powinno być)

- Prawdziwe `PLK_API_KEY`, `ENCRYPTION_KEY`, hasła IVU
- Pliki `.env`
- Klucze SSH / `*.pem` / `*.p12` / provisioning
- Dump bazy `dev.db` z produkcji

Jeśli którykolwiek z powyższych pojawił się w chacie, LocalSend, pack ZIP, screenshotach — **rotuj**.

---

## 3. Procedura odbudowy (lokalnie + VPS)

### A. Lokalny Mac (dev)

```bash
cd mind-backend
cp .env.example .env

# Nowy klucz szyfrowania (lokalna DB — OK wyzerować)
# wklej wynik do ENCRYPTION_KEY=
openssl rand -hex 32

# PLK — wstaw aktualny klucz (odnowiony u dostawcy jeśli wyciek)
# PLK_API_KEY=...

# Opcjonalnie legacy:
# PORTAL_USER=twoj_login_ivu
```

```bash
cd mind-app
cp .env.example .env
# EXPO_PUBLIC_API_URL=http://192.168.x.x:3000
```

```bash
# Walidacja
bash scripts/setup-local-env.sh
cd mind-backend && npx prisma migrate dev && npm run dev
```

Lokalna pusta `dev.db`: użytkownicy rejestrują się od nowa w appce (login+hasło IVU).

### B. Produkcja (VPS) — jeśli `.env` wyciekł

1. **Nowy `ENCRYPTION_KEY`** — stary klucz **nie odszyfruje** zapisanych haseł portalu.
2. Skutek: trzeba **ponownie zarejestrować** tenantów (`POST /auth/register` / flow w appce) albo ręcznie wyczyścić `Tenant` / `AppSession` i poprosić o re-login.
3. **Nowy `PLK_API_KEY`** u dostawcy; stary unieważnij.
4. Zrestartuj kontener z nowym `--env-file`.
5. **SSH**: nowa para kluczy; usuń stare z serwera.
6. Nie commituj nowego `.env` — wgraj tylko po SSH / sekretnym kanale.

### C. Sesje aplikacji

Po rotacji sekretów / czyszczeniu DB:

- Wyczyść dane appki na iPhonie (lub reinstalacja) — SecureStore trzyma stary token ([KB-009](../known-bugs.md)).
- Zarejestruj się ponownie.

---

## 4. Checklista bezpieczeństwa (przed fazami iOS)

- [ ] `git status` — zero `.env`, zero kluczy
- [ ] `mind-backend/.env` istnieje lokalnie, wartości **nowe**
- [ ] `ENCRYPTION_KEY` ma długość 64 hex (`wc -c` / skrypt)
- [ ] `PLK_API_KEY` ustawiony; `/station/search` działa
- [ ] Brak haseł / tokenów w `known-bugs.md`, `ARCHITECTURE.md`, issue’ach
- [ ] `PORTAL_USER` nie jest hardcoded w `portal.ts`
- [ ] SSH VPS: klucz tylko w `~/.ssh` + opcjonalnie `.local-credentials/` (gitignore)
- [ ] Na telefonie świeża rejestracja po rotacji

---

## 5. Szybki test po odbudowie

```bash
# Backend
curl -s http://localhost:3000/health
curl -s http://localhost:3000/portal/health

# Rejestracja (hasło = prawdziwe IVU — nie loguj w historii shella z -v)
curl -s -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"<IVU_USER>","portalPassword":"<IVU_PASS>"}'
```

App: ustaw `EXPO_PUBLIC_API_URL`, Expo Go / native → rejestracja → sync grafiku.

---

## 6. Powiązane pliki

| Plik | Rola |
|---|---|
| `mind-backend/.env.example` | szablon backend |
| `mind-app/.env.example` | szablon API URL |
| `scripts/setup-local-env.sh` | bootstrap lokalny |
| `docs/LOCAL_IOS_SETUP.md` | Mac + iOS toolchain |
| `SETUP.md` | szybki start Expo Go |
