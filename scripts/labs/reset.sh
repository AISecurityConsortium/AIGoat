#!/bin/sh
# Clear lab memory, completion, and the halt flag. Usage: reset.sh <lab_id>
set -eu
API="${AIGOAT_API:-http://localhost:8001}"
TOKEN="${AIGOAT_TOKEN:?set AIGOAT_TOKEN to a bearer token}"
LAB="${1:?lab id required}"
curl -sS -X POST "$API/api/labs/$LAB/reset" \
  -H "Authorization: Bearer $TOKEN"
echo
