#!/usr/bin/env sh
# Command-line interface: render infographics without the browser UI.
#   ./pfsf.sh --help
#   ./pfsf.sh --game pf2e --layout booklet --format pdf
#   ./pfsf.sh fetch-art
set -eu
ROOT="$(cd "$(dirname "$0")" && pwd)"
. "$ROOT/scripts/ensure-bun.sh"
pfsf_ensure_bun
if [ ! -d "$ROOT/node_modules" ]; then
  (cd "$ROOT" && "$BUN" install --frozen-lockfile >&2)
fi
exec "$BUN" "$ROOT/packages/cli/src/main.ts" "$@"
