#!/bin/sh
# Start a lab session. Usage: setup.sh <lab_id>
set -eu
API="${AIGOAT_API:-http://localhost:8001}"
TOKEN="${AIGOAT_TOKEN:?set AIGOAT_TOKEN to a bearer token}"
LAB="${1:?lab id required}"
if [ "$LAB" = "asi05-1" ] && command -v docker >/dev/null 2>&1; then
  # the ASI05 sink executes inside this image
  docker image inspect alpine:3.20 >/dev/null 2>&1 || docker pull alpine:3.20
fi
curl -sS -X POST "$API/api/labs/$LAB/start" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
echo
