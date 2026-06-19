#!/usr/bin/env bash
# Test: planning-and-task-breakdown skill
# Verifies the skill correctly describes the planning workflow
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/test-helpers.sh"

CLAUDE_PROMPT_TIMEOUT="${CLAUDE_PROMPT_TIMEOUT:-90}"

echo "=== Test: planning-and-task-breakdown skill ==="
echo ""

# Test 1: Skill recognition
echo "Test 1: Skill recognition..."
output=$(run_claude "What is the planning-and-task-breakdown skill? Briefly describe its purpose." "$CLAUDE_PROMPT_TIMEOUT")

if assert_contains "$output" "planning-and-task-breakdown\|planning.*task.*breakdown\|Planning and Task" "Skill is recognized"; then
    : # pass
else
    exit 1
fi

if assert_contains "$output" "acceptance criteria\|criteria" "Mentions acceptance criteria"; then
    : # pass
else
    exit 1
fi

echo ""

# Test 2: Vertical slicing
echo "Test 2: Vertical slicing..."
output=$(run_claude "What is 'vertical slicing' in the context of planning-and-task-breakdown? Why is it important?" "$CLAUDE_PROMPT_TIMEOUT")

if assert_contains "$output" "vertical slic\|Vertical Slic\|complete feature path\|end-to-end\|one complete" "Describes vertical slicing"; then
    : # pass
else
    exit 1
fi

echo ""

# Test 3: Checkpoint requirement
echo "Test 3: Checkpoints..."
output=$(run_claude "In the planning-and-task-breakdown skill, what are checkpoints and where should they be placed?" "$CLAUDE_PROMPT_TIMEOUT")

if assert_contains "$output" "between.*phase\|major phase\|phase boundary\|after each phase\|Checkpoint" "Mentions checkpoints between phases"; then
    : # pass
else
    exit 1
fi

echo ""

# Test 4: No code during planning
echo "Test 4: No code during planning..."
output=$(run_claude "According to planning-and-task-breakdown, should you write code during the planning phase?" "$CLAUDE_PROMPT_TIMEOUT")

if assert_contains "$output" "read-only\|no code\|don't write\|must not.*code\|should not.*code\|NOT.*write.*code" "Confirms no code during planning"; then
    : # pass
else
    exit 1
fi

echo ""
echo "STATUS: PASSED"
