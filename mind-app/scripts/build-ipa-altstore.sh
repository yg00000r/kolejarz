#!/usr/bin/env bash
# Buduje NIEPODPISANE Release .app i pakuje je do .ipa dla AltStore.
# AltStore podpisuje aplikację ponownie kontem Apple ID przy instalacji,
# więc nie potrzebujemy tu provisioning profile ani Development Team.
# Świadomie pomijamy `pod install`, żeby nie dociągać podów reanimated/lottie
# (reanimated 4.x wymaga New Architecture, a projekt jest na Old Arch i nic
#  z tych pakietów nie jest aktualnie importowane w JS).
set -euo pipefail
cd "$(dirname "$0")/.."

SCHEME="Kolejarz"
WORKSPACE="ios/Kolejarz.xcworkspace"
DERIVED_DATA="ios/build/DerivedData"
APP_PATH="$DERIVED_DATA/Build/Products/Release-iphoneos/${SCHEME}.app"
STAGE="ios/build/ipa-altstore"
IPA_OUT="ios/build/${SCHEME}.ipa"
DESKTOP_IPA="$HOME/Desktop/Kolejarz.ipa"

echo "→ Build (Release, generic iOS, unsigned)…"
xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -derivedDataPath "$DERIVED_DATA" \
  build \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY="" \
  | tail -40

if [[ ! -d "$APP_PATH" ]]; then
  echo "✗ Nie znaleziono $APP_PATH po buildzie." >&2
  exit 1
fi

echo "→ Pakowanie do .ipa…"
rm -rf "$STAGE" "$IPA_OUT"
mkdir -p "$STAGE/Payload"
cp -R "$APP_PATH" "$STAGE/Payload/"
( cd "$STAGE" && zip -qry "../${SCHEME}.ipa" Payload )

cp "$IPA_OUT" "$DESKTOP_IPA"
echo "✓ IPA gotowe: $DESKTOP_IPA"
ls -lh "$DESKTOP_IPA"
