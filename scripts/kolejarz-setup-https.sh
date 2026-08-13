#!/usr/bin/env bash
# B4: HTTPS dla backendu Kolejarz przez istniejący Caddy (wzorem yg00r.com).
#
# Kontekst: `server` (100.66.57.89 w tailnecie) ma już działający Caddy z automatycznym
# HTTPS dla yg00r.com (reverse proxy do innego kontenera). Ten skrypt dodaje analogiczny
# blok dla kolejarz.yg00r.com -> 127.0.0.1:3000 (kontener `kolejarz`).
#
# Wymagania przed uruchomieniem:
#   1. DNS: w Cloudflare (zona yg00r.com) dodać rekord CNAME "kolejarz" -> "yg00r.com"
#      (proxied / orange cloud — tak samo jak apex), żeby nie trzeba było aktualizować
#      IP ręcznie przy zmianie adresu publicznego łącza domowego.
#   2. Sudo: skrypt modyfikuje /etc/caddy/Caddyfile i przeładowuje systemd service `caddy`
#      — wymaga uprawnień root, których agent (SSH bez hasła sudo) nie ma. Uruchom
#      ręcznie na serwerze:
#        sudo bash ~/kolejarz-setup-https.sh
#      (skopiowany tu skrypt jest identyczny z tym wgranym na serwer w ramach zadania B4)
#
# Po uruchomieniu zweryfikuj: curl -sI https://kolejarz.yg00r.com/health
# Następnie zaktualizuj `mind-app/constants/api.ts` -> BASE_URL na https://kolejarz.yg00r.com
set -euo pipefail

CADDYFILE=/etc/caddy/Caddyfile
BLOCK_MARKER="kolejarz.yg00r.com {"

if grep -qF "$BLOCK_MARKER" "$CADDYFILE"; then
  echo "Blok kolejarz.yg00r.com już istnieje w $CADDYFILE — nic nie robię."
  exit 0
fi

cp "$CADDYFILE" "${CADDYFILE}.bak.$(date +%Y%m%d%H%M%S)"
echo "Backup: ${CADDYFILE}.bak.*"

cat >> "$CADDYFILE" <<'EOF'

kolejarz.yg00r.com {
	# Reverse proxy do backendu Kolejarz (kontener `kolejarz`, port 3000)
	reverse_proxy 127.0.0.1:3000

	header {
		Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
		X-Content-Type-Options "nosniff"
		X-Frame-Options "DENY"
		Referrer-Policy "strict-origin-when-cross-origin"
		-Server
	}

	log {
		output file /var/log/caddy/kolejarz-access.log {
			roll_size 10MB
			roll_keep 5
		}
		format json
	}

	encode gzip
}
EOF

echo "Dodano blok. Walidacja konfiguracji..."
caddy validate --config "$CADDYFILE"

echo "Przeładowuję Caddy..."
systemctl reload caddy

echo "OK. Sprawdź: curl -sI https://kolejarz.yg00r.com/health"
