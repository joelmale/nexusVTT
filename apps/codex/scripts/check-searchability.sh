#!/bin/bash

set -euo pipefail

API_URL="${API_URL:-http://localhost:3000}"
DOC_ID="${1:-}"
QUERY="${2:-}"

if [[ -z "$DOC_ID" || -z "$QUERY" ]]; then
  echo "Usage: $0 <document-id> <query>"
  echo "Example: $0 123e4567-e89b-12d3-a456-426614174000 fireball"
  exit 1
fi

echo "Checking searchability for document: $DOC_ID"
curl -s "${API_URL}/api/admin/processing/search-check/${DOC_ID}?q=$(printf %s "$QUERY" | jq -sRr @uri)" | jq .
