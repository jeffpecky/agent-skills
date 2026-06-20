#!/bin/bash
# worktree-safety.sh — Non-destructive worktree lifecycle management
# Usage: bash worktree-safety.sh <command> [args]
# Commands:
#   check           — Check if in worktree
#   list            — List all worktrees
#   health          — Check worktree health (orphan detection)
#   cleanup         — Cleanup stale worktree references (non-destructive)
#   snapshot        — Snapshot current worktree inventory

set -e

COMMAND="${1:-check}"

case "$COMMAND" in
  check)
    if ! git rev-parse --git-dir >/dev/null 2>&1; then
      echo '{"error":"not a git repo"}' >&2
      exit 1
    fi
    GIT_DIR=$(cd "$(git rev-parse --git-dir)" && pwd -P)
    GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" && pwd -P)
    if [ "$GIT_DIR" != "$GIT_COMMON" ]; then
      echo '{"in_worktree":true,"git_dir":"'"$GIT_DIR"'","git_common":"'"$GIT_COMMON"'"}'
    else
      echo '{"in_worktree":false}'
    fi
    ;;

  list)
    echo "## Worktrees"
    echo ""
    git worktree list --porcelain | while IFS= read -r line; do
      if echo "$line" | grep -q "^worktree "; then
        WORKTREE_PATH=$(echo "$line" | cut -d' ' -f2)
        echo "- $WORKTREE_PATH"
      elif echo "$line" | grep -q "^HEAD "; then
        COMMIT=$(echo "$line" | cut -d' ' -f2)
        echo "  HEAD: $COMMIT"
      fi
    done
    ;;

  health)
    echo "## Worktree Health"
    echo ""
    ORPHANS=$(git worktree prune --dry-run 2>/dev/null | grep -c "^worktree " || true)
    ORPHANS=${ORPHANS:-0}
    # Trim whitespace
    ORPHANS=$(echo "$ORPHANS" | tr -d '[:space:]')
    echo "Orphaned worktrees: $ORPHANS"
    
    LIST=$(git worktree list --porcelain | grep "^worktree " | wc -l)
    LIST=${LIST:-0}
    LIST=$(echo "$LIST" | tr -d '[:space:]')
    echo "Total worktrees: $LIST"
    
    if [ "$ORPHANS" -gt 0 ] 2>/dev/null; then
      echo ""
      echo "WARNING: Orphaned worktrees detected. Run 'cleanup' to remove."
    fi
    ;;

  cleanup)
    echo "## Cleaning Up Stale Worktree References"
    echo ""
    echo "Running git worktree prune (removes stale locks and refs, not working directories)..."
    git worktree prune
    echo "Done."
    ;;

  snapshot)
    echo "## Worktree Inventory"
    echo ""
    echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo ""
    git worktree list --porcelain | grep "^worktree " | while IFS= read -r line; do
      echo "- $(echo "$line" | cut -d' ' -f2)"
    done
    ;;

  *)
    echo "Unknown command: $COMMAND" >&2
    echo "Usage: worktree-safety.sh {check|list|health|cleanup|snapshot}" >&2
    exit 1
    ;;
esac