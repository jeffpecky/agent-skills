---
name: using-git-worktrees
description: Creates isolated workspaces for parallel task execution. Use before `fresh-context-execution` when tasks can run concurrently, when you need file-system isolation between subagents, or when starting feature work that shouldn't affect the main branch. Prevents file conflicts between parallel agents.
---

# Using Git Worktrees

## Overview

When multiple agents work on the same repository simultaneously, they need file-system isolation — not just LLM context isolation. Git worktrees provide this by giving each agent its own working directory while sharing the same git history.

**Core principle:** Isolate before you execute. Every parallel task gets its own workspace.

**Without worktrees:**
```
Task 1 → [subagent] → edits src/auth.ts
Task 2 → [subagent] → edits src/auth.ts  ← CONFLICT
```

**With worktrees:**
```
Task 1 → [subagent in worktree-1] → edits src/auth.ts
Task 2 → [subagent in worktree-2] → edits src/payment.ts  ← NO CONFLICT
```

## When to Use

- Running `fresh-context-execution` with tasks that can execute in parallel
- Starting feature work that shouldn't affect the main branch
- Multiple agents need to modify files in the same repository

**When NOT to use:**
- Single task (no parallelism needed)
- Tasks that all modify the same file (can't parallelize anyway)
- Read-only investigation (no file changes)

## The Process

### Step 0: Cleanup Stale Worktrees

Before creating anything, clean up orphaned worktrees from prior sessions:

```bash
# Clean orphaned worktrees (detects and removes stale worktrees)
node scripts/agent-skills-transition.js clean-orphans .

# Check for git stash (forbidden in worktrees — corrupts parallel work)
node scripts/agent-skills-transition.js stash-check .

# Verify CWD is primary worktree
node scripts/agent-skills-transition.js cwd-guard .
```

**Manual cleanup (if scripts unavailable):**
```bash
# List all worktrees and check for stale ones
git worktree list

# Prune stale worktree references (safe — only removes stale locks)
git worktree prune

# Remove specific orphaned worktree
git worktree remove .worktrees/<orphan-branch> --force
```

### Step 1: Check for Existing Isolation

Before creating anything, check if you're already in an isolated workspace:

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
```

**If `GIT_DIR != GIT_COMMON`:** You're already in a worktree. Skip to Step 3.

**If `GIT_DIR == GIT_COMMON`:** You're in the main checkout. Proceed to Step 2.

### Step 2: Safety Checks

**Submodule safety:** If the project uses git submodules, check if any task touches a submodule path:

```bash
# Check for submodules
if [ -f .gitmodules ]; then
  SUBMODULE_PATHS=$(git config --file .gitmodules --get-regexp '^submodule\..*\.path$' 2>/dev/null | awk '{print $2}')
  echo "WARNING: Project has submodules: $SUBMODULE_PATHS"
  echo "Worktree isolation is unsafe for tasks touching submodule paths."
  echo "Consider disabling worktrees for this project."
fi
```

**HEAD divergence check:** If HEAD has diverged from the expected base, auto-degrade to sequential:

```bash
# Check if HEAD is at expected position
EXPECTED_BASE=$(git rev-parse HEAD)
ACTUAL_BASE=$(git rev-parse origin/main 2>/dev/null || git rev-parse main 2>/dev/null)

if [ "$EXPECTED_BASE" != "$ACTUAL_BASE" ]; then
  echo "WARNING: HEAD has diverged from main."
  echo "Worktree isolation may cause conflicts."
  echo "Consider running: git checkout main && git pull"
fi
```

### Step 3: Create the Worktree

Choose a location following this priority:

1. **User-specified directory** — if the user declared a preference
2. **Existing `.worktrees/` directory** — if it exists at project root
3. **Default `.worktrees/`** — create at project root

```bash
# Ensure directory is git-ignored (prevents accidental commits)
git check-ignore -q .worktrees 2>/dev/null || {
  echo ".worktrees" >> .gitignore
  git add .gitignore
  git commit -m "chore: ignore worktree directory"
}

# Create the worktree with a feature branch
BRANCH_NAME="feature/$(date +%s)-$RANDOM"
git worktree add .worktrees/$BRANCH_NAME -b $BRANCH_NAME

# Enter the worktree
cd .worktrees/$BRANCH_NAME
```

### Step 3: Setup the Workspace

Install dependencies and verify the workspace is clean:

```bash
# Auto-detect and run setup
if [ -f package.json ]; then npm install; fi
if [ -f Cargo.toml ]; then cargo build; fi
if [ -f requirements.txt ]; then pip install -r requirements.txt; fi
if [ -f pyproject.toml ]; then poetry install; fi
if [ -f go.mod ]; then go mod download; fi

# Verify clean baseline
npm test / cargo test / pytest / go test ./...
```

**If tests fail:** Report failures. Do not proceed until baseline is clean.

### Step 5: Execute Tasks

Now dispatch parallel subagents. Each works in its own worktree:

**Create a manifest to track worktree metadata:**

```bash
# Create manifest file
cat > tasks/worktree-manifest.json << EOF
{
  "worktrees": [
    {"branch": "$BRANCH_1", "path": ".worktrees/$BRANCH_1", "task": 1},
    {"branch": "$BRANCH_2", "path": ".worktrees/$BRANCH_2", "task": 2},
    {"branch": "$BRANCH_3", "path": ".worktrees/$BRANCH_3", "task": 3}
  ],
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
```

**Dispatch subagents:**

```
Worktree 1 (.worktrees/branch-1/):
    Task 1 → [subagent] → implement → test → commit → report

Worktree 2 (.worktrees/branch-2/):
    Task 2 → [subagent] → implement → test → commit → report

Worktree 3 (.worktrees/branch-3/):
    Task 3 → [subagent] → implement → test → commit → report
```

### Step 5: Merge Results

After all tasks complete:

```bash
# Return to main workspace
cd /path/to/main/repo

# Merge each worktree branch (with safety checks)
node scripts/agent-skills-transition.js merge-worktree . feature/branch-1
node scripts/agent-skills-transition.js merge-worktree . feature/branch-2
node scripts/agent-skills-transition.js merge-worktree . feature/branch-3

# Clean up orphaned worktrees
node scripts/agent-skills-transition.js clean-orphans .
```

**Manual merge (if scripts unavailable):**
```bash
# Merge each worktree branch
git merge feature/branch-1 --no-ff -m "feat: task 1 complete"
git merge feature/branch-2 --no-ff -m "feat: task 2 complete"
git merge feature/branch-3 --no-ff -m "feat: task 3 complete"

# Clean up worktrees
git worktree remove .worktrees/branch-1
git worktree remove .worktrees/branch-2
git worktree remove .worktrees/branch-3
```

**What `merge-worktree` does:**
1. Verifies branch exists
2. Checks for stash (aborts if stash found — corrupts parallel work)
3. Checks CWD drift (warns if inside a worktree)
4. Detects deleted files on branch
5. Attempts merge with `--no-ff`
6. If conflict → aborts and reports (never defaults to editing main)

## Integration with fresh-context-execution

When `fresh-context-execution` dispatches parallel tasks:

```
fresh-context-execution
    │
    ├── Create worktrees for parallel tasks
    │   ├── .worktrees/task-1/
    │   ├── .worktrees/task-2/
    │   └── .worktrees/task-3/
    │
    ├── Dispatch subagents (each in its own worktree)
    │   ├── Task 1 → [subagent in worktree-1] → report
    │   ├── Task 2 → [subagent in worktree-2] → report
    │   └── Task 3 → [subagent in worktree-3] → report
    │
    ├── Merge results back to main
    └── Clean up worktrees
```

## Cleanup

After work is merged, remove worktrees:

```bash
# List all worktrees
git worktree list

# Remove specific worktree
git worktree remove .worktrees/<branch-name>

# Prune stale worktree references
git worktree prune
```

## Config Toggle

Worktree isolation can be disabled via project config in `tasks/config.json`:

```json
{
  "use_worktrees": true
}
```

**When to disable:**
- Project uses git submodules and tasks touch submodule paths
- HEAD has diverged significantly from main
- Working in a sandbox that blocks worktree creation
- User explicitly requests sequential execution

**How to disable:**
```bash
# Set in project config
echo '{"use_worktrees": false}' > tasks/config.json
```

When `use_worktrees` is `false`, tasks execute sequentially on the main working tree. The orchestrator still dispatches fresh subagents for context isolation — just without worktree file-system isolation.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "Sequential is simpler" | It's slower. Parallel with worktrees saves real wall-clock time. |
| "Worktrees waste disk space" | Each worktree shares git objects. Only working files are duplicated. |
| "I'll just use branches instead" | Branches require stashing and context switching. Worktrees keep each workspace live. |
| "My tasks don't conflict" | You can't know that until you try. Worktrees are cheap insurance. |

## Red Flags

- Creating worktrees without checking if already isolated (Step 1)
- Not verifying `.worktrees/` is in `.gitignore` before creating
- Forgetting to clean up worktrees after merging
- Running parallel tasks in the same directory (file conflicts)
- Not running baseline tests in new worktree before dispatching subagents

## Verification

After using git worktrees:

- [ ] Each parallel task ran in its own worktree
- [ ] No file conflicts between parallel tasks
- [ ] All worktree branches merged successfully
- [ ] All worktrees cleaned up after merge
- [ ] `.worktrees/` is in `.gitignore`
- [ ] Main branch tests still pass after merges
