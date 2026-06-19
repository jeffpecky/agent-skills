#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROMPTS_DIR="$SCRIPT_DIR/prompts"

PASSED=0
FAILED=0
SKIPPED=0

run() {
  local skill="$1"
  local prompt="$2"
  echo ">>> $skill"
  set +e
  OUTPUT="$($SCRIPT_DIR/run-test.sh "$skill" "$PROMPTS_DIR/$prompt" 2>&1)"
  STATUS=$?
  set -e
  echo "$OUTPUT"
  if echo "$OUTPUT" | grep -q '^SKIP:'; then
    SKIPPED=$((SKIPPED + 1))
  elif [ "$STATUS" -eq 0 ]; then
    PASSED=$((PASSED + 1))
  else
    FAILED=$((FAILED + 1))
  fi
  echo ""
}

run "spec-driven-development" "use-spec-driven-development.txt"
run "planning-and-task-breakdown" "use-planning-and-task-breakdown.txt"
run "fresh-context-execution" "use-fresh-context-execution.txt"
run "test-driven-development" "use-test-driven-development.txt"
run "debugging-and-error-recovery" "use-debugging-and-error-recovery.txt"
run "code-review-and-quality" "use-code-review-and-quality.txt"
run "shipping-and-launch" "use-shipping-and-launch.txt"

echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo "Skipped: $SKIPPED"

if [ "$FAILED" -gt 0 ]; then
  exit 1
fi
