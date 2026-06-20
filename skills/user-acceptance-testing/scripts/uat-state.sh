#!/bin/bash
# uat-state.sh — UAT state persistence and session management
# Usage: bash uat-state.sh <command> [args]
# Commands:
#   list                    — List active UAT sessions
#   status <phase>          — Get status of a specific session
#   create <phase>          — Create new UAT session
#   update <phase> <test> <status> — Update test status
#   resume <phase>          — Resume a session
#   gaps <phase>            — Collect failures for planning

set -e

COMMAND="${1:-list}"
PHASE="${2:-}"
UAT_DIR="tasks/reports"

case "$COMMAND" in
  list)
    echo "## Active UAT Sessions"
    echo ""
    echo "| # | Phase | Status | Current Test | Progress |"
    echo "|---|-------|--------|--------------|----------|"
    NUM=0
    for f in "$UAT_DIR"/*-UAT.md; do
      [ -f "$f" ] || continue
      NUM=$((NUM + 1))
      PHASE_NAME=$(basename "$f" | sed 's/-UAT\.md//')
      STATUS=$(grep "^status:" "$f" | head -1 | cut -d: -f2 | tr -d ' "')
      CURRENT=$(grep "^current_test:" "$f" | head -1 | cut -d: -f2 | tr -d ' "')
      PASSED=$(grep -c "| PASS |" "$f" 2>/dev/null) || PASSED=0
      TOTAL=$(grep -c "^| [0-9]" "$f" 2>/dev/null) || TOTAL=0
      echo "| $NUM | $PHASE_NAME | ${STATUS:-unknown} | ${CURRENT:-none} | $PASSED/$TOTAL |"
    done
    [ "$NUM" -eq 0 ] && echo "| - | - | - | No active sessions | - |"
    ;;

  status)
    [ -z "$PHASE" ] && { echo "Usage: uat-state.sh status <phase>" >&2; exit 1; }
    UAT_FILE="$UAT_DIR/${PHASE}-UAT.md"
    [ -f "$UAT_FILE" ] || { echo "No UAT session found for phase $PHASE" >&2; exit 1; }
    echo "## UAT Status — Phase $PHASE"
    echo ""
    grep "^---" "$UAT_FILE" -A 10 | grep -E "^(phase|status|current_test|created|updated):" | sed 's/^/  /'
    echo ""
    echo "Progress:"
    grep "^| [0-9]" "$UAT_FILE" | sed 's/^/  /'
    ;;

  create)
    [ -z "$PHASE" ] && { echo "Usage: uat-state.sh create <phase>" >&2; exit 1; }
    UAT_FILE="$UAT_DIR/${PHASE}-UAT.md"
    if [ -f "$UAT_FILE" ]; then
      echo "UAT session already exists for phase $PHASE. Use 'resume' to continue."
      exit 1
    fi
    mkdir -p "$UAT_DIR"
    cat > "$UAT_FILE" << EOF
---
phase: $PHASE
status: testing
current_test: "1. Original Intent"
created: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
updated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
---

# User Acceptance Testing — Phase $PHASE

## Test Progress

| # | Test | Status | Notes |
|---|------|--------|-------|
| 1 | Original Intent | PENDING | |
| 2 | Edge Cases | PENDING | |
| 3 | Behavior | PENDING | |
| 4 | Missing Features | PENDING | |
| 5 | Approval | PENDING | |

## Current Test

### 1. Original Intent
**Question**: Does the implementation do what you originally asked for?
**Answer**: [Waiting for response]
**Status**: PENDING

## Issues Found

[None yet]
EOF
    echo "Created UAT session for phase $PHASE: $UAT_FILE"
    ;;

  update)
    [ -z "$PHASE" ] || [ -z "$3" ] || [ -z "$4" ] && { echo "Usage: uat-state.sh update <phase> <test-number> <status>" >&2; exit 1; }
    TEST_NUM="$3"
    TEST_STATUS="$4"
    UAT_FILE="$UAT_DIR/${PHASE}-UAT.md"
    [ -f "$UAT_FILE" ] || { echo "No UAT session found for phase $PHASE" >&2; exit 1; }
    # Update the test status using awk (cross-platform, no sed -i)
    awk -v test_num="$TEST_NUM" -v test_status="$TEST_STATUS" '
      /\| [0-9]+ \|/ && $0 ~ "\\| " test_num " \\|" { sub(/\| [A-Z]+ \|/, "| " test_status " |") }
      { print }
    ' "$UAT_FILE" > "$UAT_FILE.tmp" && mv "$UAT_FILE.tmp" "$UAT_FILE"
    # Update frontmatter
    awk -v updated="$(date -u +"%Y-%m-%dT%H:%M:%SZ")" '
      /^updated:/ { print "updated: " updated; next }
      { print }
    ' "$UAT_FILE" > "$UAT_FILE.tmp" && mv "$UAT_FILE.tmp" "$UAT_FILE"
    echo "Updated test $TEST_NUM to $TEST_STATUS"
    ;;

  gaps)
    [ -z "$PHASE" ] && { echo "Usage: uat-state.sh gaps <phase>" >&2; exit 1; }
    UAT_FILE="$UAT_DIR/${PHASE}-UAT.md"
    [ -f "$UAT_FILE" ] || { echo "No UAT session found for phase $PHASE" >&2; exit 1; }
    echo "## UAT Gaps — Phase $PHASE"
    echo ""
    echo "Failures to feed back into planning:"
    echo ""
    # Extract failed tests from the table format
    grep "^| [0-9]" "$UAT_FILE" | grep "| FAIL |" | while IFS= read -r line; do
      TEST_NUM=$(echo "$line" | cut -d'|' -f2 | tr -d ' ')
      TEST_NAME=$(echo "$line" | cut -d'|' -f3 | tr -d ' ')
      echo "- Test $TEST_NUM: $TEST_NAME"
    done
    ;;

  resume)
    [ -z "$PHASE" ] && { echo "Usage: uat-state.sh resume <phase>" >&2; exit 1; }
    UAT_FILE="$UAT_DIR/${PHASE}-UAT.md"
    [ -f "$UAT_FILE" ] || { echo "No UAT session found for phase $PHASE" >&2; exit 1; }
    echo "Resuming UAT session for phase $PHASE"
    echo ""
    # Show current status
    grep "^---" "$UAT_FILE" -A 10 | grep -E "^(phase|status|current_test):" | sed 's/^/  /'
    echo ""
    echo "Continue testing from where you left off."
    ;;

  *)
    echo "Unknown command: $COMMAND" >&2
    echo "Usage: uat-state.sh {list|status|create|update|resume|gaps} [args]" >&2
    exit 1
    ;;
esac
