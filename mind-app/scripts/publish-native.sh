#!/usr/bin/env bash
# Wgrywa nową binarkę IPA + manifest na VPS (aktualizacja natywna przez AltStore).
# Użycie: ./scripts/publish-native.sh Kolejarz-1.0.1.ipa 1.0.1 2 "Poprawki Face ID"
set -euo pipefail

IPA_PATH="${1:?Podaj ścieżkę do pliku .ipa}"
VERSION="${2:?Podaj wersję semver, np. 1.0.1}"
BUILD="${3:?Podaj numer buildu, np. 2}"
NOTES="${4:-Aktualizacja natywna}"

VPS_HOST="${VPS_HOST:-mind-kolejarz-vps}"
REMOTE_DIR="${REMOTE_DIR:-~/mind-kolejarz/app-releases}"
FILE_NAME="Kolejarz-${VERSION}.ipa"
BASE_URL="${PUBLIC_BASE_URL:-http://57.128.246.232:3000}"

if [[ ! -f "$IPA_PATH" ]]; then
  echo "Brak pliku: $IPA_PATH" >&2
  exit 1
fi

MANIFEST=$(cat <<EOF
{
  "nativeVersion": "${VERSION}",
  "nativeBuildNumber": ${BUILD},
  "ipaUrl": "${BASE_URL}/app-releases/${FILE_NAME}",
  "releaseNotes": "${NOTES}",
  "mandatory": false
}
EOF
)

TMP=$(mktemp)
echo "$MANIFEST" > "$TMP"

echo "→ Wysyłam IPA na VPS..."
rsync -avz --progress "$IPA_PATH" "${VPS_HOST}:${REMOTE_DIR}/${FILE_NAME}"
rsync -avz "$TMP" "${VPS_HOST}:${REMOTE_DIR}/release.json"
rm "$TMP"

echo "✓ Wgrano ${FILE_NAME}."
echo "  AltStore Source (po HTTPS): ${BASE_URL}/altstore/source.json"
echo "  iPhone: AltStore → Browse → + → wklej URL source, albo Ustawienia → Sprawdź aktualizacje."
