#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/common.sh"

echo ""
echo "=========================================="
echo "  AIGoat Classroom -- Status"
echo "=========================================="
echo ""

print_check() {
  local label="$1"
  local status="$2"
  printf "  %-28s %s\n" "$label:" "$status"
}

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  print_check "Docker" "running"
  if [[ -f "$COMPOSE_BASE" && -f "$COMPOSE_CLASSROOM" ]]; then
    SERVICES="$(compose ps --format '{{.Service}}:{{.State}}' 2>/dev/null | paste -sd ', ' - || echo 'unavailable')"
    print_check "Compose services" "${SERVICES:-none}"
  fi
else
  print_check "Docker" "not running or not installed"
fi

if curl -sf http://127.0.0.1:8000/api/products/ >/dev/null 2>&1; then
  print_check "Backend (local)" "healthy"
else
  print_check "Backend (local)" "unreachable"
fi

if classroom_ollama_reachable; then
  print_check "Ollama (host)" "healthy (${CLASSROOM_OLLAMA_URL})"
  if [[ "$(classroom_model_available)" == "yes" ]]; then
    print_check "$CLASSROOM_OLLAMA_MODEL" "installed"
  else
    print_check "$CLASSROOM_OLLAMA_MODEL" "missing"
  fi
else
  print_check "Ollama (host)" "unreachable (${CLASSROOM_OLLAMA_URL})"
  print_check "$CLASSROOM_OLLAMA_MODEL" "unknown"
fi

NGROK_PID_FILE="$RUNTIME_DIR/ngrok.pid"
if [[ -f "$NGROK_PID_FILE" ]] && kill -0 "$(cat "$NGROK_PID_FILE")" 2>/dev/null; then
  print_check "ngrok process" "running (PID $(cat "$NGROK_PID_FILE"))"
else
  print_check "ngrok process" "not running"
fi

if [[ -f "$RUNTIME_DIR/ngrok-url.txt" ]]; then
  NGROK_URL="$(tr -d '[:space:]' < "$RUNTIME_DIR/ngrok-url.txt")"
  if curl -sf "${NGROK_URL}/api/products/" >/dev/null 2>&1; then
    print_check "ngrok public API" "healthy (${NGROK_URL#https://})"
  else
    print_check "ngrok public API" "unreachable"
  fi
else
  print_check "ngrok public API" "no saved URL"
fi

if [[ -f "$RUNTIME_DIR/vercel-preview-url.txt" ]]; then
  PREVIEW_URL="$(tr -d '[:space:]' < "$RUNTIME_DIR/vercel-preview-url.txt")"
  print_check "Vercel preview URL" "$PREVIEW_URL"
  if curl -sf "$PREVIEW_URL" >/dev/null 2>&1; then
    print_check "Vercel homepage" "reachable"
  else
    print_check "Vercel homepage" "unreachable"
  fi
  if curl -sf "${PREVIEW_URL}/api/products/" >/dev/null 2>&1; then
    print_check "Vercel API rewrite" "healthy"
  else
    print_check "Vercel API rewrite" "unreachable"
  fi
else
  print_check "Vercel preview URL" "not deployed"
fi

if [[ -f "$CLASSROOM_CONFIG" ]]; then
  if python3 -c "import yaml" 2>/dev/null; then
    python3 - <<PY
import yaml
from pathlib import Path
data = yaml.safe_load(Path("$CLASSROOM_CONFIG").read_text())
origins = data.get("app", {}).get("allowed_origins", [])
print("  Allowed CORS origins:")
for origin in origins:
    print(f"    - {origin}")
PY
  else
    warn "python3-yaml not installed; skipping CORS origin listing"
    grep -A 20 'allowed_origins:' "$CLASSROOM_CONFIG" | grep '    - ' | sed 's/^/  /' || true
  fi
fi

echo ""
echo "Resource usage:"
free -h | sed -n '1,2p' | sed 's/^/  /'
df -h / | sed -n '1,2p' | sed 's/^/  /'

echo ""
echo "Listening ports (3000, 8000, 11434):"
if command -v ss >/dev/null 2>&1; then
  ss -tln | awk 'NR==1 || /:(3000|8000|11434)/' | sed 's/^/  /'
else
  warn "ss not available"
fi

echo ""
