#!/usr/bin/env sh
# Starts the infographic generator locally and opens it in your default browser.
# Uses a project-local copy of the latest stable Bun (downloaded into .runtime/ on first run).
#
#   ./start.sh              start and open the browser
#   ./start.sh --no-open    start without opening a browser
#   ./start.sh --port 8080  use a specific port
set -eu
ROOT="$(cd "$(dirname "$0")" && pwd)"
. "$ROOT/scripts/ensure-bun.sh"
pfsf_ensure_bun
exec "$BUN" "$ROOT/tools/launch.ts" "$@"
