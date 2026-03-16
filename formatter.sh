#!/usr/bin/env bash
set -euo pipefail

echo "formatter.sh: running Prettier to beautify project files"

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

if [ -x "node_modules/.bin/prettier" ]; then
    PRETTIER_CMD="./node_modules/.bin/prettier"
else
    PRETTIER_CMD="npx prettier"
fi

echo "Using: $PRETTIER_CMD"

TARGET_PATTERNS=("api/**/*.{ts,tsx,js,json,html,css,md}" "app/**/*.{ts,tsx,js,html,css,md}" "*.ts" "*.js" "*.html" "*.css")
shopt -s globstar nullglob || true
mapfile -d '' -t FILES < <(find api app -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.json" -o -name "*.html" -o -name "*.css" -o -name "*.md" \) -not -path "*/node_modules/*" -not -path "*/resources/*" -print0 2>/dev/null || true)

if [ ${#FILES[@]} -eq 0 ]; then
    echo "No target files found for formatting."
    exit 0
fi

echo "Running: $PRETTIER_CMD --write ${#FILES[@]} files"
if $PRETTIER_CMD --write "${FILES[@]}" "$@"; then
    echo "Prettier formatting completed successfully."
    exit 0
else
    echo "Prettier failed. Ensure Prettier is installed (npm install --save-dev prettier) or run via npx." >&2
    exit 1
fi