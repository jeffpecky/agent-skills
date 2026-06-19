#!/usr/bin/env bash
# Test explicit skill requests.
# Usage: ./run-test.sh <skill-name> <prompt-file> [max-turns]

set -euo pipefail

SKILL_NAME="${1:-}"
PROMPT_FILE="${2:-}"
MAX_TURNS="${3:-3}"

if [ -z "$SKILL_NAME" ] || [ -z "$PROMPT_FILE" ]; then
  echo "Usage: $0 <skill-name> <prompt-file> [max-turns]"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
TIMESTAMP="$(date +%s)"
OUTPUT_DIR="${AGENT_SKILLS_TEST_OUTPUT_DIR:-/tmp/agent-skills-tests}/${TIMESTAMP}/explicit-skill-requests/${SKILL_NAME}"
PROJECT_DIR="$OUTPUT_DIR/project"
LOG_FILE="$OUTPUT_DIR/agent-output.jsonl"

mkdir -p "$PROJECT_DIR/tasks" "$OUTPUT_DIR"
cp "$PROMPT_FILE" "$OUTPUT_DIR/prompt.txt"

cat > "$PROJECT_DIR/AGENTS.md" <<EOF
$(cat "$REPO_DIR/AGENTS.md")
EOF

cp -R "$REPO_DIR/skills" "$PROJECT_DIR/skills"
cp -R "$REPO_DIR/agents" "$PROJECT_DIR/agents"
cp -R "$REPO_DIR/tasks" "$PROJECT_DIR/tasks-template"

PROMPT="$(cat "$PROMPT_FILE")"

echo "=== Explicit Skill Request Test ==="
echo "Skill: $SKILL_NAME"
echo "Prompt file: $PROMPT_FILE"
echo "Output dir: $OUTPUT_DIR"

cd "$PROJECT_DIR"

if command -v opencode >/dev/null 2>&1; then
  # OpenCode CLI flags can change; keep this harness explicit and fail with logs if the invocation shape needs updating.
  timeout 300 opencode run "$PROMPT" > "$LOG_FILE" 2>&1 || true
elif command -v claude >/dev/null 2>&1; then
  # Fallback keeps the test useful for Claude-compatible skill execution, matching the Superpowers harness style.
  timeout 300 claude -p "$PROMPT" \
    --dangerously-skip-permissions \
    --max-turns "$MAX_TURNS" \
    --output-format stream-json \
    > "$LOG_FILE" 2>&1 || true
else
  echo "SKIP: neither opencode nor claude CLI is available"
  exit 0
fi

echo "=== Results ==="

SKILL_PATTERN='"skill":"([^"]*:)?'"${SKILL_NAME}"'"'
TRACE_PATTERN='"event":"skill.invoked".*"skill":"'"${SKILL_NAME}"'"'

if grep -qE "$SKILL_PATTERN" "$LOG_FILE" || grep -qE "$TRACE_PATTERN" "$LOG_FILE" || { [ -f tasks/trace.jsonl ] && grep -qE "$TRACE_PATTERN" tasks/trace.jsonl; }; then
  echo "PASS: Skill '$SKILL_NAME' was triggered"
  TRIGGERED=true
else
  echo "FAIL: Skill '$SKILL_NAME' was NOT triggered"
  TRIGGERED=false
fi

echo "Skills observed in log:"
grep -o '"skill":"[^"]*"' "$LOG_FILE" 2>/dev/null | sort -u || echo "  (none)"

FIRST_SKILL_LINE="$(grep -nE '"name":"Skill"|"event":"skill.invoked"' "$LOG_FILE" 2>/dev/null | head -1 | cut -d: -f1 || true)"
if [ -n "$FIRST_SKILL_LINE" ]; then
  PREMATURE_TOOLS="$(head -n "$FIRST_SKILL_LINE" "$LOG_FILE" | grep '"type":"tool_use"' | grep -v '"name":"Skill"' | grep -vE '"name":"(TodoWrite|TaskCreate|TaskUpdate|TaskList|TaskGet)"' || true)"
  if [ -n "$PREMATURE_TOOLS" ]; then
    echo "WARNING: Tools invoked before the first skill event:"
    echo "$PREMATURE_TOOLS" | head -5
  else
    echo "OK: No premature tool invocations detected"
  fi
else
  echo "WARNING: No skill invocation marker found"
fi

echo "Full log: $LOG_FILE"

if [ "$TRIGGERED" = true ]; then
  exit 0
fi

exit 1
