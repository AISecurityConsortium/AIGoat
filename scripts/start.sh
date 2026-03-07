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

echo ""
echo "=========================================="
echo "       AI Goat -- Starting Application    "
echo "=========================================="
echo ""

# ── Ensure logs directory exists early (Ollama log needs it) ───
mkdir -p "$PROJECT_ROOT/logs"

# ── Step 1: Ollama ─────────────────────────────────────────────
info "Checking Ollama..."

if command -v ollama >/dev/null 2>&1; then
    if ! pgrep -x "ollama" >/dev/null 2>&1 && ! curl -sf http://localhost:11434/api/tags >/dev/null 2>&1; then
        info "Starting Ollama in the background..."
        ollama serve > "$PROJECT_ROOT/logs/ollama.log" 2>&1 &
        echo $! > "$PID_DIR/ollama.pid"
        sleep 3
    fi

    if curl -sf http://localhost:11434/api/tags >/dev/null 2>&1; then
        ok "Ollama is running"

        MODEL=$(python3 -c "
import yaml
with open('$PROJECT_ROOT/config/config.yml') as f:
    print(yaml.safe_load(f).get('ollama',{}).get('model','mistral'))
" 2>/dev/null || echo "mistral")

        AVAILABLE=$(curl -sf http://localhost:11434/api/tags | python3 -c "
import sys, json
tags = json.load(sys.stdin).get('models', [])
names = [t.get('name','') for t in tags]
print('yes' if any('$MODEL' in n for n in names) else 'no')
" 2>/dev/null || echo "no")

        if [ "$AVAILABLE" = "yes" ]; then
            ok "Model '$MODEL' is available"
        else
            info "Pulling model '$MODEL' (this may take a few minutes on first run)..."
            ollama pull "$MODEL"
            ok "Model '$MODEL' pulled successfully"
        fi
    else
        warn "Ollama did not start. AI chat features will be unavailable."
    fi
else
    warn "Ollama is not installed. AI chat features will be unavailable."
    warn "Install from: https://ollama.ai"
fi

# ── Step 2: Python virtual environment ─────────────────────────
cd "$PROJECT_ROOT"

if [ ! -d "venv" ]; then
    info "Creating Python virtual environment..."
    python3 -m venv venv
    ok "Virtual environment created"
fi

source venv/bin/activate

info "Checking Python dependencies..."
pip install -q -r requirements.txt 2>/dev/null
ok "Python dependencies ready"

# ── Step 3: Database initialization ────────────────────────────
info "Initializing database..."
python3 -c "
import asyncio
from app.core.database import init_db
asyncio.run(init_db())
" 2>/dev/null
ok "Database schema ready"

# ── Step 4: Seed data (idempotent) ─────────────────────────────
info "Checking seed data..."

NEEDS_SEED=$(python3 -c "
import asyncio
from app.core.database import async_session, init_db
from sqlalchemy import select, func
from app.models import User, Product, Challenge

async def check():
    await init_db()
    async with async_session() as db:
        users = (await db.execute(select(func.count(User.id)))).scalar() or 0
        products = (await db.execute(select(func.count(Product.id)))).scalar() or 0
        challenges = (await db.execute(select(func.count(Challenge.id)))).scalar() or 0
        if users < 5 or products < 20 or challenges < 9:
            print('yes')
        else:
            print('no')
asyncio.run(check())
" 2>/dev/null || echo "yes")

if [ "$NEEDS_SEED" = "yes" ]; then
    info "Seeding demo data (users, products, challenges, knowledge base)..."
    python3 -m scripts.seed 2>/dev/null
    ok "Demo data seeded"
else
    ok "Database already has required data"
fi

# ── Step 5: Start backend ──────────────────────────────────────
if lsof -ti:"$BACKEND_PORT" >/dev/null 2>&1; then
    warn "Port $BACKEND_PORT is already in use -- skipping backend start"
else
    info "Starting backend on port $BACKEND_PORT..."
    python3 -m uvicorn app.main:app \
        --host 0.0.0.0 \
        --port "$BACKEND_PORT" \
        --log-level info \
        > "$PROJECT_ROOT/logs/backend.log" 2>&1 &
    BACKEND_PID=$!
    echo "$BACKEND_PID" > "$PID_DIR/backend.pid"
    sleep 2

    if kill -0 "$BACKEND_PID" 2>/dev/null; then
        ok "Backend started (PID: $BACKEND_PID)"
    else
        fail "Backend failed to start. Check logs/backend.log"
    fi
fi

# ── Step 7: Start frontend ────────────────────────────────────
if lsof -ti:"$FRONTEND_PORT" >/dev/null 2>&1; then
    warn "Port $FRONTEND_PORT is already in use -- skipping frontend start"
else
    info "Starting frontend on port $FRONTEND_PORT..."
    cd "$PROJECT_ROOT/frontend"

    if [ ! -d "node_modules" ]; then
        info "Installing frontend dependencies (first run)..."
        npm install --silent 2>/dev/null
        ok "Frontend dependencies installed"
    fi

    PORT="$FRONTEND_PORT" BROWSER=none npm start \
        > "$PROJECT_ROOT/logs/frontend.log" 2>&1 &
    FRONTEND_PID=$!
    echo "$FRONTEND_PID" > "$PID_DIR/frontend.pid"
    cd "$PROJECT_ROOT"
    sleep 3

    if kill -0 "$FRONTEND_PID" 2>/dev/null; then
        ok "Frontend started (PID: $FRONTEND_PID)"
    else
        fail "Frontend failed to start. Check logs/frontend.log"
    fi
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
