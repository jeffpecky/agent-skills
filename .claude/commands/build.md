---
description: Implement tasks using wave-based parallel execution with fresh-context subagents and git worktrees. Each wave runs tasks in parallel, waves execute sequentially.
---

Invoke the agent-skills:fresh-context-execution skill alongside agent-skills:test-driven-development and agent-skills:using-git-worktrees.

## How It Works

Tasks are grouped into **waves** based on dependencies. Tasks within a wave have NO dependencies and run in parallel — each gets its own fresh subagent AND its own git worktree. Waves execute sequentially — Wave 2 waits for Wave 1 to complete.

```
Wave 1 (parallel):
    ├── Task 1 → [subagent + worktree] → report
    ├── Task 2 → [subagent + worktree] → report
    └── Task 3 → [subagent + worktree] → report
    ↓ merge + cleanup
Wave 2 (parallel):
    ├── Task 4 → [subagent + worktree] → report
    └── Task 5 → [subagent + worktree] → report
    ↓ merge + cleanup
Wave 3 (sequential):
    └── Task 6 → [subagent + worktree] → report
```

## Process

1. **Read the plan** — `tasks/plan.md` (includes wave assignments)
2. **Establish clean baseline** — `git status --porcelain`
3. **Single checkpoint** — Present the plan, wait for approval
4. **For each wave:**
   a. Create worktrees for all tasks in the wave (via `using-git-worktrees`)
   b. Prepare task briefs at `tasks/briefs/task-{N}-brief.md`
   c. Dispatch `task-executor` subagents in parallel (each in its own worktree)
   d. Read reports from `tasks/reports/task-{N}-report.md`
   e. Merge worktree branches back to main
   f. Clean up worktrees
   g. Update progress ledger at `tasks/progress.md`
   h. Checkpoint — verify all wave tasks complete
5. **Final verification** — Run full test suite + build
6. **Chain to** `code-review-and-quality`

## Directory Structure

```
tasks/
├── plan.md              # The implementation plan (with wave assignments)
├── progress.md          # Progress ledger tracking task completion
├── briefs/              # Task briefs for subagents
│   ├── task-1-brief.md
│   └── ...
└── reports/             # Subagent reports
    ├── task-1-report.md
    └── ...
```

## Rules

- **Wave isolation.** Tasks within a wave run in parallel with separate worktrees.
- **Wave sequential.** Wave N+1 waits for Wave N to complete and merge.
- **Orchestrator never writes code.** Only coordinates, reads reports, updates state.
- **TDD per task.** Each subagent follows RED-GREEN-refactor-commit.
- **Atomic commits.** One commit per task, never mixed.
- **Merge after each wave.** Don't let worktree branches pile up.
- **Fail loud.** If a subagent reports BLOCKED, stop and ask the user. Don't push through.
