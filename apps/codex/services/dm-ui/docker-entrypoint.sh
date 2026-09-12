#!/bin/sh
set -eu

DOC_API_URL="${VITE_DOC_API_URL:-${DOC_API_URL:-}}"
WEBSOCKET_URL="${VITE_WEBSOCKET_URL:-${WEBSOCKET_URL:-}}"

cat > /usr/share/nginx/html/config.js <<EOF
window.__NEXUSCODEX_CONFIG__ = {
  DOC_API_URL: "${DOC_API_URL}",
  WEBSOCKET_URL: "${WEBSOCKET_URL}"
};
EOF

exec nginx -g "daemon off;"
