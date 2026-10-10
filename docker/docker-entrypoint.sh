#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# AI Goat -- Docker Entrypoint (Backend)
#
# 1. Ensures the configured Ollama model is available (pulls
#    only on first run; skips if already present).
# 2. Initializes the database and seeds demo data.
# 3. Starts the FastAPI backend with uvicorn.
# ──────────────────────────────────────────────────────────────
set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }

OLLAMA_URL="${OLLAMA_BASE_URL:-http://ollama:11434}"

echo ""
echo "=========================================="
echo "   AI Goat -- Docker Backend Starting     "
echo "=========================================="
echo ""

# ── Step 1: Ensure Ollama model is available ──────────────────
MODEL=$(python -c "
from app.core.config import load_config
print(load_config().ollama.model)
" 2>/dev/null || echo "mistral")

info "Checking if model '$MODEL' is available in Ollama..."

MODEL_EXISTS=$(python -c "
import httpx, sys
try:
    r = httpx.get('${OLLAMA_URL}/api/tags', timeout=10)
    names = [m.get('name','') for m in r.json().get('models', [])]
    exists = any('${MODEL}' in n for n in names)
    print('yes' if exists else 'no')
except Exception as e:
    print(f'Warning: could not reach Ollama: {e}', file=sys.stderr)
    print('no')
" || echo "no")

if [ "$MODEL_EXISTS" = "yes" ]; then
    ok "Model '$MODEL' already available -- skipping pull"
else
    info "Model '$MODEL' not found -- pulling (this may take several minutes on first run)..."
    python -c "
import httpx, json, sys
r = httpx.post(
    '${OLLAMA_URL}/api/pull',
    json={'name': '${MODEL}', 'stream': False},
    timeout=None,
)
if r.status_code == 200:
    print('Pull completed successfully')
else:
    print(f'Pull failed: {r.status_code} {r.text}', file=sys.stderr)
    sys.exit(1)
"
    ok "Model '$MODEL' pulled successfully"
fi

# ── Step 2: Database initialization ───────────────────────────
info "Applying database migrations..."
DB_FILE="${DB_FILE:-/app/data/aigoat.db}"
if [ -f "$DB_FILE" ]; then
    # 0001 matches the pre-Alembic schema. Stamp that revision, then upgrade, so later
    # migrations still run. Stamping head would mark them applied without running them.
    DB_STATE=$(python -c "
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
        python -m alembic stamp 0001
    fi
fi
python -m alembic upgrade head
ok "Database schema ready"

# ── Step 3: Seed data (idempotent) ────────────────────────────
info "Checking seed data..."
NEEDS_SEED=$(python -c "
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
" 2>/dev/null || echo "yes")

if [ "$NEEDS_SEED" = "yes" ]; then
    info "Seeding demo data (users, products, challenges, knowledge base)..."
    python -m scripts.seed
    ok "Demo data seeded"
else
    ok "Database already has required data"
fi

info "Syncing support tickets..."
python -m scripts.seed --sync-support
ok "Support tickets ready"

# Refresh challenge title/description/owasp_ref/hints/etc. from CHALLENGE_DEFINITIONS
# without wiping ChallengeAttempt (full seed deletes attempts; this sync does not).
info "Syncing challenge metadata..."
python -m scripts.seed --sync-challenges
ok "Challenge metadata synced"

# ── Step 4: Start backend ─────────────────────────────────────
info "Starting uvicorn on 0.0.0.0:${BACKEND_PORT:-8000}..."
exec python -m uvicorn app.main:app \
    --host 0.0.0.0 \
    --port "${BACKEND_PORT:-8000}" \
    --log-level info
