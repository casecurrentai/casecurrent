#!/usr/bin/env bash
# no-json-dump.sh — CI guard: ban raw JSON rendering in client UI
#
# Fails if client-rendered .tsx files contain patterns that could leak
# raw JSON to production:
#   - {JSON.stringify  (JSX interpolation of stringified data)
#   - <pre>            (raw preformatted blocks)
#
# Exclusions:
#   - *.test.* files (test code is fine)
#   - Lines containing "body:" or "body :" (fetch/API call payloads)
#   - Files with a "// guardrail-allow: json-dump" comment (opt-in override)
#
# Usage: ./scripts/no-json-dump.sh [directory]
#   Defaults to client/src/ if no directory given.

set -euo pipefail

SEARCH_DIR="${1:-client/src}"
VIOLATIONS=0

echo "==> no-json-dump: scanning $SEARCH_DIR"

# Collect .tsx files, excluding test files
tsx_files=$(find "$SEARCH_DIR" -name '*.tsx' ! -name '*.test.*' 2>/dev/null || true)

if [[ -z "$tsx_files" ]]; then
  echo "==> no-json-dump: no .tsx files found, skipping"
  exit 0
fi

for file in $tsx_files; do
  # Skip files with explicit opt-in override
  if grep -q '// guardrail-allow: json-dump' "$file" 2>/dev/null; then
    continue
  fi

  # Check for {JSON.stringify in JSX (not in fetch body lines)
  matches=$(grep -n '{JSON\.stringify' "$file" 2>/dev/null | grep -v 'body[[:space:]]*:' || true)
  if [[ -n "$matches" ]]; then
    # Check if the file has a proper DEV guard wrapping the usage
    # We look for import.meta.env.DEV appearing before the JSON.stringify
    if grep -q 'import\.meta\.env\.DEV' "$file" 2>/dev/null; then
      # File has a DEV guard — allow it (assumes the stringify is inside the guard)
      continue
    fi
    echo "VIOLATION: {JSON.stringify found in $file without DEV guard:"
    echo "$matches"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi

  # Check for <pre> or <pre  tags (raw preformatted blocks)
  pre_matches=$(grep -n '<pre[ >]' "$file" 2>/dev/null || true)
  if [[ -n "$pre_matches" ]]; then
    if grep -q 'import\.meta\.env\.DEV' "$file" 2>/dev/null; then
      continue
    fi
    echo "VIOLATION: <pre> tag found in $file without DEV guard:"
    echo "$pre_matches"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
done

if [[ $VIOLATIONS -gt 0 ]]; then
  echo ""
  echo "ERROR: $VIOLATIONS file(s) contain raw JSON rendering patterns."
  echo "Fix: wrap in import.meta.env.DEV check, or add '// guardrail-allow: json-dump' comment."
  exit 1
fi

echo "==> no-json-dump: clean"
exit 0
