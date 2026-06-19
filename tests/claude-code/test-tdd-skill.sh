#!/usr/bin/env bash
# Test: test-driven-development skill
# Verifies the skill correctly describes TDD workflow
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/test-helpers.sh"

CLAUDE_PROMPT_TIMEOUT="${CLAUDE_PROMPT_TIMEOUT:-90}"

echo "=== Test: test-driven-development skill ==="
echo ""

# Test 1: Skill recognition
echo "Test 1: Skill recognition..."
output=$(run_claude "What is the test-driven-development skill? Briefly describe its core cycle." "$CLAUDE_PROMPT_TIMEOUT")

if assert_contains "$output" "test-driven-development\|Test-Driven Development\|test driven" "Skill is recognized"; then
    : # pass
else
    exit 1
fi

if assert_contains "$output" "Red.*Green.*Refactor\|RED.*GREEN.*REFACTOR\|red.*green.*refactor" "Describes Red-Green-Refactor cycle"; then
    : # pass
else
    exit 1
fi

echo ""

# Test 2: Test before code
echo "Test 2: Test before code..."
output=$(run_claude "According to test-driven-development, should you write the test before or after the production code?" "$CLAUDE_PROMPT_TIMEOUT")

if assert_contains "$output" "before\|test.*first.*code\|write.*test.*before\|failing.*test.*first" "Confirms test before code"; then
    : # pass
else
    exit 1
fi

echo ""

# Test 3: Bug fix approach
echo "Test 3: Bug fix approach..."
output=$(run_claude "In test-driven-development, what is the 'Prove-It' pattern and how should you approach a bug fix?" "$CLAUDE_PROMPT_TIMEOUT")

if assert_contains "$output" "Prove-It\|Prove It\|reproduce.*test\|reproduction.*test\|test.*reproduce" "Describes Prove-It pattern"; then
    : # pass
else
    exit 1
fi

echo ""

# Test 4: The Beyonce Rule
echo "Test 4: The Beyonce Rule..."
output=$(run_claude "What is 'The Beyonce Rule' in test-driven-development? Explain what it means." "$CLAUDE_PROMPT_TIMEOUT")

if assert_contains "$output" "Beyonce\|put a test on it\|test on it\|If you liked it" "Mentions Beyonce Rule"; then
    : # pass
else
    exit 1
fi

echo ""
echo "STATUS: PASSED"
