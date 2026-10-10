#!/bin/sh
# Cancel this user's runs and block new ones until reset. Usage: halt.sh <lab_id>
set -eu
API="${AIGOAT_API:-http://localhost:8001}"
TOKEN="${AIGOAT_TOKEN:?set AIGOAT_TOKEN to a bearer token}"
LAB="${1:?lab id required}"
curl -sS -X POST "$API/api/labs/$LAB/halt" \
  -H "Authorization: Bearer $TOKEN"
echo
