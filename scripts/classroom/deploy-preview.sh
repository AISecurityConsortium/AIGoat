#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/common.sh"

echo ""
echo "=========================================="
echo "  AIGoat Classroom -- Deploy Preview"
echo "=========================================="
echo ""

require_cmd vercel
require_cmd curl
require_cmd npm

NGROK_URL_FILE="$RUNTIME_DIR/ngrok-url.txt"
if [[ ! -f "$NGROK_URL_FILE" ]]; then
  fail "Missing ngrok URL file. Run ./scripts/classroom/start-class.sh first."
fi

NGROK_URL="$(tr -d '[:space:]' < "$NGROK_URL_FILE")"
wait_for_url "${NGROK_URL}/api/products/" "Active ngrok endpoint" 10 2

if ! vercel whoami >/dev/null 2>&1; then
  fail "Vercel CLI is not authenticated. Run: vercel login"
fi

if [[ ! -f "$PROJECT_ROOT/frontend/vercel.json" ]]; then
  export NGROK_URL
  "$SCRIPT_DIR/generate-vercel-config.sh"
fi

info "Building frontend locally"
classroom_build_frontend
ok "Frontend build succeeded"

info "Deploying Vercel preview from frontend/"
(
  cd "$PROJECT_ROOT/frontend"
  DEPLOY_OUTPUT="$(vercel deploy --yes --target=preview 2>&1)"
  echo "$DEPLOY_OUTPUT"
  PREVIEW_URL="$(echo "$DEPLOY_OUTPUT" | awk '/^[[:space:]]*Preview[[:space:]]+https:\/\// { print $2 }' | tail -1)"
  if [[ -z "${PREVIEW_URL:-}" ]]; then
    PREVIEW_URL="$(echo "$DEPLOY_OUTPUT" | python3 -c "
import json, re, sys
text = sys.stdin.read()
start = text.find('{\"status\"')
if start != -1:
    depth = 0
    for i in range(start, len(text)):
        if text[i] == '{':
            depth += 1
        elif text[i] == '}':
            depth -= 1
            if depth == 0:
                try:
                    data = json.loads(text[start:i + 1])
                    url = data.get('deployment', {}).get('url', '')
                    if url:
                        print(url if url.startswith('http') else f'https://{url}')
                        raise SystemExit(0)
                except json.JSONDecodeError:
                    break
match = re.search(r'https://[a-zA-Z0-9.-]+\.vercel\.app', text)
if match:
    print(match.group(0))
" | tail -1)"
  fi
)

if [[ -z "${PREVIEW_URL:-}" ]]; then
  fail "Could not capture Vercel preview URL from deploy output"
fi

echo "$PREVIEW_URL" >"$RUNTIME_DIR/vercel-preview-url.txt"
ok "Preview URL saved to .classroom-runtime/vercel-preview-url.txt"

"$SCRIPT_DIR/set-vercel-origin.sh" "$PREVIEW_URL"

info "Testing preview homepage"
curl -sf "$PREVIEW_URL" >/dev/null
ok "Preview homepage responded"

info "Testing preview API rewrite"
curl -sf "${PREVIEW_URL}/api/products/" >/dev/null
ok "Preview API rewrite responded"

echo ""
ok "Preview deployment complete"
info "Preview URL: $PREVIEW_URL"
echo ""
echo "Required Vercel dashboard actions:"
echo "  1. Open the Vercel project for this frontend."
echo "  2. Go to Settings."
echo "  3. Open Deployment Protection."
echo "  4. Enable Vercel Authentication for preview deployments."
echo "  5. Protect the current preview deployment."
echo "  6. Create a shareable access link only if your plan supports protected preview sharing."
echo "  7. Share only the protected Vercel link with students."
echo "  8. Do not share the ngrok URL."
echo ""
warn "If your Vercel plan cannot share a protected preview with all students, do not make the deployment public."
echo ""
