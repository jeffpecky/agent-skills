#!/usr/bin/env bash
# Test: fresh-context-execution skill
# Verifies the skill correctly describes fresh-context subagent dispatch
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/test-helpers.sh"

CLAUDE_PROMPT_TIMEOUT="${CLAUDE_PROMPT_TIMEOUT:-90}"

echo "=== Test: fresh-context-execution skill ==="
echo ""

# Test 1: Skill recognition
echo "Test 1: Skill recognition..."
output=$(run_claude "What is the fresh-context-execution skill? Briefly describe its purpose." "$CLAUDE_PROMPT_TIMEOUT")

if assert_contains "$output" "fresh-context-execution\|Fresh.*Context.*Execution\|fresh context" "Skill is recognized"; then
    : # pass
else
    exit 1
fi

if assert_contains "$output" "subagent\|fresh subagent\|fresh.*context" "Mentions fresh subagents"; then
    : # pass
else
    exit 1
fi

echo ""

# Test 2: Every task gets a fresh subagent
echo "Test 2: Per-task subagent dispatch..."
output=$(run_claude "In fresh-context-execution, how many tasks should share a single subagent?" "$CLAUDE_PROMPT_TIMEOUT")

if assert_contains "$output" "no exceptions\|every task\|each task\|fresh subagent\|one task per" "Confirms one subagent per task"; then
    : # pass
else
    exit 1
fi

echo ""

# Test 3: Orchestrator role
echo "Test 3: Orchestrator role..."
output=$(run_claude "In fresh-context-execution, what is the orchestrator's role? Should it write implementation code?" "$CLAUDE_PROMPT_TIMEOUT")

if assert_contains "$output" "coordinat\|dispatch\|orchestrat\|keep.*lean\|stay.*lean" "Describes orchestrator role"; then
    : # pass
else
    exit 1
fi

if assert_contains "$output" "no.*implement\|not.*write.*code\|should not\|coordinator" "Orchestrator does not implement"; then
    : # pass
else
    exit 1
fi

echo ""

# Test 4: STATE.md
echo "Test 4: State management..."
output=$(run_claude "In fresh-context-execution, what is STATE.md and why is it important?" "$CLAUDE_PROMPT_TIMEOUT")

if assert_contains "$output" "STATE.md\|state file\|state.*persist\|persist.*session" "Mentions state persistence"; then
    : # pass
else
    exit 1
fi

echo ""
echo "STATUS: PASSED"
