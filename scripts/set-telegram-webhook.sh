#!/usr/bin/env bash
# Usage (from project-back, with API running on PORT):
#   1) Start tunnel in another terminal, e.g.:
#        npx --yes localtunnel --port 3010
#      or: ngrok http 3010
#   2) PUBLIC_URL=https://your-tunnel-host ./scripts/set-telegram-webhook.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
set -a
source "$ROOT/.env"
set +a

TOKEN="${TELEGRAM_BOT_TOKEN:-}"
SECRET="${TELEGRAM_WEBHOOK_SECRET:-}"
PUBLIC_URL="${PUBLIC_URL:-}"

if [[ -z "$TOKEN" ]]; then
  echo "TELEGRAM_BOT_TOKEN is empty in .env" >&2
  exit 1
fi

if [[ -z "$PUBLIC_URL" ]]; then
  echo "Set PUBLIC_URL to your HTTPS tunnel, e.g.:" >&2
  echo "  PUBLIC_URL=https://abc.loca.lt ./scripts/set-telegram-webhook.sh" >&2
  exit 1
fi

PUBLIC_URL="${PUBLIC_URL%/}"
WEBHOOK_URL="${PUBLIC_URL}/integrations/telegram/webhook"

echo "Setting webhook -> $WEBHOOK_URL"
curl -sS "https://api.telegram.org/bot${TOKEN}/setWebhook" \
  -d "url=${WEBHOOK_URL}" \
  -d "secret_token=${SECRET}" \
  -d "allowed_updates=[\"message\"]"
echo
echo "Webhook info:"
curl -sS "https://api.telegram.org/bot${TOKEN}/getWebhookInfo"
echo
