#!/usr/bin/env bash
# Pierwszy build iOS w chmurze (EAS) — wymaga interakcji: Apple ID + hasło.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== EAS Build — Kolejarz na iPhone ==="
echo ""
echo "1. Zaloguj się Apple ID (darmowe konto wystarczy — Personal Team)"
echo "2. EAS zarejestruje certyfikat i provisioning profile"
echo "3. Jeśli zapyta o urządzenie — podłącz iPhone USB lub zarejestruj UDID"
echo ""

eas device:create || true

eas build --platform ios --profile development

echo ""
echo "Po buildzie: link do IPA w terminalu i na https://expo.dev"
echo "Instalacja: otwórz link na iPhone → AltStore lub bezpośrednio jeśli ad hoc."
