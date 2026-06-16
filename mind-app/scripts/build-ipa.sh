#!/usr/bin/env bash
# Buduje Release IPA dla sideloadu przez AltStore (Personal Team).
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -d /Applications/Xcode.app ]]; then
  echo "Brak Xcode w /Applications/Xcode.app — zainstaluj z App Store i uruchom raz." >&2
  exit 1
fi

if [[ "$(xcode-select -p 2>/dev/null)" != "/Applications/Xcode.app/Contents/Developer" ]]; then
  echo "Ustaw xcode-select: sudo xcode-select -s /Applications/Xcode.app/Contents/Developer" >&2
  exit 1
fi
xcodebuild -version

echo "→ Pod install..."
cd ios && pod install && cd ..

SCHEME="Kolejarz"
WORKSPACE="ios/Kolejarz.xcworkspace"
ARCHIVE_PATH="ios/build/Kolejarz.xcarchive"
EXPORT_PATH="ios/build/ipa"
IPA_OUT="ios/build/Kolejarz-${APP_VERSION:-1.0.0}.ipa"

rm -rf "$ARCHIVE_PATH" "$EXPORT_PATH"
mkdir -p ios/build

echo "→ Archive (Release)..."
xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE_PATH" \
  archive \
  CODE_SIGN_STYLE=Automatic \
  DEVELOPMENT_TEAM="${DEVELOPMENT_TEAM:-}" \
  -allowProvisioningUpdates \
  -allowProvisioningDeviceRegistration

echo "→ Export IPA..."
xcodebuild \
  -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist ios/ExportOptions.plist

if [[ -f "$EXPORT_PATH/Kolejarz.ipa" ]]; then
  cp "$EXPORT_PATH/Kolejarz.ipa" "$IPA_OUT"
  echo "✓ IPA: $IPA_OUT"
else
  ls -la "$EXPORT_PATH" 2>/dev/null || true
  echo "Sprawdź archive w Xcode (Product → Archive) jeśli export się nie udał." >&2
  exit 1
fi
