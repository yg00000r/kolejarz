#!/usr/bin/env bash
# Instalacja bezpośrednio na podłączony iPhone (szybsze niż IPA przy pierwszym razie).
set -euo pipefail
cd "$(dirname "$0")/.."

DEVICE_ID="${1:-00008150-00090DA43400C01C}"

echo "=== Instalacja Kolejarz na iPhone ==="
echo "Urządzenie: $DEVICE_ID"
echo ""
echo "W Xcode (jeśli się otworzy): Target Kolejarz → Signing → wybierz Personal Team"
echo ""

export DEVELOPMENT_TEAM="${DEVELOPMENT_TEAM:-C575W8H28R}"

npx expo run:ios \
  --device "$DEVICE_ID" \
  --configuration Release
