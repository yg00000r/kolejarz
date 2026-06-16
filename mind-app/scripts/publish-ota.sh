#!/usr/bin/env bash
# Publikuje aktualizację JS (OTA) przez EAS Update — bez kabla, bez nowego IPA.
# Wymaga: eas-cli, zalogowane konto Expo, wcześniej zbudowana binarka z expo-updates.
set -euo pipefail
cd "$(dirname "$0")/.."

MESSAGE="${1:-Update $(date +%Y-%m-%d)}"
BRANCH="${2:-production}"

echo "→ Publikuję OTA na branch: $BRANCH"
eas update --branch "$BRANCH" --message "$MESSAGE" --non-interactive

echo "✓ Gotowe. Aplikacja na iPhone pobierze update przy następnym starcie lub z Ustawienia → Sprawdź aktualizacje."
