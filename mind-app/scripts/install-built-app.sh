#!/usr/bin/env bash
# Wgrywa już zbudowany Kolejarz.app na podłączony iPhone (po Archive / expo run:ios).
set -euo pipefail
cd "$(dirname "$0")/.."

DEVICE_NAME="${1:-iPhone 17 Pro Max}"
DERIVED_GLOB=~/Library/Developer/Xcode/DerivedData/Kolejarz-*/Build/Products/Release-iphoneos/Kolejarz.app

APP_PATH="${APP_PATH:-}"
if [[ -z "$APP_PATH" ]]; then
  APP_PATH=$(ls -td $DERIVED_GLOB 2>/dev/null | head -1 || true)
fi

if [[ -z "$APP_PATH" || ! -d "$APP_PATH" ]]; then
  echo "Nie znaleziono Kolejarz.app. Najpierw zbuduj:" >&2
  echo "  npx expo run:ios --device <UDID> --configuration Release" >&2
  echo "  lub Product → Archive w Xcode, potem ponów ten skrypt po buildzie." >&2
  exit 1
fi

echo "→ Szukam urządzenia: $DEVICE_NAME"
DEVICE_ID=$(xcrun devicectl list devices 2>/dev/null | awk -v name="$DEVICE_NAME" '$0 ~ name { print $4; exit }')
if [[ -z "$DEVICE_ID" ]]; then
  echo "Nie znaleziono urządzenia. Podłącz iPhone (kabel/Wi‑Fi), odblokuj, zaufaj Macowi." >&2
  xcrun devicectl list devices 2>/dev/null || true
  exit 1
fi

echo "→ Instalacja: $APP_PATH"
echo "   Na: $DEVICE_NAME ($DEVICE_ID)"
xcrun devicectl device install app --device "$DEVICE_ID" "$APP_PATH"
echo "✓ Zainstalowano com.ygor.mind — ikona „Kolejarz” na ekranie głównym."
