#!/usr/bin/env bash
# Instalacja bezpośrednio na podłączony iPhone (Release build + devicectl install).
set -euo pipefail
cd "$(dirname "$0")/.."

DEVICE_ID="${1:-00008150-00090DA43400C01C}"
DEVELOPMENT_TEAM="${DEVELOPMENT_TEAM:-C575W8H28R}"
SCHEME="Kolejarz"
WORKSPACE="ios/Kolejarz.xcworkspace"
DERIVED_DATA="ios/build/DerivedData"

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
