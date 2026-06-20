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

# Extract failed tests from the table format
FAILURES=$(grep "^| [0-9]" "$UAT_FILE" | grep "| FAIL |")

if [ -z "$FAILURES" ]; then
  echo "No failures found. All tests passed."
else
  NUM=0
  while IFS= read -r line; do
    NUM=$((NUM + 1))
    TEST_NUM=$(echo "$line" | cut -d'|' -f2 | tr -d ' ')
    TEST_NAME=$(echo "$line" | cut -d'|' -f3 | tr -d ' ')
    echo "## Gap $NUM: Test $TEST_NUM — $TEST_NAME"
    echo ""
    echo "- **Phase**: $PHASE"
    echo "- **Source**: UAT"
    echo "- **Priority**: High"
    echo ""
    echo "### Expected Behavior"
    echo "Test $TEST_NAME should pass."
    echo ""
    echo "### Actual Behavior"
    echo "Test $TEST_NAME failed during UAT."
    echo ""
  done <<< "$FAILURES"
fi
