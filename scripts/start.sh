#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# AI Goat -- Application Startup Script
#
# Starts Ollama (if not running), pulls the model, initializes
# the database, seeds required data, then launches the backend
# and frontend as background processes.
#
# Usage:  ./scripts/start.sh          (from the AIGoat root)
#         ./scripts/start.sh --fresh   (delete DB before start)
# ──────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PID_DIR="$PROJECT_ROOT/.pids"
DB_FILE="$PROJECT_ROOT/aigoat.db"
CHROMA_DIR="$PROJECT_ROOT/chroma_db"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
fail()  { echo -e "${RED}[FAIL]${NC}  $*"; exit 1; }

# Wait until a local URL answers. Used after a process start, because a live PID is not a ready app.
wait_for_url() {
    local url="$1" label="$2" logfile="$3" tries="${4:-45}"
    local i
    for ((i = 1; i <= tries; i++)); do
        if curl -sf -o /dev/null --max-time 2 "$url"; then
            return 0
        fi
        sleep 1
    done
    echo ""
    warn "Last lines of $logfile:"
    tail -n 40 "$logfile" 2>/dev/null || true
    fail "$label did not answer at $url"
}

# ── Handle --fresh flag ────────────────────────────────────────
if [[ "${1:-}" == "--fresh" ]]; then
    info "Fresh start requested -- removing existing database and vector store"
    rm -f "$DB_FILE"
    rm -rf "$CHROMA_DIR"
    ok "Cleared database and ChromaDB"
fi

# ── PID directory ──────────────────────────────────────────────
mkdir -p "$PID_DIR"

# ── Pre-flight: check dependencies ────────────────────────────
command -v python3 >/dev/null 2>&1 || fail "python3 is not installed"
command -v node    >/dev/null 2>&1 || fail "node is not installed"
command -v npm     >/dev/null 2>&1 || fail "npm is not installed"
command -v curl    >/dev/null 2>&1 || fail "curl is not installed"
command -v lsof    >/dev/null 2>&1 || fail "lsof is not installed (needed to see whether ports $BACKEND_PORT and $FRONTEND_PORT are free)"

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 18 ]; then
    fail "Node.js 18 or newer is required (found $(node -v)). The frontend does not start on older Node."
fi

[ -f "$PROJECT_ROOT/config/config.yml" ] || fail "config/config.yml is missing. The backend cannot start without it."

echo ""
echo "=========================================="
echo "       AI Goat -- Starting Application    "
echo "=========================================="
echo ""

# ── Ensure logs directory exists early (Ollama log needs it) ───
mkdir -p "$PROJECT_ROOT/logs"

# ── Step 1: Python virtual environment ─────────────────────────
# Built before the model check so the configured model name is read with the venv's PyYAML,
# not whatever python3 happens to be on PATH.
cd "$PROJECT_ROOT"

PYTHON_311="$(command -v python3.11 || true)"
if [ -z "$PYTHON_311" ] && [ -x "${HOME}/.local/bin/python3.11" ]; then
    PYTHON_311="${HOME}/.local/bin/python3.11"
fi

if [ ! -d "venv" ]; then
    if [ -z "$PYTHON_311" ]; then
        fail "Python 3.11 is required (CI pin / pyproject target-version). Install 3.11 and re-run. Do not bump target-version."
    fi
    info "Creating Python virtual environment with $PYTHON_311..."
    "$PYTHON_311" -m venv venv
    ok "Virtual environment created"
fi

# shellcheck disable=SC1091
source venv/bin/activate

VENV_PY=$(python3 -c 'import sys; print("%d.%d" % sys.version_info[:2])')
if [ "$VENV_PY" != "3.11" ]; then
    fail "venv is Python $VENV_PY; AIGoat pins 3.11 to match CI. Recreate with: rm -rf venv && ./scripts/start.sh"
fi
ok "Python $VENV_PY virtual environment"

info "Checking Python dependencies..."
python3 -m pip install -q -r requirements.txt
ok "Python dependencies ready"

# ── Step 2: Ollama ─────────────────────────────────────────────
info "Checking Ollama..."

if command -v ollama >/dev/null 2>&1; then
    if ! pgrep -x "ollama" >/dev/null 2>&1 && ! curl -sf http://localhost:11434/api/tags >/dev/null 2>&1; then
        info "Starting Ollama in the background..."
        nohup ollama serve > "$PROJECT_ROOT/logs/ollama.log" 2>&1 &
        echo $! > "$PID_DIR/ollama.pid"
        disown $! 2>/dev/null || true
        sleep 3
    fi

    if curl -sf http://localhost:11434/api/tags >/dev/null 2>&1; then
        ok "Ollama is running"

        MODEL=$(python3 -c "
import yaml
with open('$PROJECT_ROOT/config/config.yml') as f:
    cfg = yaml.safe_load(f) or {}
print((cfg.get('ollama') or {}).get('model') or 'mistral')
")
        AGENT_MODEL=$(python3 -c "
import yaml
with open('$PROJECT_ROOT/config/config.yml') as f:
    cfg = yaml.safe_load(f) or {}
value = (cfg.get('ollama') or {}).get('agent_model')
print('' if not value else value)
")

        model_present() {
            curl -sf http://localhost:11434/api/tags | python3 -c "
import sys, json
names = [t.get('name', '') for t in json.load(sys.stdin).get('models', [])]
print('yes' if any('$1' in n for n in names) else 'no')
" 2>/dev/null || echo "no"
        }

        if [ "$(model_present "$MODEL")" = "yes" ]; then
            ok "Model '$MODEL' is available"
        else
            info "Pulling model '$MODEL' (this may take a few minutes on first run)..."
            ollama pull "$MODEL"
            ok "Model '$MODEL' pulled successfully"
        fi

        # The agent, MCP host, and kill chain labs need a model with native tool calls. Mistral has none.
        # The configured agent_model wins; otherwise check the recommended one. Pulling it is about 6.6 GB,
        # so it only happens when asked: AIGOAT_PULL_AGENT_MODEL=1 ./scripts/start.sh
        TOOL_MODEL="${AGENT_MODEL:-${AIGOAT_RECOMMENDED_AGENT_MODEL:-qwen3.5:9b}}"
        if [ "$(model_present "$TOOL_MODEL")" = "yes" ]; then
            if [ -n "$AGENT_MODEL" ]; then
                ok "Tool-calling model '$TOOL_MODEL' is available (ollama.agent_model)"
            else
                ok "Tool-calling model '$TOOL_MODEL' is installed. Pick it in the kill chain and agent model dropdowns, or set ollama.agent_model in config/config.yml"
            fi
        elif [ "${AIGOAT_PULL_AGENT_MODEL:-0}" = "1" ]; then
            info "Pulling tool-calling model '$TOOL_MODEL' (about 6.6 GB for the default)..."
            ollama pull "$TOOL_MODEL"
            ok "Model '$TOOL_MODEL' pulled successfully"
        else
            warn "Tool-calling model '$TOOL_MODEL' is not installed. The agent, MCP host, and kill chain labs make no tool calls with '$MODEL'."
            warn "Install it with: ollama pull $TOOL_MODEL   (or rerun with AIGOAT_PULL_AGENT_MODEL=1 ./scripts/start.sh)"
        fi
    else
        warn "Ollama did not start. AI chat features will be unavailable."
    fi
else
    warn "Ollama is not installed. AI chat features will be unavailable."
    warn "Install from: https://ollama.ai"
fi

# ── Step 3: Database initialization ────────────────────────────
info "Applying database migrations..."
if [ -f "$DB_FILE" ]; then
    # 0001 matches the pre-Alembic schema. Stamp that revision, then upgrade, so later
    # migrations still run. Stamping head would mark them applied without running them.
    DB_STATE=$(python3 -c "
import sqlite3
try:
    names = {row[0] for row in sqlite3.connect('$DB_FILE').execute(\"SELECT name FROM sqlite_master WHERE type='table'\")}
except Exception:
    names = set()
if 'alembic_version' in names:
    print('current')
elif 'users' in names:
    print('baseline')
else:
    print('empty')
")
    if [ "$DB_STATE" = "baseline" ]; then
        info "Pre-Alembic database detected. Stamping revision 0001, then applying later migrations. Data is kept."
        python3 -m alembic stamp 0001
    fi
fi
python3 -m alembic upgrade head
ok "Database schema ready"

# ── Step 4: Seed data (idempotent) ─────────────────────────────
info "Checking seed data..."

NEEDS_SEED=$(python3 -c "
import asyncio
from app.core.database import async_session, init_db
from sqlalchemy import select, func
from app.models import User, Product

async def check():
    await init_db()
    async with async_session() as db:
        users = (await db.execute(select(func.count(User.id)))).scalar() or 0
        products = (await db.execute(select(func.count(Product.id)))).scalar() or 0
        if users < 5 or products < 20:
            print('yes')
        else:
            print('no')
asyncio.run(check())
" || echo "yes")

if [ "$NEEDS_SEED" = "yes" ]; then
    info "Seeding demo data (users, products, challenges, knowledge base)..."
    python3 -m scripts.seed
    ok "Demo data seeded"
else
    ok "Database already has required data"
fi

# Demo inbox is idempotent, so a normal start and --fresh both end with the same tickets.
info "Syncing support tickets..."
python3 -m scripts.seed --sync-support
ok "Support tickets ready"

# Refresh challenge title/description/owasp_ref/hints/etc. from CHALLENGE_DEFINITIONS
# without wiping ChallengeAttempt (full seed deletes attempts; this sync does not).
info "Syncing challenge metadata..."
python3 -m scripts.seed --sync-challenges
ok "Challenge metadata synced"

# ── Step 5: Start backend ──────────────────────────────────────
if lsof -ti:"$BACKEND_PORT" >/dev/null 2>&1; then
    if curl -sf -o /dev/null --max-time 2 "http://127.0.0.1:$BACKEND_PORT/docs"; then
        warn "Port $BACKEND_PORT is already in use and the API is answering. Leaving it running."
    else
        fail "Port $BACKEND_PORT is in use, but http://127.0.0.1:$BACKEND_PORT/docs did not answer. Stop that process, then run this script again."
    fi
else
    info "Starting backend on port $BACKEND_PORT..."
    nohup python3 -m uvicorn app.main:app \
        --host 0.0.0.0 \
        --port "$BACKEND_PORT" \
        --log-level info \
        > "$PROJECT_ROOT/logs/backend.log" 2>&1 &
    BACKEND_PID=$!
    echo "$BACKEND_PID" > "$PID_DIR/backend.pid"
    disown "$BACKEND_PID" 2>/dev/null || true
    wait_for_url "http://127.0.0.1:$BACKEND_PORT/docs" "Backend" "$PROJECT_ROOT/logs/backend.log" 45
    ok "Backend ready (PID: $BACKEND_PID)"
fi

# ── Step 6: Start frontend ────────────────────────────────────
if lsof -ti:"$FRONTEND_PORT" >/dev/null 2>&1; then
    if curl -sf -o /dev/null --max-time 2 "http://127.0.0.1:$FRONTEND_PORT/"; then
        warn "Port $FRONTEND_PORT is already in use and the app is answering. Leaving it running."
    else
        fail "Port $FRONTEND_PORT is in use, but http://127.0.0.1:$FRONTEND_PORT/ did not answer. Stop that process, then run this script again."
    fi
else
    info "Starting frontend on port $FRONTEND_PORT..."
    cd "$PROJECT_ROOT/frontend"

    if [ ! -d "node_modules" ]; then
        info "Installing frontend dependencies (first run)..."
        npm install --silent
        ok "Frontend dependencies installed"
    fi

    PORT="$FRONTEND_PORT" BROWSER=none nohup npm start \
        > "$PROJECT_ROOT/logs/frontend.log" 2>&1 &
    FRONTEND_PID=$!
    echo "$FRONTEND_PID" > "$PID_DIR/frontend.pid"
    disown "$FRONTEND_PID" 2>/dev/null || true
    cd "$PROJECT_ROOT"
    wait_for_url "http://127.0.0.1:$FRONTEND_PORT/" "Frontend" "$PROJECT_ROOT/logs/frontend.log" 90
    ok "Frontend ready (PID: $FRONTEND_PID)"
fi

# ── Done ──────────────────────────────────────────────────────
echo ""
echo "=========================================="
echo "       AI Goat is running!                "
echo "=========================================="
echo ""
echo -e "  ${CYAN}Application:${NC}  http://localhost:$FRONTEND_PORT"
echo -e "  ${CYAN}API:${NC}          http://localhost:$BACKEND_PORT"
echo -e "  ${CYAN}API Docs:${NC}     http://localhost:$BACKEND_PORT/docs"
echo ""
echo -e "  ${CYAN}Demo login:${NC}   alice / password123"
echo -e "  ${CYAN}Admin login:${NC}  admin / admin123"
echo ""
echo -e "  ${CYAN}Logs:${NC}         logs/backend.log, logs/frontend.log"
echo -e "  ${CYAN}Stop:${NC}         ./scripts/stop.sh"
echo -e "  ${CYAN}Fresh start:${NC}  ./scripts/stop.sh --clean && ./scripts/start.sh"
echo ""
