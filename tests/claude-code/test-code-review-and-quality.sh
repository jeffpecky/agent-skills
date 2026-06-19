#!/usr/bin/env bash
# Test: code-review-and-quality skill
# Verifies the skill correctly describes code review workflow
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/test-helpers.sh"

CLAUDE_PROMPT_TIMEOUT="${CLAUDE_PROMPT_TIMEOUT:-90}"

echo "=== Test: code-review-and-quality skill ==="
echo ""

# Test 1: Skill recognition
echo "Test 1: Skill recognition..."
output=$(run_claude "What is the code-review-and-quality skill? Briefly describe its purpose." "$CLAUDE_PROMPT_TIMEOUT")

if assert_contains "$output" "code-review-and-quality\|Code Review and Quality\|code.*review.*quality" "Skill is recognized"; then
    : # pass
else
    exit 1
fi

if assert_contains "$output" "Every change gets reviewed\|no exceptions\|review.*before.*merge" "Reviews required before merge"; then
    : # pass
else
    exit 1
fi

echo ""

# Test 2: Five axes
echo "Test 2: Five review axes..."
output=$(run_claude "What are the five axes of review in the code-review-and-quality skill? List them briefly." "$CLAUDE_PROMPT_TIMEOUT")

if assert_contains "$output" "correctness\|Correctness" "Mentions correctness"; then
    : # pass
else
    exit 1
fi

if assert_contains "$output" "readability\|simplicity\|Readab" "Mentions readability/simplicity"; then
    : # pass
else
    exit 1
fi

if assert_contains "$output" "architectur\|Architect" "Mentions architecture"; then
    : # pass
else
    exit 1
fi

if assert_contains "$output" "securit\|Secur" "Mentions security"; then
    : # pass
else
    exit 1
fi

if assert_contains "$output" "perfor\|Perfor" "Mentions performance"; then
    : # pass
else
    exit 1
fi

echo ""

# Test 3: Severity labels
echo "Test 3: Severity labels..."
output=$(run_claude "In code-review-and-quality, what severity labels should review comments have? List them." "$CLAUDE_PROMPT_TIMEOUT")

if assert_contains "$output" "Critical\|critical" "Mentions Critical label"; then
    : # pass
else
    exit 1
fi

if assert_contains "$output" "Nit\|Optional\|Consider" "Mentions lower severity labels"; then
    : # pass
else
    exit 1
fi

echo ""

# Test 4: Refactoring separation
echo "Test 4: Separating refactoring from features..."
output=$(run_claude "In code-review-and-quality, should refactoring and feature work be in the same change? Explain." "$CLAUDE_PROMPT_TIMEOUT")

if assert_contains "$output" "separat\|refactor.*feature\|different.*change\|submit separately\|two changes" "Confirms refactoring separate from features"; then
    : # pass
else
    exit 1
fi

echo ""
echo "STATUS: PASSED"
