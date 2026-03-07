#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# AI Goat -- Application Stop Script
#
# Stops all processes that were started by start.sh.
# Uses PID files stored in .pids/ to identify processes.
#
# Usage:  ./scripts/stop.sh            (stop all services)
#         ./scripts/stop.sh --clean    (stop + delete database for fresh start)
# ──────────────────────────────────────────────────────────────
set -uo pipefail

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

echo ""
echo "=========================================="
echo "       AI Goat -- Stopping Application    "
echo "=========================================="
echo ""

stop_process() {
    local name="$1"
    local pid_file="$PID_DIR/${name}.pid"

    if [ -f "$pid_file" ]; then
        local pid
        pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            info "Stopping $name (PID: $pid)..."
            kill "$pid" 2>/dev/null
            # Wait up to 5 seconds for graceful shutdown
            for i in $(seq 1 10); do
                if ! kill -0 "$pid" 2>/dev/null; then
                    break
                fi
                sleep 0.5
            done
            # Force kill if still running
            if kill -0 "$pid" 2>/dev/null; then
                warn "$name did not stop gracefully, force killing..."
                kill -9 "$pid" 2>/dev/null || true
            fi
            ok "$name stopped"
        else
            info "$name (PID: $pid) is not running"
        fi
        rm -f "$pid_file"
    else
        info "No PID file for $name"
    fi
}

# ── Stop frontend ──────────────────────────────────────────────
stop_process "frontend"

# Also kill anything on the frontend port (npm spawns child processes)
if lsof -ti:"$FRONTEND_PORT" >/dev/null 2>&1; then
    info "Cleaning up remaining processes on port $FRONTEND_PORT..."
    lsof -ti:"$FRONTEND_PORT" | xargs kill -9 2>/dev/null || true
    ok "Port $FRONTEND_PORT cleared"
fi

# ── Stop backend ───────────────────────────────────────────────
stop_process "backend"

if lsof -ti:"$BACKEND_PORT" >/dev/null 2>&1; then
    info "Cleaning up remaining processes on port $BACKEND_PORT..."
    lsof -ti:"$BACKEND_PORT" | xargs kill -9 2>/dev/null || true
    ok "Port $BACKEND_PORT cleared"
fi

# ── Stop Ollama (only if we started it) ────────────────────────
stop_process "ollama"

# ── Handle --clean flag ────────────────────────────────────────
if [[ "${1:-}" == "--clean" ]]; then
    echo ""
    info "Cleaning database and vector store..."
    rm -f "$DB_FILE"
    rm -rf "$CHROMA_DIR"
    rm -rf "$PROJECT_ROOT/logs"
    ok "Removed: aigoat.db, chroma_db/, logs/"
    echo ""
    echo -e "  ${CYAN}To start fresh:${NC}  ./scripts/start.sh"
fi

# ── Cleanup PID directory ──────────────────────────────────────
rm -rf "$PID_DIR"

echo ""
ok "AI Goat stopped."
echo ""
