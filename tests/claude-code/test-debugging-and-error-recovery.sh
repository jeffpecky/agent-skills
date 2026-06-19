#!/usr/bin/env bash
# Test: debugging-and-error-recovery skill
# Verifies the skill correctly describes systematic debugging workflow
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/test-helpers.sh"

CLAUDE_PROMPT_TIMEOUT="${CLAUDE_PROMPT_TIMEOUT:-90}"

echo "=== Test: debugging-and-error-recovery skill ==="
echo ""

# Test 1: Skill recognition
echo "Test 1: Skill recognition..."
output=$(run_claude "What is the debugging-and-error-recovery skill? Briefly describe its approach." "$CLAUDE_PROMPT_TIMEOUT")

if assert_contains "$output" "debugging-and-error-recovery\|Debugging and Error.*Recovery\|systematic debug" "Skill is recognized"; then
    : # pass
else
    exit 1
fi

if assert_contains "$output" "Stop the Line\|STOP.*PRESERVE.*DIAGNOSE\|reproduce.*fix\|hypothesis" "Mentions systematic approach"; then
    : # pass
else
    exit 1
fi

echo ""

# Test 2: Reproduce first
echo "Test 2: Reproduce before fix..."
output=$(run_claude "According to debugging-and-error-recovery, what should you do before attempting a fix?" "$CLAUDE_PROMPT_TIMEOUT")

if assert_contains "$output" "reproduce\|make.*fail.*reliably\|reproducible\|reliably" "Mentions reproduce first"; then
    : # pass
else
    exit 1
fi

echo ""

# Test 3: Root cause vs symptom
echo "Test 3: Root cause fixation..."
output=$(run_claude "In debugging-and-error-recovery, should you fix the root cause or just the symptom? Explain briefly." "$CLAUDE_PROMPT_TIMEOUT")

if assert_contains "$output" "root cause\|not.*symptom\|fix.*root\|cause.*not.*symptom" "Says fix root cause not symptom"; then
    : # pass
else
    exit 1
fi

echo ""

# Test 4: Regression test requirement
echo "Test 4: Regression test..."
output=$(run_claude "After fixing a bug according to debugging-and-error-recovery, what must you add to guard against recurrence?" "$CLAUDE_PROMPT_TIMEOUT")

if assert_contains "$output" "regression test\|regression\|test.*fails.*without\|guard.*recurrence" "Requires regression test"; then
    : # pass
else
    exit 1
fi

echo ""
echo "STATUS: PASSED"
