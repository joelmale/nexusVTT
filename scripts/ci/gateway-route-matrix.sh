#!/usr/bin/env bash
#
# Live route matrix for the unified frontend gateway (apps/vtt/docker/nginx.conf).
#
# Runs the real gateway config in the nginx image that frontend.Dockerfile's
# production stage uses, next to stub upstreams (backend, doc-api,
# asset-server, doc-websocket) that report which upstream a request reached.
# It then replays requests against both listeners:
#
#   :80    public gateway -- Phase 0 admin denials (with path, encoding, case,
#          `;` and method variations), the authenticated /codex-api read
#          allowlist, and Host-header variants that must never reach the
#          private listener's content.
#   :8081  private admin listener (Phase 1) -- only the placeholder, its
#          stylesheet and /healthz; everything else 404/405; strict headers on
#          every response; no upstream is ever contacted.
#
# See apps/docs/platform/private-admin-control-plane.md. Requires Docker only;
# requests are sent from a client container on the same private network, so no
# host port is published.
#
# Usage: scripts/ci/gateway-route-matrix.sh
#   GATEWAY_IMAGE=nginx:1.x-alpine  override the image (default: the
#                                   frontend.Dockerfile production base image)

set -euo pipefail

# Git Bash on Windows would otherwise rewrite container paths such as
# `gw:/etc/nginx/nginx.conf`. Host paths below are always repo-relative.
export MSYS_NO_PATHCONV=1

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$repo_root"

docker_dir=apps/vtt/docker
image=${GATEWAY_IMAGE:-$(awk 'toupper($1) == "FROM" && toupper($3) == "AS" && $4 == "production" { print $2 }' "$docker_dir/frontend.Dockerfile")}
if [[ -z "$image" ]]; then
  echo "could not determine the production base image from $docker_dir/frontend.Dockerfile" >&2
  exit 1
fi

run_id="gateway-matrix-$$-$RANDOM"
network="$run_id"
gateway="$run_id-gateway"
stub="$run_id-stub"
client="$run_id-client"

cleanup() {
  docker rm -f "$gateway" "$stub" "$client" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
}
trap cleanup EXIT
trap 'exit 130' INT TERM

# Content markers that must never cross listeners.
readonly SPA_MARKER=MATRIX_VTT_SPA
readonly CODEX_ADMIN_MARKER=MATRIX_CODEX_ADMIN_BUILD
readonly PLACEHOLDER_MARKER='Nexus Control Plane'
readonly SESSION_COOKIE='matrix_session=valid'
readonly PRIVATE_CSP="default-src 'none'; img-src 'self'; style-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"

# --- stub upstreams --------------------------------------------------------
# One nginx container answers for every upstream hostname the gateway uses.
# Each port identifies one upstream; every response carries X-Stub-Upstream
# and every request is logged as a STUBHIT line so the matrix can prove that
# the private listener never contacted any of them.
stub_server() {
  local name=$1 port=$2 extra=${3:-}
  cat <<EOF
server {
    listen $port;
    add_header X-Stub-Upstream $name always;
    $extra
    location / {
        default_type text/plain;
        return 200 "stub=$name uri=\$request_uri cookie=[\$http_cookie] authorization=[\$http_authorization]\n";
    }
}
EOF
}

stub_conf=$(
  cat <<'EOF'
log_format stubhit 'STUBHIT $server_port $request_method $request_uri';
access_log /dev/stdout stubhit;
EOF
  # The backend implements the auth_request target used by the /codex-api
  # allowlist: 204 for the test session cookie, 401 otherwise. The nginx
  # variables are for the stub, not this shell.
  # shellcheck disable=SC2016
  stub_server backend 5001 '
    location = /auth/session-check {
        if ($http_cookie ~ "(^|;\s*)matrix_session=valid(;|$)") {
            return 204;
        }
        return 401;
    }'
  stub_server doc-api 3000
  stub_server asset-server 5003
  stub_server doc-websocket 3002
)

echo "gateway image: $image"
docker network create "$network" >/dev/null

docker run -d --name "$stub" --network "$network" \
  --network-alias backend --network-alias doc-api \
  --network-alias asset-server --network-alias doc-websocket \
  -e STUB_CONF="$stub_conf" \
  --entrypoint sh "$image" \
  -c 'printf "%s\n" "$STUB_CONF" > /etc/nginx/conf.d/default.conf && exec nginx -g "daemon off;"' \
  >/dev/null

# --- gateway under test ----------------------------------------------------
# The real config, headers include and placeholder, as frontend.Dockerfile
# installs them. The VTT root gets marker files, including a Codex Admin
# build, so the matrix can tell which root answered.
docker create --name "$gateway" --network "$network" \
  -e SPA_MARKER="$SPA_MARKER" -e CODEX_ADMIN_MARKER="$CODEX_ADMIN_MARKER" \
  --entrypoint sh "$image" -c '
    html=/usr/share/nginx/html
    mkdir -p "$html/codex-admin" &&
    printf "%s\n" "$SPA_MARKER" > "$html/index.html" &&
    printf "%s\n" "$CODEX_ADMIN_MARKER" > "$html/codex-admin/index.html" &&
    exec nginx -g "daemon off;"' \
  >/dev/null
docker cp "$docker_dir/nginx.conf" "$gateway:/etc/nginx/nginx.conf"
docker cp "$docker_dir/security-headers.conf" "$gateway:/etc/nginx/security-headers.conf"
docker cp "$docker_dir/admin-placeholder" "$gateway:/usr/share/nginx/admin-placeholder"
docker start "$gateway" >/dev/null

docker run -d --name "$client" --network "$network" --entrypoint sleep "$image" 3600 >/dev/null

ready=false
for _ in $(seq 1 50); do
  if docker exec "$client" curl -fsS -o /dev/null "http://$gateway:80/health" 2>/dev/null &&
    docker exec "$client" curl -fsS -o /dev/null "http://$gateway:8081/healthz" 2>/dev/null &&
    docker exec "$client" curl -sS -o /dev/null "http://backend:5001/" 2>/dev/null; then
    ready=true
    break
  fi
  sleep 0.2
done
if [[ "$ready" != true ]]; then
  echo "gateway did not become ready; container logs follow" >&2
  docker logs "$gateway" >&2 || true
  exit 1
fi
docker exec "$gateway" nginx -t

# --- probe helpers ---------------------------------------------------------
checks=0
failures=0
STATUS=''
HEADERS=''
BODY=''

header() {
  printf '%s\n' "$HEADERS" | tr -d '\r' | awk -v name="$1" '
    { split($0, kv, ":"); if (tolower(kv[1]) == tolower(name)) { sub(/^[^:]*:[ \t]*/, ""); print } }'
}

# probe PORT METHOD PATH [expectations...]
#   --host H            send Host: H
#   --cookie            send the valid test session cookie
#   --auth              send an Authorization header
#   --status RE         status must match ^(RE)$
#   --upstream NAME     response must come from stub upstream NAME
#   --no-upstream       response must not come from any stub upstream
#   --not-upstream NAME response must not come from stub upstream NAME
#   --has TEXT          body must contain TEXT
#   --lacks TEXT        body must not contain TEXT
#   --body TEXT         body must equal TEXT
#   --type PREFIX       Content-Type must start with PREFIX
#   --strict            private listener security headers must be exact
probe() {
  local port=$1 method=$2 path=$3
  shift 3
  local -a curl_args=(-sS --path-as-is --max-time 10 -i)
  local -a expectations=()
  local label=":$port $method $path"
  while (($#)); do
    case $1 in
      --host) curl_args+=(-H "Host: $2"); label+=" [Host: $2]"; shift 2 ;;
      --cookie) curl_args+=(-H "Cookie: $SESSION_COOKIE"); label+=' [session]'; shift ;;
      --auth) curl_args+=(-H 'Authorization: Bearer matrix'); shift ;;
      --strict | --no-upstream) expectations+=("$1"); shift ;;
      *) expectations+=("$1" "$2"); shift 2 ;;
    esac
  done
  if [[ "$method" == HEAD ]]; then
    curl_args+=(-I)
  else
    curl_args+=(-X "$method")
  fi

  local raw
  if ! raw=$(docker exec "$client" curl "${curl_args[@]}" "http://$gateway:$port$path" 2>&1); then
    report "$label" "curl failed: $raw"
    return
  fi
  HEADERS=${raw%%$'\r\n\r\n'*}
  if [[ "$raw" == *$'\r\n\r\n'* ]]; then BODY=${raw#*$'\r\n\r\n'}; else BODY=''; fi
  STATUS=$(printf '%s\n' "$HEADERS" | head -n 1 | awk '{ print $2 }')

  local problems='' upstream
  upstream=$(header X-Stub-Upstream)
  set -- "${expectations[@]}"
  while (($#)); do
    case $1 in
      --status) [[ "$STATUS" =~ ^($2)$ ]] || problems+=" status $STATUS, expected $2;"; shift 2 ;;
      --upstream) [[ "$upstream" == "$2" ]] || problems+=" upstream '${upstream:-none}', expected $2;"; shift 2 ;;
      --no-upstream) [[ -z "$upstream" ]] || problems+=" reached upstream $upstream;"; shift ;;
      --not-upstream) [[ "$upstream" != "$2" ]] || problems+=" reached upstream $2;"; shift 2 ;;
      --has) [[ "$BODY" == *"$2"* ]] || problems+=" body lacks '$2';"; shift 2 ;;
      --lacks) [[ "$BODY" != *"$2"* ]] || problems+=" body contains '$2';"; shift 2 ;;
      --body) [[ "$BODY" == "$2" ]] || problems+=" body '$BODY', expected '$2';"; shift 2 ;;
      --type)
        local type
        type=$(header Content-Type)
        [[ "$type" == "$2"* ]] || problems+=" Content-Type '$type', expected $2;"
        shift 2
        ;;
      --strict) problems+=$(strict_header_problems); shift ;;
      *) echo "unknown expectation $1" >&2; exit 2 ;;
    esac
  done
  report "$label" "$problems"
}

strict_header_problems() {
  local problems='' name expected actual
  local -A required=(
    [Content-Security-Policy]="$PRIVATE_CSP"
    [X-Frame-Options]=DENY
    [X-Content-Type-Options]=nosniff
    [Referrer-Policy]=no-referrer
    [Cache-Control]=no-store
  )
  for name in "${!required[@]}"; do
    expected=${required[$name]}
    actual=$(header "$name")
    # Exactly one value: a duplicate from an included file would be ambiguous.
    [[ "$actual" == "$expected" ]] || problems+=" $name '${actual//$'\n'/ | }', expected '$expected';"
  done
  local server
  server=$(header Server)
  [[ "$server" != */* ]] || problems+=" Server header discloses a version ($server);"
  printf '%s' "$problems"
}

report() {
  local label=$1 problems=$2
  checks=$((checks + 1))
  if [[ -z "$problems" ]]; then
    printf 'ok    %s -> %s\n' "$label" "$STATUS"
  else
    failures=$((failures + 1))
    printf 'FAIL  %s ->%s\n' "$label" "$problems"
  fi
}

private_probe() {
  probe 8081 "$@" --strict --no-upstream --lacks "$SPA_MARKER" --lacks "$CODEX_ADMIN_MARKER"
}

stub_hits() {
  docker logs "$stub" 2>/dev/null | grep -c '^STUBHIT' || true
}

# --- :80 public gateway ----------------------------------------------------
echo '== :80 public gateway: positive controls'
probe 80 GET / --status 200 --has "$SPA_MARKER" --no-upstream
probe 80 GET /health --status 200 --has healthy --no-upstream
probe 80 GET /api/campaigns --status 200 --upstream backend
probe 80 GET /auth/session-check --status 401 --upstream backend
probe 80 GET /ws --status 200 --upstream backend
probe 80 GET /assets/matrix.png --status 200 --upstream asset-server
probe 80 GET /codex-ws --status 200 --upstream doc-websocket

echo '== :80 public gateway: Phase 0 admin denials'
for path in \
  /codex-admin /codex-admin/ /codex-admin/index.html /codex-admin/assets/index.js \
  /api/admin/users /api/admin/elasticsearch/reindex \
  /api/documents/bulk /api/documents/bulk/upload /api/documents/abc/process \
  /api/deduplication/duplicates /api/processing/queue \
  /api/references/abc /api/annotations/abc \
  /codex-api/ /codex-api/health /codex-api/api/admin/users /codex-api/api/documents \
  /codex-api/api/documents/bulk/upload /codex-api/api/documents/abc/process \
  /codex-api/api/structured-data/abc /codex-api/api/search; do
  probe 80 GET "$path" --status 404 --no-upstream --lacks "$CODEX_ADMIN_MARKER"
done
for method in POST PUT DELETE; do
  probe 80 "$method" /api/admin/users --status 404 --no-upstream
  probe 80 "$method" /api/documents/bulk --status 404 --no-upstream
done

echo '== :80 public gateway: encoding and normalization variants'
# nginx decodes and normalizes the URI before choosing a location, so these
# must land on the same denials.
for path in \
  /%63odex-admin/ /codex%2Dadmin/ /codex-admin%2Findex.html //codex-admin/ \
  /./codex-admin/ /x/../codex-admin/ /api//admin/users /api/%61dmin/users \
  /api/admin%2Fusers /api/./admin/users /api/documents/%62ulk \
  /codex-api/api/documents/..%2F..%2Fapi/admin/users \
  /codex-api/api/documents/abc%2Fprocess; do
  probe 80 GET "$path" --status 404 --no-upstream --lacks "$CODEX_ADMIN_MARKER"
done

echo "== :80 public gateway: case and ';' variants never reach admin content"
# Location matching is case-sensitive and `;` is not a path separator for
# nginx, so these fall through to the SPA or the VTT backend -- which is fine,
# as long as neither the admin build nor doc-api answers.
for path in \
  /CODEX-ADMIN/ /Codex-Admin/index.html '/codex-admin;x/' '/codex-admin;/index.html' \
  /API/ADMIN/users '/api/admin;x/users' '/codex-api;/api/admin/users' \
  /CODEX-API/api/search/quick /codex-api/API/search/quick; do
  probe 80 GET "$path" --status '200|404' --not-upstream doc-api --lacks "$CODEX_ADMIN_MARKER"
done

echo '== :80 public gateway: /codex-api read allowlist'
probe 80 GET '/codex-api/api/search/quick?q=x' --status 401 --no-upstream
probe 80 GET '/codex-api/api/documents/abc-123' --status 401 --no-upstream
probe 80 GET /codex-api//api/search/quick --status 401 --no-upstream
probe 80 GET '/codex-api/api/search/quick?q=x' --host admin.internal.nexusvtt.com --status 401 --no-upstream
probe 80 GET '/codex-api/api/search/quick?q=x' --cookie --auth --status 200 --upstream doc-api \
  --has 'uri=/api/search/quick?q=x ' --has 'cookie=[]' --has 'authorization=[]'
probe 80 GET /codex-api/api/structured-data --cookie --status 200 --upstream doc-api \
  --has 'uri=/api/structured-data '
probe 80 GET /codex-api/api/documents/abc-123 --cookie --status 200 --upstream doc-api \
  --has 'uri=/api/documents/abc-123 '
probe 80 GET /codex-api/api/documents/abc-123/content --cookie --status 200 --upstream doc-api \
  --has 'uri=/api/documents/abc-123/content '
probe 80 HEAD /codex-api/api/structured-data --cookie --status 200 --upstream doc-api
for method in POST PUT PATCH DELETE; do
  probe 80 "$method" /codex-api/api/documents/abc-123 --cookie --status 403 --no-upstream
  probe 80 "$method" /codex-api/api/search/quick --status '401|403' --no-upstream
done

echo '== :80 public gateway: admin Host header gets public behavior'
for host in admin.internal.nexusvtt.com admin.internal.nexusvtt.com:8081 ADMIN.INTERNAL.NEXUSVTT.COM; do
  probe 80 GET / --host "$host" --status 200 --has "$SPA_MARKER" --lacks "$PLACEHOLDER_MARKER"
  # :80's `location /health` prefix also answers /healthz ("healthy").
  probe 80 GET /healthz --host "$host" --status 200 --has healthy --no-upstream
  probe 80 GET /placeholder.css --host "$host" --status 200 --has "$SPA_MARKER" --no-upstream
  probe 80 GET /codex-admin/ --host "$host" --status 404 --no-upstream --lacks "$CODEX_ADMIN_MARKER"
  probe 80 GET /api/admin/users --host "$host" --status 404 --no-upstream
  probe 80 GET /codex-api/api/admin/users --host "$host" --status 404 --no-upstream
done

# --- :8081 private admin listener ------------------------------------------
hits_before_private=$(stub_hits)

echo '== :8081 private listener: served content'
private_probe GET / --status 200 --type text/html --has "$PLACEHOLDER_MARKER" --lacks '<script'
private_probe HEAD / --status 200 --type text/html
private_probe GET /placeholder.css --status 200 --type text/css
private_probe GET /healthz --status 200 --type text/plain --body ok
private_probe HEAD /healthz --status 200
for host in admin.internal.nexusvtt.com app.nexusvtt.com evil.example localhost; do
  private_probe GET / --host "$host" --status 200 --has "$PLACEHOLDER_MARKER"
done

echo '== :8081 private listener: everything else is 404'
for path in \
  /index.html /codex-admin /codex-admin/ /codex-admin/index.html /codex-admin/assets/index.js \
  /api /api/ /api/x /api/campaigns /api/admin/x /api/admin/users /api/documents/bulk \
  /auth/session-check /control-api/x /codex-api/ /codex-api/api/search/quick \
  /codex-ws /codex-dm/ /codex-dm/config.js /ws /socket.io/ /assets/matrix.png \
  /library /library-assets/x /forge/ /generator-hub/ /health /healthz/ /metrics \
  /sw.js /config.js /favicon.ico /admin-placeholder/index.html \
  /%63odex-admin/ //codex-admin/ /x/../codex-admin/ /api//admin/x /api/admin%2Fx \
  /CODEX-ADMIN/ '/codex-admin;x/'; do
  private_probe GET "$path" --status 404
done
private_probe GET /codex-api/api/search/quick --cookie --status 404
for host in admin.internal.nexusvtt.com app.nexusvtt.com evil.example; do
  private_probe GET /api/admin/users --host "$host" --status 404
  private_probe GET /codex-admin/ --host "$host" --status 404
  private_probe GET /ws --host "$host" --status 404
done

echo '== :8081 private listener: traversal cannot escape the private root'
for path in /../html/index.html /%2e%2e/html/index.html /..%2Fhtml%2Findex.html; do
  private_probe GET "$path" --status '400|404'
done

echo '== :8081 private listener: only GET and HEAD'
for method in POST PUT PATCH DELETE OPTIONS; do
  private_probe "$method" / --status 405
  private_probe "$method" /healthz --status 405
  private_probe "$method" /api/admin/users --status 405
done

hits_after_private=$(stub_hits)
checks=$((checks + 1))
if [[ "$hits_after_private" == "$hits_before_private" ]]; then
  echo "ok    :8081 contacted no stub upstream (stub request count stayed at $hits_after_private)"
else
  failures=$((failures + 1))
  echo "FAIL  :8081 contacted a stub upstream ($hits_before_private -> $hits_after_private requests)"
  docker logs "$stub" 2>/dev/null | grep '^STUBHIT' | tail -n +"$((hits_before_private + 1))"
fi

echo
echo "$checks checks, $failures failed"
if ((failures > 0)); then
  exit 1
fi
