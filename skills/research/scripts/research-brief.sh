#!/bin/bash
# research-brief.sh — Create research brief for researcher persona
# Usage: bash research-brief.sh <topic> [output-dir] [research-type]
# research-type: internal | external | both (default: both)
# Output: Research brief file ready for researcher persona

set -e

TOPIC="${1:?Usage: research-brief.sh <topic> [output-dir] [research-type]}"
OUTPUT_DIR="${2:-tasks/reports}"
RESEARCH_TYPE="${3:-both}"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Create research brief
BRIEF_FILE="$OUTPUT_DIR/RESEARCH-BRIEF.md"

if [ "$RESEARCH_TYPE" = "internal" ]; then
  cat > "$BRIEF_FILE" << EOF
# Research Brief

## Topic
$TOPIC

## Research Type
Internal only (codebase patterns, conventions, dependencies)

## Output
- Internal findings: $OUTPUT_DIR/research-report.md

## Instructions
1. Read this brief
2. Research internal codebase patterns
3. Write findings to output file
4. Return summary of key findings
EOF
elif [ "$RESEARCH_TYPE" = "external" ]; then
  cat > "$BRIEF_FILE" << EOF
# Research Brief

## Topic
$TOPIC

## Research Type
External only (APIs, libraries, frameworks)

## Output
- External findings: $OUTPUT_DIR/RESEARCH.md

## Instructions
1. Read this brief
2. Research external APIs and libraries
3. Write findings to output file
4. Return summary of key findings
EOF
else
  cat > "$BRIEF_FILE" << EOF
# Research Brief

## Topic
$TOPIC

## Research Type
Both internal and external

## Research Sources
- **Internal:** Codebase patterns, conventions, dependencies
- **External:** APIs, libraries, frameworks (Context7 + web search)

## Output
- Internal findings: $OUTPUT_DIR/research-report.md
- External findings: $OUTPUT_DIR/RESEARCH.md

## Instructions
1. Read this brief
2. Research internal codebase patterns
3. Research external APIs and libraries
4. Write findings to output files
5. Return summary of key findings
EOF
fi

echo "Research brief created: $BRIEF_FILE"
echo "Research type: $RESEARCH_TYPE"
echo ""
echo "Next step: Invoke researcher persona with this brief"
echo "  researcher persona reads: $BRIEF_FILE"
echo "  researcher outputs to: $OUTPUT_DIR/"
