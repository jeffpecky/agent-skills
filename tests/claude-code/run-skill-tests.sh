#!/usr/bin/env bash
# Test runner for Claude Code integration tests
# Runs static validation (node:test) and skill integration tests (bash)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "========================================"
echo " Claude Code Skill Test Suite"
echo "========================================"
echo ""
echo "Repository: $REPO_DIR"
echo "Test time: $(date)"
echo "Claude version: $(claude --version 2>/dev/null || echo 'not found')"
echo ""

# Parse arguments
VERBOSE=false
SPECIFIC_TEST=""
TIMEOUT=300
RUN_INTEGRATION=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --verbose|-v) VERBOSE=true; shift ;;
        --test|-t) SPECIFIC_TEST="$2"; shift 2 ;;
        --timeout) TIMEOUT="$2"; shift 2 ;;
        --integration|-i) RUN_INTEGRATION=true; shift ;;
        --help|-h)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --verbose, -v        Show verbose output"
            echo "  --test, -t NAME      Run only the specified test"
            echo "  --timeout SECONDS    Set timeout per test (default: 300)"
            echo "  --integration, -i    Run integration tests (requires claude CLI)"
            echo "  --help, -h           Show this help"
            echo ""
            echo "Static tests (node:test, always run):"
            echo "  manifest.test.js     plugin.json schema validation"
            echo "  commands.test.js     command frontmatter validation"
            echo ""
            echo "Integration tests (require claude CLI, use --integration):"
            for t in "$SCRIPT_DIR"/test-*.sh; do
                name=$(basename "$t")
                echo "  $name"
            done
            exit 0
            ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

passed=0
failed=0
skipped=0

# Run static node:test suite (always)
echo "----------------------------------------"
echo " Running static validation (node:test)"
echo "----------------------------------------"

static_output=$(cd "$REPO_DIR" && node --test "tests/claude-code/*.test.js" 2>&1) && static_ok=true || static_ok=false

if [ "$VERBOSE" = true ]; then
    echo "$static_output"
else
    echo "$static_output" | tail -5
fi

if [ "$static_ok" = true ]; then
    echo "  [PASS] Static validation"
    passed=$((passed + 1))
else
    echo "  [FAIL] Static validation"
    failed=$((failed + 1))
fi
echo ""

# Check if claude CLI is available for integration tests
if ! command -v claude &> /dev/null; then
    echo "----------------------------------------"
    echo " Claude CLI not found — skipping integration tests"
    echo " Install: https://code.claude.com"
    echo "----------------------------------------"
    skipped=$((skipped + 7))
else
    # Determine which integration tests to run
    integration_tests=(
        "test-spec-driven-development.sh"
        "test-planning-and-task-breakdown.sh"
        "test-fresh-context-execution.sh"
        "test-debugging-and-error-recovery.sh"
        "test-tdd-skill.sh"
        "test-code-review-and-quality.sh"
        "test-shipping-and-launch.sh"
    )

    if [ "$RUN_INTEGRATION" = false ]; then
        echo "----------------------------------------"
        echo " Integration tests require --integration flag"
        echo " (they take 1-5 minutes each via claude CLI)"
        echo "----------------------------------------"
        skipped=$((skipped + ${#integration_tests[@]}))
    else
        if [ -n "$SPECIFIC_TEST" ]; then
            integration_tests=("$SPECIFIC_TEST")
        fi

        for test in "${integration_tests[@]}"; do
            echo "----------------------------------------"
            echo " Running: $test"
            echo "----------------------------------------"

            test_path="$SCRIPT_DIR/$test"

            if [ ! -f "$test_path" ]; then
                echo "  [SKIP] Test file not found: $test"
                skipped=$((skipped + 1))
                continue
            fi

            if [ ! -x "$test_path" ]; then
                chmod +x "$test_path"
            fi

            start_time=$(date +%s)

            if [ "$VERBOSE" = true ]; then
                if timeout "$TIMEOUT" bash "$test_path"; then
                    end_time=$(date +%s)
                    duration=$((end_time - start_time))
                    echo ""
                    echo "  [PASS] $test (${duration}s)"
                    passed=$((passed + 1))
                else
                    exit_code=$?
                    end_time=$(date +%s)
                    duration=$((end_time - start_time))
                    if [ $exit_code -eq 124 ]; then
                        echo "  [FAIL] $test (timeout after ${TIMEOUT}s)"
                    else
                        echo "  [FAIL] $test (${duration}s)"
                    fi
                    failed=$((failed + 1))
                fi
            else
                if output=$(timeout "$TIMEOUT" bash "$test_path" 2>&1); then
                    end_time=$(date +%s)
                    duration=$((end_time - start_time))
                    echo "  [PASS] (${duration}s)"
                    passed=$((passed + 1))
                else
                    exit_code=$?
                    end_time=$(date +%s)
                    duration=$((end_time - start_time))
                    if [ $exit_code -eq 124 ]; then
                        echo "  [FAIL] (timeout after ${TIMEOUT}s)"
                    else
                        echo "  [FAIL] (${duration}s)"
                    fi
                    echo ""
                    echo "$output" | sed 's/^/  /'
                    failed=$((failed + 1))
                fi
            fi

            echo ""
        done
    fi
fi

# Summary
echo "========================================"
echo " Test Results Summary"
echo "========================================"
echo ""
echo "  Passed:  $passed"
echo "  Failed:  $failed"
echo "  Skipped: $skipped"
echo ""

if [ "$RUN_INTEGRATION" = false ] && command -v claude &> /dev/null; then
    echo "Note: Integration tests were not run (they take 1-5 minutes each via claude CLI)."
    echo "Use --integration flag to run full workflow execution tests."
    echo ""
fi

if [ $failed -gt 0 ]; then
    echo "STATUS: FAILED"
    exit 1
else
    echo "STATUS: PASSED"
    exit 0
fi
