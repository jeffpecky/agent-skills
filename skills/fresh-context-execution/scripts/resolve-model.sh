#!/bin/bash
# resolve-model.sh — Config-driven model resolution for agent-skills
# Usage: bash resolve-model.sh <role> [config-file]
# Roles: researcher, planner, executor, verifier, reviewer
# Reads: tasks/config.json (or provided config file)
# Outputs: JSON with model, effort, temperature

set -e

ROLE="${1:-executor}"
CONFIG="${2:-tasks/config.json}"

# Default model tiers (when no config exists)
declare -A DEFAULT_MODEL=(
  [researcher]="claude-sonnet-4-6"
  [planner]="claude-sonnet-4-6"
  [executor]="claude-sonnet-4-6"
  [verifier]="claude-sonnet-4-6"
  [reviewer]="claude-sonnet-4-6"
)

declare -A DEFAULT_EFFORT=(
  [researcher]="medium"
  [planner]="medium"
  [executor]="medium"
  [verifier]="medium"
  [reviewer]="medium"
)

# Read config if it exists
if [ -f "$CONFIG" ]; then
  # Extract model and effort for the specific role using awk
  MODEL=$(awk -v role="$ROLE" '
    $0 ~ "\"" role "\"" { found=1 }
    found && /"model"/ { gsub(/.*"model"[[:space:]]*:[[:space:]]*"/, ""); gsub(/".*/, ""); print; exit }
  ' "$CONFIG" 2>/dev/null || echo "")
  
  EFFORT=$(awk -v role="$ROLE" '
    $0 ~ "\"" role "\"" { found=1 }
    found && /"effort"/ { gsub(/.*"effort"[[:space:]]*:[[:space:]]*"/, ""); gsub(/".*/, ""); print; exit }
  ' "$CONFIG" 2>/dev/null || echo "")
else
  MODEL=""
  EFFORT=""
fi

# Fall back to defaults
MODEL="${MODEL:-${DEFAULT_MODEL[$ROLE]}}"
EFFORT="${EFFORT:-${DEFAULT_EFFORT[$ROLE]}}"

# Output JSON
echo "{\"model\":\"$MODEL\",\"effort\":\"$EFFORT\",\"role\":\"$ROLE\"}"
