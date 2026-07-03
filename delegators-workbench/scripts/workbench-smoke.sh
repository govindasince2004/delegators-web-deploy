#!/usr/bin/env bash
# Workbench predeploy smoke — build, unit tests, and health/config contract.
#
# Usage:
#   bash scripts/workbench-smoke.sh
#   WORKBENCH_SMOKE_SKIP_SERVER=1 bash scripts/workbench-smoke.sh   # build + test only
#   WORKBENCH_SMOKE_BASE_URL=http://127.0.0.1:4175 WORKBENCH_SMOKE_SKIP_SERVER=1 \
#     WORKBENCH_SMOKE_LIVE=1 bash scripts/workbench-smoke.sh        # curl an already-running server
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> npm run build"
npm run build

echo "==> npm test"
npm test

require_json_field() {
  local body="$1"
  local field="$2"
  local label="$3"
  python3 - <<PY
import json, sys
body = """$body"""
field = "$field"
label = "$label"
try:
    data = json.loads(body)
except json.JSONDecodeError as exc:
    print(f"FAIL: {label} returned invalid JSON: {exc}", file=sys.stderr)
    sys.exit(1)
if field not in data:
    print(f"FAIL: {label} missing {field!r}", file=sys.stderr)
    sys.exit(1)
print(f"    {label}.{field}={data[field]!r}")
PY
}

check_live_endpoints() {
  local base="${1%/}"

  echo "==> GET $base/api/health"
  local health_body
  health_body="$(curl -fsS "$base/api/health")"
  require_json_field "$health_body" "ok" "api/health"
  require_json_field "$health_body" "service" "api/health"
  if ! grep -q 'delegators-workbench' <<<"$health_body"; then
    echo "FAIL: api/health service is not delegators-workbench" >&2
    exit 1
  fi

  echo "==> GET $base/healthz"
  local healthz_body
  healthz_body="$(curl -fsS "$base/healthz")"
  require_json_field "$healthz_body" "status" "healthz"

  echo "==> GET $base/api/config"
  local config_body
  config_body="$(curl -fsS "$base/api/config")"
  require_json_field "$config_body" "delegatorsBaseURL" "api/config"
  require_json_field "$config_body" "defaultModel" "api/config"
}

if [[ "${WORKBENCH_SMOKE_LIVE:-}" == "1" ]]; then
  base="${WORKBENCH_SMOKE_BASE_URL:-http://127.0.0.1:4175}"
  echo "==> Live health checks against $base"
  check_live_endpoints "$base"
  echo "PASS: workbench smoke (build + test + live health)"
  exit 0
fi

if [[ "${WORKBENCH_SMOKE_SKIP_SERVER:-}" == "1" ]]; then
  echo "==> Skipping ephemeral server health checks (WORKBENCH_SMOKE_SKIP_SERVER=1)"
  echo "PASS: workbench smoke (build + test)"
  exit 0
fi

port="${WORKBENCH_SMOKE_PORT:-41795}"
base="http://127.0.0.1:${port}"
log="$(mktemp)"
pid=""

cleanup() {
  if [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1; then
    kill "$pid" >/dev/null 2>&1 || true
    wait "$pid" 2>/dev/null || true
  fi
  rm -f "$log"
}
trap cleanup EXIT

echo "==> Starting ephemeral workbench server on $base"
NODE_ENV=development \
WORKBENCH_PORT="$port" \
WORKBENCH_BIND_HOST=127.0.0.1 \
WORKBENCH_DELEGATORS_BASE_URL=http://127.0.0.1:8080 \
node dist-server/server/index.js >"$log" 2>&1 &
pid="$!"

ready=0
for _ in {1..40}; do
  if curl -fsS -o /dev/null -m 2 "$base/api/health" 2>/dev/null; then
    ready=1
    break
  fi
  if ! kill -0 "$pid" >/dev/null 2>&1; then
    echo "FAIL: workbench server exited before becoming healthy" >&2
    cat "$log" >&2
    exit 1
  fi
  sleep 0.25
done

if [[ "$ready" != "1" ]]; then
  echo "FAIL: timed out waiting for $base/api/health" >&2
  cat "$log" >&2
  exit 1
fi

check_live_endpoints "$base"
echo "PASS: workbench smoke (build + test + health/config)"