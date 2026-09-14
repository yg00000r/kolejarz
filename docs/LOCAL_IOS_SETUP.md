# Lokalne środowisko (Mac + iOS) — Kolejarz

Cel: sklonować repo na **prywatny komputer**, postawić zależności i mieć gotowe środowisko pod dalsze fazy pracy na **iOS** (Expo Go + opcjonalnie native / Xcode).

Sekrety i `.env` **nie są w gicie** — po sklonowaniu trzeba je odbudować. Zobacz [SECRETS_AUDIT.md](./SECRETS_AUDIT.md).

---

## 1. Pobranie plików na prywatny komputer

Cloud Agent **nie może** wgrać plików bezpośrednio na Twój dysk. Jedyna pewna ścieżka to GitHub.

### Wariant A — czysty klon (zalecane)

Na Macu (Terminal / iTerm):

```bash
# Wymaga dostępu do prywatnego repo (SSH key lub HTTPS + token)
git clone git@github.com:yg00000r/kolejarz.git
# albo: git clone https://github.com/yg00000r/kolejarz.git

cd kolejarz
git checkout main
git pull origin main
```

### Wariant B — branch z PR (jeśli pracujesz nad konkretnym PR)

```bash
cd kolejarz
git fetch origin
git checkout cursor/ios-local-env-0f40   # lub inny branch z PR
git pull origin cursor/ios-local-env-0f40
```

### Czego **nie** dostaniesz z gita

| Brakuje lokalnie | Skąd wziąć |
|---|---|
| `mind-backend/.env` | Skopiuj z `.env.example` + wygeneruj sekrety ([SECRETS_AUDIT.md](./SECRETS_AUDIT.md)) |
| `mind-app/.env` | Opcjonalnie — tylko gdy lokalny backend |
| `.local-credentials/` | SSH VPS, notatki maintainera — poza repo; odbuduj lub skopiuj bezpiecznym kanałem (nie commitować) |
| `node_modules/` | `npm install` |
| `mind-app/ios/` (native) | `npx expo prebuild` / `npx expo run:ios` |

---

## 2. Wymagania sprzętowe / soft (iOS)

| Narzędzie | Wersja | Po co |
|---|---|---|
| macOS | aktualny LTS | Xcode, podpisywanie |
| Node.js | **20+** (nvm) | Expo + backend |
| npm | 10+ | zależności |
| Xcode | 16+ (App Store) | native build, simulator, device |
| Xcode Command Line Tools | `xcode-select --install` | `xcodebuild`, `devicectl` |
| CocoaPods | `sudo gem install cocoapods` lub brew | `pod install` w `ios/` |
| Expo Go | App Store (iPhone) | szybki dev bez native |
| Apple ID / Development Team | konto free lub paid | instalacja na fizycznym iPhonie |
| EAS CLI (opcjonalnie) | `npm i -g eas-cli` | cloud builds / OTA |

Sprawdzenie:

```bash
node -v          # v20+
npm -v
xcodebuild -version
pod --version
```

---

## 3. Frontend (`mind-app`) — szybki start

```bash
cd mind-app
cp .env.example .env   # opcjonalne; odkomentuj EXPO_PUBLIC_API_URL przy lokalnym backendzie
npm install
npx tsc --noEmit
npx expo start --lan
```

Na iPhonie: Expo Go → zeskanuj QR (ta sama sieć Wi‑Fi).

### Adres API

- Domyślnie produkcja: publiczny IP VPS (patrz `constants/api.ts`).
- Nadpisanie lokalne: w `mind-app/.env`:

```env
EXPO_PUBLIC_API_URL=http://localhost:3000
# lub IP Maca w LAN, np. http://192.168.1.40:3000
```

Po zmianie `.env` **zrestartuj** Metro (`r` w terminalu Expo / pełny restart).

### ATS (iOS + HTTP)

Expo Go na iOS często blokuje HTTP do publicznego IP ([KB-001](../known-bugs.md)). Na fizycznym urządzeniu do pełnych testów sync użyj:

```bash
npx expo run:ios --device
# albo: bash scripts/install-on-iphone.sh <UDID>
```

Przed `install-on-iphone.sh` ustaw własne:

```bash
export DEVELOPMENT_TEAM=XXXXXXXXXX   # Team ID z Apple Developer
# UDID: Xcode → Window → Devices and Simulators
```

---

## 4. Backend lokalny (`mind-backend`) — maintainer / pełny stack

```bash
cd mind-backend
cp .env.example .env
# Uzupełnij ENCRYPTION_KEY, PLK_API_KEY (patrz SECRETS_AUDIT.md)
# Na Macu Chromium Playwright (opcjonalnie):
#   npx playwright install chromium
#   CHROMIUM_PATH=$(node -e "console.log(require('playwright-core').chromium.executablePath())")
# albo pomiń — bez timecard confirm reszta działa

npm install
npx prisma migrate dev
npm run dev
```

Health:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/portal/health
```

W aplikacji ustaw `EXPO_PUBLIC_API_URL=http://<IP_MACA>:3000` (nie `localhost` na telefonie — telefon ≠ Mac).

---

## 5. Skrypt pomocniczy

Z katalogu głównego repo:

```bash
bash scripts/setup-local-env.sh
```

Skrypt:

- kopiuje `.env.example` → `.env` (bez nadpisywania istniejących),
- generuje `ENCRYPTION_KEY` jeśli pusty,
- sprawdza Node ≥ 20,
- wypisuje checklistę iOS.

---

## 6. Checklist „gotowy pod fazy iOS”

- [ ] Repo sklonowane na prywatnym Macu, `main` aktualny
- [ ] `npm install` w `mind-app` i (opcjonalnie) `mind-backend`
- [ ] `npx tsc --noEmit` w `mind-app` przechodzi
- [ ] Expo Go ładuje appkę **albo** native build na urządzeniu
- [ ] `mind-backend/.env` uzupełniony **nowymi** sekretami (nie kopiuj wycieków)
- [ ] Brak plików `.env` / kluczy w stage’u gita (`git status`)
- [ ] Xcode + Team ID + UDID urządzenia znane
- [ ] Przeczytany [SECRETS_AUDIT.md](./SECRETS_AUDIT.md) — rotacja wykonana jeśli był wyciek

---

## 7. Co dalej (fazy iOS)

Po zielonej checklistcie:

1. Native iOS workflow (`expo run:ios`, podpisywanie, OTA).
2. HTTPS / ATS bez wyjątków HTTP (gdy Caddy/DNS na VPS gotowe).
3. Kontynuacja UI (MD3 / HIG) według `TASKS.md` — już na lokalnym Macu.

Nie commituj `.env`, `.local-credentials/`, `*.p12`, profili provisioning.
