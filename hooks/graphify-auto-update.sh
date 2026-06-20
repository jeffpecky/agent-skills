#!/bin/bash
# graphify-auto-update.sh
# Auto-update knowledge graph after HEAD-advancing git commands
# Opt-in via graphify.auto_update: true in tasks/config.json

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="$PROJECT_ROOT/tasks/config.json"
GRAPH_SCRIPT="$SCRIPT_DIR/../scripts/agent-skills-graph.js"

# Check if config exists
if [ ! -f "$CONFIG_FILE" ]; then
  exit 0
fi

# Simple grep-based config check (no jq or node required)
if ! grep -q '"enabled": true' "$CONFIG_FILE" 2>/dev/null; then
  exit 0
fi

if ! grep -q '"auto_update": true' "$CONFIG_FILE" 2>/dev/null; then
  exit 0
fi

# Determine git command from arguments
GIT_COMMAND=""
case "$1" in
  commit|merge|pull|rebase|cherry-pick)
    GIT_COMMAND="$1"
    ;;
  *)
    # Not a HEAD-advancing command
    exit 0
    ;;
esac

# Run auto-update in background (non-blocking)
if [ -f "$GRAPH_SCRIPT" ]; then
  node "$GRAPH_SCRIPT" auto-update "$GIT_COMMAND" > /dev/null 2>&1 &
fi

exit 0
