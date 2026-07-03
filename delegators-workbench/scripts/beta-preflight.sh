#!/usr/bin/env bash
# Lightweight beta preflight — typecheck only, no test suite, no dev server.
set -euo pipefail
cd "$(dirname "$0")/.."
echo "==> typecheck"
npm run typecheck
echo "PASS: workbench beta preflight (typecheck)"