#!/usr/bin/env bash
# Run as root on a fresh Ubuntu 22.04/24.04 VPS.
# Usage: ./provision.sh (defaults below), or override any var, e.g. DOMAIN=coach.example.com ./provision.sh
set -euo pipefail

DOMAIN="${DOMAIN:-coach.thesolomiles.com}"
REPO_URL="${REPO_URL:-https://github.com/thesolomiles/solo-miles.git}"
BRANCH="${BRANCH:-projects-page}"
APP_DIR=/opt/solo-miles

apt-get update
apt-get install -y python3 python3-venv python3-pip git ufw curl debian-keyring debian-archive-keyring apt-transport-https

# Caddy (official repo) for automatic HTTPS.
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt-get update
apt-get install -y caddy

id -u coach &>/dev/null || useradd --system --create-home --shell /usr/sbin/nologin coach

if [ ! -d "$APP_DIR" ]; then
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
else
  git -C "$APP_DIR" fetch origin
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" pull origin "$BRANCH"
fi
chown -R coach:coach "$APP_DIR"

sudo -u coach python3 -m venv "$APP_DIR/coach/.venv"
sudo -u coach "$APP_DIR/coach/.venv/bin/pip" install -r "$APP_DIR/coach/requirements.txt"

if [ ! -f "$APP_DIR/coach/.env" ]; then
  echo ""
  echo "Missing $APP_DIR/coach/.env - copy your real secrets there (scp from your machine, or paste manually), then re-run this script."
  echo "It needs at least: OWNER_USERNAME, OWNER_PASSWORD, SESSION_SECRET, COOKIE_SECURE=true, plus the Strava/intervals.icu/Anthropic/Telegram keys."
  echo "Set STRAVA_REDIRECT_URI=https://$DOMAIN/strava/callback and WEB_BASE_URL=https://$DOMAIN"
  exit 1
fi

cp "$APP_DIR/coach/deploy/coach-web.service" /etc/systemd/system/coach-web.service
cp "$APP_DIR/coach/deploy/coach-bot.service" /etc/systemd/system/coach-bot.service
systemctl daemon-reload
systemctl enable --now coach-web coach-bot

sed "s/coach.thesolomiles.com/$DOMAIN/" "$APP_DIR/coach/deploy/Caddyfile" > /etc/caddy/Caddyfile
systemctl restart caddy

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo ""
echo "Done. https://$DOMAIN should be live once DNS for $DOMAIN points at this server's IP."
echo "Check services with: systemctl status coach-web coach-bot caddy"
