#!/bin/bash
# uat-gap-collect.sh — Collect UAT failures and format for planning
# Usage: bash uat-gap-collect.sh <phase>
# Outputs: Markdown list of gaps for plan-phase --gaps

set -e

PHASE="${1:-}"
UAT_FILE="tasks/reports/${PHASE}-UAT.md"

[ -f "$UAT_FILE" ] || { echo "No UAT file found for phase $PHASE" >&2; exit 1; }

echo "# UAT Gaps — Phase $PHASE"
echo ""
echo "These failures were identified during UAT and need to be addressed:"
echo ""

# Extract failed tests
FAILURES=$(grep -B3 "\*\*Status\*\*: FAIL" "$UAT_FILE" | grep "^###" | sed 's/### //')

if [ -z "$FAILURES" ]; then
  echo "No failures found. All tests passed."
else
  NUM=0
  while IFS= read -r failure; do
    NUM=$((NUM + 1))
    echo "## Gap $NUM: $failure"
    echo ""
    echo "- **Phase**: $PHASE"
    echo "- **Source**: UAT"
    echo "- **Priority**: High"
    echo ""
    echo "### Expected Behavior"
    echo "[Extract from UAT question]"
    echo ""
    echo "### Actual Behavior"
    echo "[Extract from UAT answer]"
    echo ""
  done <<< "$FAILURES"
fi
