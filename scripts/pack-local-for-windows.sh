#!/usr/bin/env bash
# Pakuje lokalne / wrażliwe pliki do zipa z hasłem (do transferu LocalSend Mac → Windows).
# NIE commituj wynikowego zipa. Uruchamiaj na Macu, w katalogu root repo.
#
# Użycie:
#   ./scripts/pack-local-for-windows.sh
#   ./scripts/pack-local-for-windows.sh 'twoje-haslo'
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OUT="${ROOT}/kolejarz-local-secrets.zip"
STAGING="$(mktemp -d)"
trap 'rm -rf "$STAGING"' EXIT

PASSWORD="${1:-}"
if [[ -z "$PASSWORD" ]]; then
  read -r -s -p "Hasło do zipa: " PASSWORD
  echo
  if [[ -z "$PASSWORD" ]]; then
    echo "Brak hasła — przerywam." >&2
    exit 1
  fi
fi

added=0
copy_if_exists() {
  local src="$1"
  local dest="$STAGING/$1"
  if [[ -e "$src" ]]; then
    mkdir -p "$(dirname "$dest")"
    cp -R "$src" "$dest"
    echo "  + $src"
    added=$((added + 1))
  fi
}

echo "Szukam lokalnych plików w: $ROOT"
copy_if_exists ".local-credentials"
copy_if_exists "mind-app/.env"
copy_if_exists "mind-app/.env.local"
copy_if_exists "mind-backend/.env"
copy_if_exists "mind-backend/.env.local"
copy_if_exists "mind-backend/dev.db"

# Dodatkowe lokalne env warianty
shopt -s nullglob
for f in mind-app/.env.*.local mind-backend/.env.*.local; do
  copy_if_exists "$f"
done
shopt -u nullglob

if [[ "$added" -eq 0 ]]; then
  echo "Nic do spakowania — brak .local-credentials / .env / dev.db w tym katalogu." >&2
  echo "Uruchom skrypt na Macu w sklonowanym repo, gdzie te pliki faktycznie są." >&2
  exit 1
fi

rm -f "$OUT"
(
  cd "$STAGING"
  # -P = hasło (bez interaktywnego promptu), -r = rekursywnie, -q = ciszej
  zip -P "$PASSWORD" -r -q "$OUT" .
)

echo
echo "OK: $OUT"
echo "Rozmiar: $(du -h "$OUT" | awk '{print $1}')"
echo
echo "Dalej:"
echo "  1. Wyślij zip LocalSendem na Windows"
echo "  2. Na Windows: git clone / git checkout cursor/android-port-0f40"
echo "  3. Rozpakuj zip do rootu sklonowanego repo"
echo "  4. Usuń zip na obu maszynach"
echo
echo "UWAGA: nie commituj tego zipa do gita."
