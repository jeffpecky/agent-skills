#!/usr/bin/env bash
# Test: shipping-and-launch skill
# Verifies the skill correctly describes deployment workflow
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/test-helpers.sh"

CLAUDE_PROMPT_TIMEOUT="${CLAUDE_PROMPT_TIMEOUT:-90}"

echo "=== Test: shipping-and-launch skill ==="
echo ""

# Test 1: Skill recognition
echo "Test 1: Skill recognition..."
output=$(run_claude "What is the shipping-and-launch skill? Briefly describe its purpose." "$CLAUDE_PROMPT_TIMEOUT")

if assert_contains "$output" "shipping-and-launch\|Shipping and Launch\|Ship.*with.*confidence" "Skill is recognized"; then
    : # pass
else
    exit 1
fi

if assert_contains "$output" "reversible\|observable\|incremental\|rollback\|feature flag\|kill switch" "Mentions reversibility or feature flags"; then
    : # pass
else
    exit 1
fi

echo ""

# Test 2: Rollback plan requirement
echo "Test 2: Rollback plan..."
output=$(run_claude "According to shipping-and-launch, when should you have a rollback plan ready?" "$CLAUDE_PROMPT_TIMEOUT")

if assert_contains "$output" "before.*deploy\|every.*deploy\|every.*launch\|before.*launch\|deploy.*need\|always" "Confirms rollback plan before deploy"; then
    : # pass
else
    exit 1
fi

echo ""

# Test 3: Staged rollout
echo "Test 3: Staged rollout..."
output=$(run_claude "In shipping-and-launch, describe the staged rollout process. What are the phases?" "$CLAUDE_PROMPT_TIMEOUT")

if assert_contains "$output" "staging\|staging.*production\|flag.*off\|gradual\|canary\|percentage\|25.*50.*100" "Describes staged rollout"; then
    : # pass
else
    exit 1
fi

echo ""

# Test 4: When to roll back
echo "Test 4: Rollback triggers..."
output=$(run_claude "In shipping-and-launch, what conditions should trigger an immediate rollback?" "$CLAUDE_PROMPT_TIMEOUT")

if assert_contains "$output" "error rate.*2x\|2x.*baseline\|error.*increase\|P95.*latency.*50%" "Lists numeric rollback triggers"; then
    : # pass
else
    exit 1
fi

if assert_contains "$output" "securit.*vulnerability\|security\|vulnerab" "Mentions security as rollback trigger"; then
    : # pass
else
    exit 1
fi

echo ""
echo "STATUS: PASSED"
