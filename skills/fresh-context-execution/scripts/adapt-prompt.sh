#!/bin/bash
# adapt-prompt.sh — Adapt subagent prompts based on context window size
# Usage: bash adapt-prompt.sh <context-window> <base-prompt-file> [role]
# Outputs: Adapted prompt to stdout
# Note: ROLE argument is reserved for future role-specific adaptations

set -e

CONTEXT_WINDOW="${1:-200000}"
BASE_PROMPT="${2:-}"
ROLE="${3:-executor}"

# Validate context window is numeric
if ! [[ "$CONTEXT_WINDOW" =~ ^[0-9]+$ ]]; then
  echo "Error: Context window must be a number, got: $CONTEXT_WINDOW" >&2
  exit 1
fi

if [ ! -f "$BASE_PROMPT" ]; then
  echo "Error: Base prompt file not found: $BASE_PROMPT" >&2
  exit 1
fi

# Large context (>=500K): include rich context
if [ "$CONTEXT_WINDOW" -ge 500000 ]; then
  cat "$BASE_PROMPT"
  echo ""
  echo "---"
  echo "## Extended Context Available"
  echo "You have a large context window. Prior wave summaries, cross-phase context, and research reports are available. Load them as needed:"
  echo "- Prior SUMMARY.md files: @tasks/reports/summary-wave-*.md"
  echo "- Research reports: @tasks/research.md"
  echo "- Cross-phase context: @tasks/context.md"

# Medium context (200K-500K): standard prompts
elif [ "$CONTEXT_WINDOW" -ge 200000 ]; then
  cat "$BASE_PROMPT"

# Small context (<200K): thinned prompts
else
  # Extract only essential sections (skip examples, extended patterns, advanced content)
  # Note: Assumes section headers start at beginning of line (## or ### or ####)
  awk '
    /^## Examples/ { skip=1; next }
    /^## Extended Patterns/ { skip=1; next }
    /^### Extended/ { skip=1; next }
    /^#### Advanced/ { skip=1; next }
    /^## [A-Z]/ && !/^## Examples/ && !/^## Extended Patterns/ && skip { skip=0 }
    !skip { print }
  ' "$BASE_PROMPT"
  echo ""
  echo "---"
  echo "## Context Optimization"
  echo "You have a smaller context window. Focus on the core task. Extended examples are available via @-references if needed."
fi
