#!/bin/sh
# Start a lab session. Usage: setup.sh <lab_id>
set -eu
API="${AIGOAT_API:-http://localhost:8001}"
TOKEN="${AIGOAT_TOKEN:?set AIGOAT_TOKEN to a bearer token}"
LAB="${1:?lab id required}"
curl -sS -X POST "$API/api/labs/$LAB/start" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
echo
