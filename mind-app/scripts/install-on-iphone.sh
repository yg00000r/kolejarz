#!/usr/bin/env bash
# Instalacja bezpośrednio na podłączony iPhone (Release build + devicectl install).
set -euo pipefail
cd "$(dirname "$0")/.."

DEVICE_ID="${1:-}"
DEVELOPMENT_TEAM="${DEVELOPMENT_TEAM:-}"
SCHEME="Kolejarz"
WORKSPACE="ios/Kolejarz.xcworkspace"
DERIVED_DATA="ios/build/DerivedData"

if [[ -z "$DEVICE_ID" ]]; then
  echo "Użycie: $0 <UDID>" >&2
  echo "UDID: Xcode → Window → Devices and Simulators" >&2
  echo "Team: export DEVELOPMENT_TEAM=XXXXXXXXXX" >&2
  exit 1
fi
if [[ -z "$DEVELOPMENT_TEAM" ]]; then
  echo "Ustaw DEVELOPMENT_TEAM (Apple Team ID), np.:" >&2
  echo "  export DEVELOPMENT_TEAM=XXXXXXXXXX" >&2
  exit 1
fi

echo "=== Instalacja Kolejarz na iPhone ==="
echo "Urządzenie: $DEVICE_ID"
echo "Team: $DEVELOPMENT_TEAM"
echo ""

echo "→ Pod install..."
(cd ios && pod install)

echo "→ Build (Release, device)..."
xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Release \
  -destination "id=$DEVICE_ID" \
  -derivedDataPath "$DERIVED_DATA" \
  -allowProvisioningUpdates \
  -allowProvisioningDeviceRegistration \
  CODE_SIGN_STYLE=Automatic \
  DEVELOPMENT_TEAM="$DEVELOPMENT_TEAM" \
  build

APP_PATH="$DERIVED_DATA/Build/Products/Release-iphoneos/Kolejarz.app"
if [[ ! -d "$APP_PATH" ]]; then
  echo "Nie znaleziono $APP_PATH po buildzie." >&2
  exit 1
fi

echo "→ Instalacja na urządzeniu..."
xcrun devicectl device install app --device "$DEVICE_ID" "$APP_PATH"
echo "✓ Zainstalowano com.ygor.kolejarz na iPhone."
