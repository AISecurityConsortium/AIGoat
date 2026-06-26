#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/common.sh"

echo ""
echo "=========================================="
echo "  AIGoat Classroom -- Stop Class"
echo "=========================================="
echo ""

stop_existing_ngrok
ok "ngrok stopped"

print_check() {
  local label="$1"
  local status="$2"
  printf "  %-28s %s\n" "$label:" "$status"
}

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  if [[ -f "$COMPOSE_BASE" && -f "$COMPOSE_CLASSROOM" ]]; then
    info "Stopping classroom Docker services"
    compose stop backend frontend ollama 2>/dev/null || compose stop backend ollama
    ok "Docker services stopped (volumes preserved)"
  fi
else
  warn "Docker not available; skipped container shutdown"
fi

if [[ -f "$RUNTIME_DIR/ngrok-url.txt" ]]; then
  NGROK_URL="$(tr -d '[:space:]' < "$RUNTIME_DIR/ngrok-url.txt")"
  if curl -sf "${NGROK_URL}/api/products/" >/dev/null 2>&1; then
    warn "Public ngrok endpoint still responds; verify ngrok is fully stopped"
  else
    ok "Public ngrok endpoint is no longer reachable"
  fi
fi

if curl -sf http://127.0.0.1:8000/api/products/ >/dev/null 2>&1; then
  print_check "Local backend" "still reachable"
else
  print_check "Local backend" "stopped"
fi

if classroom_ollama_reachable; then
  print_check "Local Ollama" "still reachable on host"
else
  print_check "Local Ollama" "stopped"
fi

echo ""
ok "Classroom stack stopped. Student database and Ollama model volumes were preserved."
echo ""
