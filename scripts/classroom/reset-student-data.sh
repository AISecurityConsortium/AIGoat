#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/common.sh"

YES=false
if [[ "${1:-}" == "--yes" ]]; then
  YES=true
fi

cat <<'EOF'

This script removes classroom student progress data only:

  - SQLite database in the Docker db_data volume (users, orders, challenge progress, etc.)
  - ChromaDB vector data in the same volume (/app/data/chroma_db)

It will NOT remove:

  - Host Ollama model weights (e.g. C:\\Users\\zawhe\\.ollama\\models)
  - Classroom configuration files
  - Generated secrets in docker/config.classroom.yml

EOF

if [[ "$YES" != true ]]; then
  read -r -p "Type RESET to continue: " CONFIRM
  if [[ "$CONFIRM" != "RESET" ]]; then
    fail "Aborted"
  fi
fi

if ! docker info >/dev/null 2>&1; then
  fail "Docker daemon is not running"
fi

info "Stopping classroom backend to release database volume"
compose stop backend frontend 2>/dev/null || compose stop backend

DB_VOLUME="aigoat_db_data"
if docker volume inspect "$DB_VOLUME" >/dev/null 2>&1; then
  info "Removing student data volume: $DB_VOLUME"
  docker volume rm "$DB_VOLUME"
  ok "Removed $DB_VOLUME"
else
  warn "Volume $DB_VOLUME not found; nothing to remove"
fi

info "Restarting classroom backend"
compose up -d backend
wait_for_url "http://127.0.0.1:8000/api/products/" "Backend after reset" 40 3

ok "Student data reset complete. Host Ollama models were preserved."
