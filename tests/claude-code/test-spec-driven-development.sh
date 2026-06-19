#!/usr/bin/env bash
# Test: spec-driven-development skill
# Verifies the skill correctly describes the specification workflow
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/test-helpers.sh"

CLAUDE_PROMPT_TIMEOUT="${CLAUDE_PROMPT_TIMEOUT:-90}"

echo "=== Test: spec-driven-development skill ==="
echo ""

# Test 1: Skill recognition — agent knows the skill name and purpose
echo "Test 1: Skill recognition..."
output=$(run_claude "What is the spec-driven-development skill? Briefly describe when to use it." "$CLAUDE_PROMPT_TIMEOUT")

if assert_contains "$output" "spec-driven-development\|Spec-Driven Development\|spec driven" "Skill is recognized"; then
    : # pass
else
    exit 1
fi

if assert_contains "$output" "Spec is a living document\|living document\|spec is a living" "Mentions spec is a living document"; then
    : # pass
else
    exit 1
fi

echo ""

# Test 2: Workflow phases — verify the four phases in order
echo "Test 2: Workflow phases..."
output=$(run_claude "List the four main phases of the spec-driven-development skill in order. Answer using exactly this structure:
Phase 1: <name>
Phase 2: <name>
Phase 3: <name>
Phase 4: <name>" "$CLAUDE_PROMPT_TIMEOUT")

if assert_order "$output" "Phase 1:.*SPECIFY\|Phase 1:.*Define\|Phase 1:.*Spec" "Phase [34]" "SPECIFY before IMPLEMENT"; then
    : # pass
else
    exit 1
fi

echo ""

# Test 3: Six core areas
echo "Test 3: Six core areas..."
output=$(run_claude "What six core areas must a spec cover in the spec-driven-development skill?" "$CLAUDE_PROMPT_TIMEOUT")

if assert_contains "$output" "Objective\|Goal\|Purpose" "Mentions Objective/Goal"; then
    : # pass
else
    exit 1
fi

if assert_contains "$output" "Code Style\|Style\|convention" "Mentions Code Style"; then
    : # pass
else
    exit 1
fi

if assert_contains "$output" "Boundar" "Mentions Boundaries"; then
    : # pass
else
    exit 1
fi

echo ""

# Test 4: Constraints — must not skip spec
echo "Test 4: Anti-rationalization..."
output=$(run_claude "According to spec-driven-development, is it acceptable to skip writing a spec for a task that 'seems simple'? Explain why or why not." "$CLAUDE_PROMPT_TIMEOUT")

if assert_contains "$output" "skip.*spec\|don't need.*spec\|no.*spec\|simple.*spec\|short.*spec" "Discusses not skipping spec for simple tasks"; then
    : # pass
else
    exit 1
fi

echo ""
echo "STATUS: PASSED"
