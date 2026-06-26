#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/common.sh"

usage() {
  cat <<'EOF'
Generate frontend/vercel.json from NGROK_URL.

Usage:
  export NGROK_URL="https://example.ngrok-free.app"
  ./scripts/classroom/generate-vercel-config.sh

Environment:
  NGROK_URL   Required. Must begin with https://
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

NGROK_URL="${NGROK_URL:-}"
if [[ -z "$NGROK_URL" ]]; then
  fail "NGROK_URL is required. Example: export NGROK_URL=\"https://example.ngrok-free.app\""
fi

if [[ "$NGROK_URL" != https://* ]]; then
  fail "NGROK_URL must begin with https:// (got: $NGROK_URL)"
fi

NGROK_URL="${NGROK_URL%/}"
HOSTNAME="${NGROK_URL#https://}"

VERCEL_JSON="$PROJECT_ROOT/frontend/vercel.json"

cat > "$VERCEL_JSON" <<EOF
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "${NGROK_URL}/api/:path*"
    },
    {
      "source": "/media/:path*",
      "destination": "${NGROK_URL}/media/:path*"
    },
    {
      "source": "/((?!api/|media/|static/).*)",
      "destination": "/index.html"
    }
  ]
}
EOF

ok "Wrote frontend/vercel.json"
info "Public backend hostname: ${HOSTNAME}"
