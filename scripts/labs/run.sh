#!/bin/sh
# Send one goal. Usage: run.sh <lab_id> <level> <goal>
# Host labs (asi01-1, asi04-1) use the admin assistant. Other ASI labs use the shop agent.
set -eu
API="${AIGOAT_API:-http://localhost:8001}"
TOKEN="${AIGOAT_TOKEN:?set AIGOAT_TOKEN to a bearer token}"
LAB="${1:?lab id required}"
LEVEL="${2:?defense level 0, 1, or 2 required}"
GOAL="${3:?goal text required}"
BODY=$(python3 -c 'import json,sys; lab,level,goal,kind=sys.argv[1:]; level=int(level); print(json.dumps({"message":goal,"lab_id":lab,"defense_level":level} if kind=="host" else {"lab_id":lab,"goal":goal,"defense_level":level}))' "$LAB" "$LEVEL" "$GOAL" "$(case "$LAB" in asi01-1|asi04-1) echo host;; *) echo agent;; esac)")
case "$LAB" in
  asi01-1|asi04-1) URL="$API/api/mcp/host/turn" ;;
  *) URL="$API/api/agent/runs" ;;
esac
curl -sS -X POST "$URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$BODY"
echo
