#!/bin/sh
# Generates a panel with every widget, then type-checks, validates and render-tests it against the engine.
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
OUT=$(mktemp -d)/all-widgets
npx esbuild "$ROOT/scripts/panel-smoke.ts" --bundle --platform=node --format=esm --outfile="$OUT.mjs" --log-level=warning
node "$OUT.mjs" "$OUT" "$ROOT"
[ -f "$ROOT/vendor/types/claude-code/index.d.ts" ] || node "$ROOT/scripts/sync-types.mjs"
mkdir -p "$OUT/.claude-plugin" && cp -R "$ROOT/vendor/types" "$OUT/.claude-plugin/"
echo '{"extends":"./.claude-plugin/types/tsconfig.json"}' > "$OUT/tsconfig.json"
node "$ROOT/node_modules/typescript/bin/tsc" -p "$OUT" && echo "tsc ok"
rm -rf "$OUT/.claude-plugin/types" "$OUT/tsconfig.json"
claude plugin validate "$OUT" | tail -1
python3 "$ROOT/scripts/seed-panel.py" "$OUT/hooks/register.tsx"
mkdir -p "$OUT/tests" && cp "$ROOT/scripts/panel.test.ts" "$OUT/tests/render.test.ts"
claude plugin test "$OUT"
