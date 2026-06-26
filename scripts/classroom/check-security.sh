#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/common.sh"

PASS=0
FAIL_COUNT=0

check_pass() {
  ok "$1"
  PASS=$((PASS + 1))
}

check_fail() {
  warn "$1"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

echo ""
echo "=========================================="
echo "  AIGoat Classroom -- Security Check"
echo "=========================================="
echo ""

if command -v ss >/dev/null 2>&1; then
  BAD_BINDS="$(ss -tlnH | awk '{print $4}' | grep -E ':(3000|8000|11434)$' | grep -Ev '127\.0\.0\.1:|::1:' || true)"
  if [[ -z "$BAD_BINDS" ]]; then
    check_pass "Ports 3000, 8000, and 11434 are not bound on 0.0.0.0"
  else
    check_fail "Non-localhost binds detected: $BAD_BINDS"
  fi
else
  check_fail "ss not available; could not verify port bindings"
fi

if classroom_ollama_reachable; then
  check_pass "Ollama responds on host (localhost or Windows host from WSL)"
else
  warn "Ollama is not reachable on localhost (may be stopped)"
fi

if [[ -f "$RUNTIME_DIR/ngrok.pid" ]] && kill -0 "$(cat "$RUNTIME_DIR/ngrok.pid")" 2>/dev/null; then
  TUNNELS="$(curl -sf http://127.0.0.1:4040/api/tunnels 2>/dev/null || echo '{}')"
  if echo "$TUNNELS" | grep -q '127.0.0.1:8000'; then
    check_pass "ngrok targets 127.0.0.1:8000"
  else
    check_fail "ngrok is running but does not appear to target 127.0.0.1:8000"
  fi
  if echo "$TUNNELS" | grep -q '11434'; then
    check_fail "ngrok appears to expose port 11434"
  else
    check_pass "ngrok does not expose Ollama port 11434"
  fi
else
  warn "ngrok is not running (skipped ngrok target checks)"
fi

TRACKED_ENV="$(git -C "$PROJECT_ROOT" ls-files '.env' '.env.local' '.env.classroom' '.classroom.env' 2>/dev/null || true)"
if [[ -z "$TRACKED_ENV" ]]; then
  check_pass "No .env files are tracked by Git"
else
  check_fail "Tracked env files found: $TRACKED_ENV"
fi

if git -C "$PROJECT_ROOT" grep -RIn --exclude-dir=.git -E 'NGROK_AUTHTOKEN|ngrok.*authtoken|authtoken_[A-Za-z0-9]+' . >/dev/null 2>&1; then
  check_fail "Possible ngrok authtoken found in repository files"
else
  check_pass "No ngrok authtoken patterns found in repository files"
fi

if grep -RIn --exclude='check-security.sh' --exclude-dir=.classroom-runtime --exclude='*.bak.classroom-*' -E 'vercel[[:space:]]+--prod' "$PROJECT_ROOT/scripts/classroom" >/dev/null 2>&1; then
  check_fail "Production Vercel deploy command found in classroom scripts"
else
  check_pass "No production Vercel deploy command in classroom scripts"
fi

if [[ -f "$CLASSROOM_CONFIG" ]]; then
  if grep -q '__CLASSROOM_SETUP_GENERATED__\|aigoat-dev-secret-change-in-production' "$CLASSROOM_CONFIG"; then
    check_fail "Classroom config still uses a default development secret"
  else
    check_pass "Classroom secret appears to be replaced"
  fi

  if grep -q 'debug: true' "$CLASSROOM_CONFIG"; then
    check_fail "Classroom debug mode is enabled"
  else
    check_pass "Classroom debug mode is disabled"
  fi

  if grep -Eq '^[[:space:]]*- "[*]"$|allowed_origins:[[:space:]]*\[[[:space:]]*"[*]"' "$CLASSROOM_CONFIG"; then
    check_fail "Wildcard CORS is enabled in classroom config"
  else
    check_pass "Wildcard CORS is not enabled in classroom config"
  fi
fi

if command -v ufw >/dev/null 2>&1; then
  UFW_3000="$(ufw status 2>/dev/null | grep -E '3000/tcp' || true)"
  UFW_8000="$(ufw status 2>/dev/null | grep -E '8000/tcp' || true)"
  UFW_11434="$(ufw status 2>/dev/null | grep -E '11434/tcp' || true)"
  if [[ -z "$UFW_3000$UFW_8000$UFW_11434" ]]; then
    check_pass "UFW does not allow inbound 3000, 8000, or 11434"
  else
    check_fail "UFW allows one or more application ports: ${UFW_3000} ${UFW_8000} ${UFW_11434}"
  fi
else
  warn "ufw not installed (skipped UFW checks)"
fi

echo ""
echo "Security check summary: ${PASS} passed, ${FAIL_COUNT} failed"
echo ""

if (( FAIL_COUNT > 0 )); then
  exit 1
fi
