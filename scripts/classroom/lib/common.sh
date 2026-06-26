#!/usr/bin/env bash
# Shared helpers for classroom deployment scripts.
set -euo pipefail

CLASSROOM_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLASSROOM_SCRIPT_DIR="$(cd "$CLASSROOM_LIB_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$CLASSROOM_SCRIPT_DIR/../.." && pwd)"
DOCKER_DIR="$PROJECT_ROOT/docker"
RUNTIME_DIR="$PROJECT_ROOT/.classroom-runtime"
CLASSROOM_ENV_FILE="$PROJECT_ROOT/.classroom.env"
CLASSROOM_CONFIG="$DOCKER_DIR/config.classroom.yml"
COMPOSE_BASE="$DOCKER_DIR/docker-compose.yml"
COMPOSE_CLASSROOM="$DOCKER_DIR/docker-compose.classroom.yml"
CLASSROOM_OLLAMA_URL="${CLASSROOM_OLLAMA_URL:-http://127.0.0.1:11434}"
CLASSROOM_OLLAMA_MODEL="${CLASSROOM_OLLAMA_MODEL:-tinyllama}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
fail()  { echo -e "${RED}[FAIL]${NC}  $*"; exit 1; }

require_cmd() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || fail "Required command not found: $cmd"
}

require_python_yaml() {
  if python3 -c "import yaml" 2>/dev/null; then
    return 0
  fi
  warn "python3-yaml not installed; using line-based YAML updates"
}

update_allowed_origins() {
  local preview_url="$1"
  python3 - <<PY
from pathlib import Path

path = Path("$CLASSROOM_CONFIG")
lines = path.read_text().splitlines()
defaults = ["http://localhost:3000", "http://127.0.0.1:3000", "$preview_url"]
origins = []
in_block = False
out = []
for line in lines:
    if line.startswith("  allowed_origins:"):
        in_block = True
        out.append(line)
        continue
    if in_block:
        if line.startswith("    - "):
            origins.append(line.split('"')[1])
            continue
        in_block = False
    out.append(line)

for origin in defaults:
    if origin not in origins:
        origins.append(origin)

rebuilt = []
inserted = False
for line in out:
    rebuilt.append(line)
    if line.startswith("  allowed_origins:") and not inserted:
        for origin in origins:
            rebuilt.append(f'    - "{origin}"')
        inserted = True

path.write_text("\n".join(rebuilt) + "\n")
print("Updated allowed origins:")
for origin in origins:
    print(f"  - {origin}")
PY
}

docker_cmd() {
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    echo "docker"
    return 0
  fi
  if [[ -x "/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe" ]]; then
    echo "/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe"
    return 0
  fi
  fail "Docker is not available. Start Docker Desktop and retry."
}

compose() {
  local docker_bin
  docker_bin="$(docker_cmd)"
  (cd "$DOCKER_DIR" && "$docker_bin" compose -f "$COMPOSE_BASE" -f "$COMPOSE_CLASSROOM" "$@")
}

load_classroom_env() {
  if [[ -f "$CLASSROOM_ENV_FILE" ]]; then
    # shellcheck disable=SC1090
    set -a
    source "$CLASSROOM_ENV_FILE"
    set +a
  fi
}

ensure_runtime_dir() {
  mkdir -p "$RUNTIME_DIR"
}

ensure_classroom_secret() {
  if [[ ! -f "$CLASSROOM_CONFIG" ]]; then
    fail "Missing classroom config: $CLASSROOM_CONFIG"
  fi

  if grep -q '__CLASSROOM_SETUP_GENERATED__' "$CLASSROOM_CONFIG"; then
    local secret
    secret="$(openssl rand -hex 32)"
    sed -i "s/__CLASSROOM_SETUP_GENERATED__/${secret}/" "$CLASSROOM_CONFIG"
    ok "Generated classroom secret key in docker/config.classroom.yml"
  fi
}

ensure_ollama_volume() {
  local docker_bin
  docker_bin="$(docker_cmd)"
  if ! "$docker_bin" volume inspect ollama_models >/dev/null 2>&1; then
    info "Creating external Docker volume: ollama_models"
    "$docker_bin" volume create ollama_models >/dev/null
    ok "Docker volume ollama_models created"
  fi
}

classroom_ollama_tags_json() {
  local timeout="${1:-5}"
  if curl -sf --max-time "$timeout" "${CLASSROOM_OLLAMA_URL}/api/tags" 2>/dev/null; then
    return 0
  fi
  # WSL2: host Ollama on Windows is not reachable at WSL 127.0.0.1:11434.
  local win_curl="/mnt/c/Windows/System32/curl.exe"
  if [[ -x "$win_curl" ]]; then
    "$win_curl" -sf --max-time "$timeout" "http://127.0.0.1:11434/api/tags" 2>/dev/null
    return $?
  fi
  return 1
}

classroom_ollama_reachable() {
  classroom_ollama_tags_json 3 >/dev/null 2>&1
}

wait_for_ollama() {
  local label="${1:-Host Ollama}"
  local attempts="${2:-30}"
  local delay="${3:-3}"
  local i

  for ((i = 1; i <= attempts; i++)); do
    if classroom_ollama_reachable; then
      ok "$label is reachable"
      return 0
    fi
    sleep "$delay"
  done
  fail "$label did not become reachable at ${CLASSROOM_OLLAMA_URL} (or Windows host Ollama)"
}

classroom_model_available() {
  local model="${1:-$CLASSROOM_OLLAMA_MODEL}"
  classroom_ollama_tags_json | python3 -c "
import json, sys
tags = json.load(sys.stdin).get('models', [])
names = [t.get('name', '') for t in tags]
print('yes' if any('${model}' in n for n in names) else 'no')
"
}

classroom_build_frontend() {
  (
    cd "$PROJECT_ROOT/frontend"
    local npm_bin
    npm_bin="$(command -v npm)"

    if [[ "$npm_bin" == /mnt/c/* ]]; then
      if [[ ! -d node_modules ]]; then
        fail "node_modules is missing and Windows npm cannot install from WSL paths. Install Linux npm, then run: (cd frontend && npm ci)"
      fi
      REACT_APP_API_URL='' node node_modules/react-scripts/bin/react-scripts.js build
    else
      if [[ ! -d node_modules ]]; then
        npm ci
      fi
      REACT_APP_API_URL='' npm run build
    fi
  )
}

wait_for_url() {
  local url="$1"
  local label="$2"
  local attempts="${3:-30}"
  local delay="${4:-2}"
  local i

  for ((i = 1; i <= attempts; i++)); do
    if curl -sf "$url" >/dev/null 2>&1; then
      ok "$label is reachable"
      return 0
    fi
    sleep "$delay"
  done
  fail "$label did not become reachable: $url"
}

ngrok_authenticated() {
  if ngrok config check >/dev/null 2>&1; then
    return 0
  fi
  if [[ -n "${NGROK_AUTHTOKEN:-}" ]]; then
    return 0
  fi
  return 1
}

ngrok_auth_args() {
  if ngrok config check >/dev/null 2>&1; then
    return 0
  fi
  if [[ -n "${NGROK_AUTHTOKEN:-}" ]]; then
    printf '%s' "--authtoken=${NGROK_AUTHTOKEN}"
  fi
}

ngrok_domain_flag() {
  require_cmd ngrok
  if ngrok http --help 2>&1 | grep -q -- '--url'; then
    echo '--url'
    return 0
  fi
  if ngrok http --help 2>&1 | grep -q -- '--domain'; then
    echo '--domain'
    return 0
  fi
  fail "Could not determine ngrok reserved-domain flag. Run: ngrok http --help"
}

ngrok_public_url() {
  local domain="${1:-}"
  if [[ -n "$domain" ]]; then
    domain="${domain#https://}"
    domain="${domain%/}"
    echo "https://${domain}"
    return 0
  fi
  curl -sf http://127.0.0.1:4040/api/tunnels 2>/dev/null | python3 - <<'PY'
import json, sys
data = json.load(sys.stdin)
for t in data.get("tunnels", []):
    url = t.get("public_url", "")
    if url.startswith("https://"):
        print(url.rstrip("/"))
        break
PY
}

stop_existing_ngrok() {
  local pid_file="$RUNTIME_DIR/ngrok.pid"
  if [[ -f "$pid_file" ]]; then
    local pid
    pid="$(cat "$pid_file")"
    if kill -0 "$pid" 2>/dev/null; then
      info "Stopping existing ngrok process (PID: $pid)"
      kill "$pid" 2>/dev/null || true
      sleep 1
    fi
    rm -f "$pid_file"
  fi

  if pgrep -x ngrok >/dev/null 2>&1; then
    warn "Found stray ngrok process(es); stopping them"
    pkill -x ngrok 2>/dev/null || true
    sleep 1
  fi
}

validate_compose_localhost_only() {
  local rendered bad
  rendered="$(compose config 2>/dev/null)"
  bad="$(echo "$rendered" | awk '
    /- mode: ingress/ { block=$0; inport=1; next }
    inport {
      block=block "\n" $0
      if (/published: "(3000|8000|11434)"/) {
        if (block !~ /host_ip: 127\.0\.0\.1/) {
          print block
        }
        inport=0
        block=""
      }
    }
  ')"
  if [[ -n "$bad" ]]; then
    fail "Compose config publishes application ports without 127.0.0.1 host binding"
  fi
  ok "Compose ports are localhost-only for 3000, 8000, and 11434"
}
