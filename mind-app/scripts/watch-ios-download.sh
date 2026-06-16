#!/usr/bin/env bash
LOG="$HOME/Desktop/kolejarz-ios-download.log"

progress_line() {
  [[ -f "$LOG" ]] && tail -c 4000 "$LOG" | tr '\r' '\n' | grep -E "Downloading iOS|Downloaded|error|Preparing|Installed" | tail -1
}

bar() {
  local pct="${1:-0}"
  local width=40 filled=$(( pct * width / 100 )) empty=$(( width - filled ))
  printf "["; printf "%${filled}s" | tr ' ' '='; printf "%${empty}s" | tr ' ' '-'; printf "] %3s%%" "$pct"
}

parse_pct() {
  local line="$1"
  if [[ "$line" =~ ([0-9]+,[0-9]+)\% ]]; then echo "${BASH_REMATCH[1]//,/.}" | awk '{printf "%d", $1}'
  elif [[ "$line" =~ ([0-9]+)\% ]]; then echo "${BASH_REMATCH[1]}"
  else echo "?"; fi
}

while true; do
  clear
  echo "╔══════════════════════════════════════════════════════╗"
  echo "║   Kolejarz — pobieranie iOS 26.5 (Xcode Platform)   ║"
  echo "╚══════════════════════════════════════════════════════╝"
  echo
  if pgrep -f "xcodebuild -downloadPlatform iOS" >/dev/null 2>&1; then
    echo "Status:  ● POBIERANIE"
  else
    echo "Status:  ○ zatrzymane / zakończone — sprawdź log poniżej"
  fi
  line="$(progress_line)"
  echo
  [[ -n "$line" ]] && echo "$line" || echo "Czekam na dane..."
  pct="$(parse_pct "$line")"
  [[ "$pct" != "?" ]] && { echo; bar "$pct"; }
  echo
  echo "Log: $LOG"
  echo "Odświeżanie co 2 s · Ctrl+C aby zamknąć"
  sleep 2
done
