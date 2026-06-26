#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/common.sh"

echo ""
echo "=========================================="
echo "  AIGoat Classroom -- Configure UFW"
echo "=========================================="
echo ""

if ! command -v ufw >/dev/null 2>&1; then
  fail "ufw is not installed. Install with: sudo apt install ufw"
fi

warn "This script will configure UFW to deny incoming traffic by default."
warn "Docker protection relies primarily on localhost-only port bindings."
echo ""

if command -v ss >/dev/null 2>&1 && ss -tlnH | grep -q ':22'; then
  warn "SSH appears to be active on this machine."
  warn "OpenSSH will be allowed before UFW is enabled."
else
  warn "SSH was not detected on port 22. Verify remote access before enabling UFW."
fi

read -r -p "Continue with UFW configuration? Type YES: " CONFIRM
if [[ "$CONFIRM" != "YES" ]]; then
  fail "Aborted"
fi

sudo ufw default deny incoming
sudo ufw default allow outgoing

if command -v ss >/dev/null 2>&1 && ss -tlnH | grep -q ':22'; then
  sudo ufw allow OpenSSH
  ok "Allowed OpenSSH"
fi

for port in 3000 8000 11434; do
  if sudo ufw status | grep -q "${port}/tcp"; then
    warn "Removing existing UFW rule for ${port}/tcp"
    sudo ufw delete allow "${port}/tcp" || true
  fi
done

warn "Enabling UFW now"
sudo ufw --force enable
sudo ufw status verbose

ok "UFW configured"
