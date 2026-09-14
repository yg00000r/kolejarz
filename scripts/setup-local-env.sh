#!/usr/bin/env bash
# Bootstrap lokalnego środowiska Kolejarz (Mac / iOS).
# Nie nadpisuje istniejących .env. Nie wypisuje wartości sekretów.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ok()   { printf '  OK  %s\n' "$*"; }
warn() { printf ' WARN %s\n' "$*"; }
fail() { printf ' FAIL %s\n' "$*"; }

echo "=== Kolejarz — setup-local-env ==="
echo "Root: $ROOT"
echo ""

# --- Node ---
if ! command -v node >/dev/null 2>&1; then
  fail "Node.js nie znaleziony. Zainstaluj Node 20+ (nvm)."
  exit 1
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [[ "$NODE_MAJOR" -lt 20 ]]; then
  fail "Node $(node -v) — wymagane 20+."
  exit 1
fi
ok "Node $(node -v)"

# --- Backend .env ---
BE_EXAMPLE="$ROOT/mind-backend/.env.example"
BE_ENV="$ROOT/mind-backend/.env"
if [[ ! -f "$BE_ENV" ]]; then
  cp "$BE_EXAMPLE" "$BE_ENV"
  ok "Utworzono mind-backend/.env z .env.example"
else
  ok "mind-backend/.env już istnieje (bez zmian)"
fi

# Generuj ENCRYPTION_KEY jeśli pusty
if grep -qE '^ENCRYPTION_KEY=\s*$' "$BE_ENV" 2>/dev/null || ! grep -qE '^ENCRYPTION_KEY=' "$BE_ENV" 2>/dev/null; then
  KEY="$(openssl rand -hex 32)"
  if grep -qE '^ENCRYPTION_KEY=' "$BE_ENV"; then
    # portable in-place replace
    tmp="$(mktemp)"
    sed "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=${KEY}|" "$BE_ENV" > "$tmp"
    mv "$tmp" "$BE_ENV"
  else
    printf '\nENCRYPTION_KEY=%s\n' "$KEY" >> "$BE_ENV"
  fi
  ok "Wygenerowano nowy ENCRYPTION_KEY (64 hex) w mind-backend/.env"
else
  LEN="$(grep -E '^ENCRYPTION_KEY=' "$BE_ENV" | head -1 | cut -d= -f2- | tr -d '[:space:]' | wc -c | tr -d ' ')"
  if [[ "$LEN" -eq 64 ]]; then
    ok "ENCRYPTION_KEY obecny (64 znaki)"
  else
    warn "ENCRYPTION_KEY ma długość ${LEN} (oczekiwane 64). Wygeneruj: openssl rand -hex 32"
  fi
fi

if grep -qE '^PLK_API_KEY=\s*$' "$BE_ENV" 2>/dev/null; then
  warn "PLK_API_KEY pusty — wyszukiwanie pociągów/stacji nie zadziała, aż uzupełnisz klucz."
else
  ok "PLK_API_KEY ustawiony (wartość nie jest pokazywana)"
fi

# --- App .env ---
APP_EXAMPLE="$ROOT/mind-app/.env.example"
APP_ENV="$ROOT/mind-app/.env"
if [[ ! -f "$APP_ENV" ]]; then
  cp "$APP_EXAMPLE" "$APP_ENV"
  ok "Utworzono mind-app/.env z .env.example"
else
  ok "mind-app/.env już istnieje (bez zmian)"
fi

# --- npm install (opcjonalnie --skip-install) ---
if [[ "${1:-}" != "--skip-install" ]]; then
  echo ""
  echo "→ npm install (mind-app)..."
  (cd "$ROOT/mind-app" && npm install)
  ok "mind-app dependencies"
  echo "→ npm install (mind-backend)..."
  (cd "$ROOT/mind-backend" && npm install)
  ok "mind-backend dependencies"
else
  warn "Pominięto npm install (--skip-install)"
fi

echo ""
echo "=== Checklist iOS (ręcznie) ==="
echo "  [ ] Xcode zainstalowany (xcodebuild -version)"
echo "  [ ] CocoaPods (pod --version)"
echo "  [ ] Expo Go na iPhonie LUB native: npx expo run:ios --device"
echo "  [ ] Przeczytaj docs/LOCAL_IOS_SETUP.md i docs/SECRETS_AUDIT.md"
echo "  [ ] Uzupełnij PLK_API_KEY jeśli ostrzeżenie wyżej"
echo "  [ ] git status — upewnij się że .env nie jest stage'owany"
echo ""
echo "Gotowe. Start app:  cd mind-app && npx expo start --lan"
echo "Start API:          cd mind-backend && npx prisma migrate dev && npm run dev"
