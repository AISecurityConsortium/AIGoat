#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/common.sh"

echo ""
echo "=========================================="
echo "  AIGoat Classroom -- Local Setup"
echo "=========================================="
echo ""

REQUIRED_CMDS=(git curl openssl python3 node npm)
MISSING=()
for cmd in "${REQUIRED_CMDS[@]}"; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    MISSING+=("$cmd")
  fi
done

if ((${#MISSING[@]} > 0)); then
  fail "Missing required commands: ${MISSING[*]}"
fi

export PATH="/home/Logan/.local/bin:$PATH"

if ! "$(docker_cmd)" info >/dev/null 2>&1; then
  fail "Docker daemon is not running. Start Docker Desktop before continuing."
fi

if ! compose version >/dev/null 2>&1; then
  fail "Docker Compose plugin is not available"
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

info "Validating Docker Compose classroom configuration"
compose config >/dev/null
validate_compose_localhost_only

info "Building classroom backend (host Ollama: ${CLASSROOM_OLLAMA_MODEL})"
compose build backend

info "Checking host Ollama at ${CLASSROOM_OLLAMA_URL}"
wait_for_ollama "Host Ollama" 30 3

if [[ "$(classroom_model_available)" != "yes" ]]; then
  fail "Model '${CLASSROOM_OLLAMA_MODEL}' not found on host Ollama. Install it with: ollama pull ${CLASSROOM_OLLAMA_MODEL}"
fi
ok "Model ${CLASSROOM_OLLAMA_MODEL} is available on host Ollama"

info "Starting backend"
compose up -d backend

info "Waiting for backend health"
wait_for_url "http://127.0.0.1:8000/api/products/" "Backend" 40 3

info "Testing local API route"
curl -sf "http://127.0.0.1:8000/api/feature-flags/" >/dev/null
ok "Local API responded"

if ! ngrok_authenticated; then
  warn "ngrok is not authenticated yet"
  echo ""
  echo "Next manual step:"
  echo "  1. Copy your authtoken from https://dashboard.ngrok.com/get-started/your-authtoken"
  echo "  2. Run: ngrok config add-authtoken <token>"
  echo "  3. Verify: ngrok config check"
  echo "  4. Copy .classroom.env.example to .classroom.env and set NGROK_DOMAIN"
  echo "  5. Run: ./scripts/classroom/start-class.sh"
else
  ok "ngrok authentication verified"
  info "Next: ./scripts/classroom/start-class.sh"
fi

echo ""
ok "Classroom local stack is ready on http://127.0.0.1:8000"
echo ""
