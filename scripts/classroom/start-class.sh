#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/common.sh"

echo ""
echo "=========================================="
echo "  AIGoat Classroom -- Start Class"
echo "=========================================="
echo ""

require_cmd ngrok
require_cmd curl
require_cmd docker

if ! ngrok_authenticated; then
  fail "ngrok is not authenticated. Run: ngrok config add-authtoken <token>, then: ngrok config check (or export NGROK_AUTHTOKEN in this shell)"
fi

load_classroom_env
if [[ -z "${NGROK_DOMAIN:-}" ]]; then
  fail "NGROK_DOMAIN is missing. Copy .classroom.env.example to .classroom.env and set NGROK_DOMAIN."
fi

NGROK_DOMAIN="${NGROK_DOMAIN#https://}"
NGROK_DOMAIN="${NGROK_DOMAIN%/}"
NGROK_URL="https://${NGROK_DOMAIN}"

if ! "$(docker_cmd)" info >/dev/null 2>&1; then
  fail "Docker daemon is not running"
fi

ensure_runtime_dir
if [[ ! -f "$CLASSROOM_CONFIG" ]]; then
  if [[ -f "${CLASSROOM_CONFIG}.example" ]]; then
    cp "${CLASSROOM_CONFIG}.example" "$CLASSROOM_CONFIG"
    ok "Created $CLASSROOM_CONFIG from example"
  else
    fail "Missing classroom config: $CLASSROOM_CONFIG"
  fi
fi
ensure_classroom_secret

info "Checking host Ollama at ${CLASSROOM_OLLAMA_URL}"
wait_for_ollama "Host Ollama" 30 3

if [[ "$(classroom_model_available)" != "yes" ]]; then
  fail "Model '${CLASSROOM_OLLAMA_MODEL}' not found on host Ollama. Install it with: ollama pull ${CLASSROOM_OLLAMA_MODEL}"
fi
ok "Model ${CLASSROOM_OLLAMA_MODEL} is available on host Ollama"

info "Starting classroom backend"
compose up -d backend

wait_for_url "http://127.0.0.1:8000/api/products/" "Backend" 40 3

stop_existing_ngrok

DOMAIN_FLAG="$(ngrok_domain_flag)"
NGROK_LOG="$RUNTIME_DIR/ngrok.log"
NGROK_PID_FILE="$RUNTIME_DIR/ngrok.pid"

info "Starting ngrok tunnel to 127.0.0.1:8000"
NGROK_AUTH_ARGS=()
if auth_arg="$(ngrok_auth_args)"; then
  [[ -n "$auth_arg" ]] && NGROK_AUTH_ARGS=("$auth_arg")
fi
if [[ "$DOMAIN_FLAG" == "--domain" ]]; then
  ngrok "${NGROK_AUTH_ARGS[@]}" http --domain="$NGROK_DOMAIN" 127.0.0.1:8000 >"$NGROK_LOG" 2>&1 &
else
  ngrok "${NGROK_AUTH_ARGS[@]}" http --url="$NGROK_URL" 127.0.0.1:8000 >"$NGROK_LOG" 2>&1 &
fi
echo $! >"$NGROK_PID_FILE"
sleep 3

if ! kill -0 "$(cat "$NGROK_PID_FILE")" 2>/dev/null; then
  if [[ -s "$NGROK_LOG" ]]; then
    tail -20 "$NGROK_LOG" >&2
  fi
  fail "ngrok exited immediately. Check $NGROK_LOG and ngrok account/IP restrictions."
fi

PUBLIC_URL="$(ngrok_public_url "$NGROK_DOMAIN" || true)"
if [[ -z "$PUBLIC_URL" ]]; then
  fail "Could not determine ngrok public URL. Check $NGROK_LOG"
fi

echo "$PUBLIC_URL" >"$RUNTIME_DIR/ngrok-url.txt"
wait_for_url "${PUBLIC_URL}/api/products/" "Public ngrok API" 30 3

export NGROK_URL="$PUBLIC_URL"
"$SCRIPT_DIR/generate-vercel-config.sh"

echo ""
ok "Class tunnel is active"
info "Public ngrok hostname: ${PUBLIC_URL#https://}"
echo ""
echo "Next deployment command:"
echo "  ./scripts/classroom/deploy-preview.sh"
echo ""
warn "Share the protected Vercel preview URL with students, not the ngrok URL."
echo ""
