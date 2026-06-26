#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/common.sh"

usage() {
  cat <<'EOF'
Add a Vercel preview origin to the classroom backend CORS list.

Usage:
  ./scripts/classroom/set-vercel-origin.sh https://preview-name.vercel.app
EOF
}

PREVIEW_URL="${1:-}"
if [[ -z "$PREVIEW_URL" || "$PREVIEW_URL" == "-h" || "$PREVIEW_URL" == "--help" ]]; then
  usage
  exit 0
fi

if [[ "$PREVIEW_URL" != https://* ]]; then
  fail "Preview URL must begin with https://"
fi

PREVIEW_URL="${PREVIEW_URL%/}"

if [[ ! -f "$CLASSROOM_CONFIG" ]]; then
  fail "Missing classroom config: $CLASSROOM_CONFIG"
fi

if python3 -c "import yaml" 2>/dev/null; then
  python3 - <<PY
import yaml
from pathlib import Path

path = Path("$CLASSROOM_CONFIG")
data = yaml.safe_load(path.read_text())
origins = data.setdefault("app", {}).setdefault("allowed_origins", [])
defaults = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
for origin in defaults:
    if origin not in origins:
        origins.append(origin)
preview = "$PREVIEW_URL"
if preview not in origins:
    origins.append(preview)
path.write_text(yaml.safe_dump(data, sort_keys=False, default_flow_style=False))
print("Updated allowed origins:")
for origin in origins:
    print(f"  - {origin}")
PY
else
  update_allowed_origins "$PREVIEW_URL"
fi

if "$(docker_cmd)" info >/dev/null 2>&1; then
  if compose ps --status running backend 2>/dev/null | grep -q backend; then
    info "Restarting backend to apply CORS changes"
    compose restart backend
    wait_for_url "http://127.0.0.1:8000/api/products/" "Backend after CORS update" 20 2
  else
    warn "Backend container is not running; CORS config updated on disk only"
  fi
else
  warn "Docker is not available; CORS config updated on disk only"
fi

ok "Classroom CORS configuration updated"
