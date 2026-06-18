#!/usr/bin/env bash
# Generates a JSON index of skills for the skill-router.
# Run from the repository root: bash skills/skill-router/scripts/generate-index.sh

set -euo pipefail

SKILLS_DIR="skills"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
INDEX_FILE="$SCRIPT_DIR/skill-index.json"

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required. Install it first (brew install jq / apt-get install jq)." >&2
  exit 1
fi

# Build JSON array of skills
skills_json="[]"
for dir in "$SKILLS_DIR"/*/; do
  skill_file="$dir/SKILL.md"
  if [ -f "$skill_file" ]; then
    skill_name=$(basename "$dir")

    # Extract description from YAML frontmatter (between --- delimiters)
    # Handles both single-line and multi-line descriptions
    description=$(awk '
      /^---$/ { fence++; next }
      fence == 1 && /^description:/ {
        sub(/^description:[[:space:]]*"?/, "")
        sub(/"?[[:space:]]*$/, "")
        print
        exit
      }
      fence >= 2 { exit }
    ' "$skill_file")

    # Skip if no description found
    if [ -z "$description" ]; then
      continue
    fi

    # Escape for JSON
    description=$(echo "$description" | sed 's/"/\\"/g')

    # Add to JSON array
    skills_json=$(echo "$skills_json" | jq \
      --arg name "$skill_name" \
      --arg desc "$description" \
      '. + [{"name": $name, "description": $desc}]')
  fi
done

# Write the index file
jq -n --argjson skills "$skills_json" '{"skills": $skills}' > "$INDEX_FILE"

count=$(echo "$skills_json" | jq 'length')
echo "Skill index generated at $INDEX_FILE ($count skills)"
