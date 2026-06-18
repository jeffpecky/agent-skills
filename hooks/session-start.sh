#!/bin/bash
# agent-skills session start hook
# 1. Injects the using-agent-skills meta-skill
# 2. Reads tasks/STATE.md for session recovery

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILLS_DIR="$(dirname "$SCRIPT_DIR")/skills"
META_SKILL="$SKILLS_DIR/using-agent-skills/SKILL.md"

if ! command -v jq >/dev/null 2>&1; then
  echo '{"priority": "INFO", "message": "agent-skills: jq is required for the session-start hook but was not found on PATH. Install jq to enable meta-skill injection. Skills remain available individually."}'
  exit 0
fi

# Build the message parts
MSG_PARTS=""

# Part 1: Meta-skill
if [ -f "$META_SKILL" ]; then
  META_CONTENT=$(cat "$META_SKILL")
  MSG_PARTS="agent-skills loaded. Use the skill discovery flowchart to find the right skill for your task.

$META_CONTENT"
else
  MSG_PARTS="agent-skills: using-agent-skills meta-skill not found. Skills may still be available individually."
fi

# Part 2: Session recovery — check for STATE.md in the project
# Look for tasks/STATE.md relative to the project root (cwd or CLAUDE_PROJECT_DIR)
STATE_FILE=""
if [ -n "$CLAUDE_PROJECT_DIR" ] && [ -f "$CLAUDE_PROJECT_DIR/tasks/STATE.md" ]; then
  STATE_FILE="$CLAUDE_PROJECT_DIR/tasks/STATE.md"
elif [ -f "tasks/STATE.md" ]; then
  STATE_FILE="tasks/STATE.md"
fi

if [ -n "$STATE_FILE" ]; then
  STATE_CONTENT=$(cat "$STATE_FILE")
  # Extract current phase and progress summary
  PHASE=$(grep -A1 "## Current Phase" "$STATE_FILE" | grep "Phase:" | sed 's/.*Phase: *//' | head -1)
  FEATURE=$(grep -A1 "## Current Phase" "$STATE_FILE" | grep "Feature:" | sed 's/.*Feature: *//' | head -1)
  TASKS_DONE=$(grep -c "| done |" "$STATE_FILE" 2>/dev/null || echo "0")
  TASKS_TOTAL=$(grep -cE "^\| [0-9]" "$STATE_FILE" 2>/dev/null || echo "0")

  if [ "$PHASE" != "none" ] && [ -n "$PHASE" ]; then
    MSG_PARTS="$MSG_PARTS

---

## Session Recovery (from tasks/STATE.md)

**Previous session was in phase: $PHASE**
**Feature: $FEATURE**
**Tasks completed: $TASKS_DONE/$TASKS_TOTAL**

To resume: Read tasks/STATE.md and tasks/progress.md, then continue from the first incomplete task.

\`\`\`
$STATE_CONTENT
\`\`\`"
  fi
fi

# Output as JSON
jq -cn --arg message "$MSG_PARTS" '{priority: "IMPORTANT", message: $message}'
