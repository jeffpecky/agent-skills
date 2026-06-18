---
description: Break work into small verifiable tasks. Uses a planner subagent to create the plan and a plan-checker subagent to verify it.
---

Invoke the agent-skills:planning-and-task-breakdown skill alongside agent-skills:state-management.

## Phase 1: Read Context

Read these files (they exist from prior phases):
- `SPEC.md` — the approved spec
- `tasks/research.md` — codebase research from `/spec`
- `tasks/STATE.md` — current project state

## Phase 2: Plan (planner subagent)

Dispatch a **planner subagent** to create the implementation plan:

1. **Prepare a planning brief** at `tasks/briefs/planning-brief.md` containing:
   - Path to SPEC.md
   - Path to tasks/research.md
   - Key codebase patterns from the research report
   - Instruction to create bite-sized tasks with exact code, file paths, and acceptance criteria
   - Report path: `tasks/plan.md`

2. **Dispatch a planner subagent** (type: `planner`) with the brief path. The planner:
   - Reads the spec and research report
   - Maps the dependency graph
   - Slices work vertically (one complete path per task)
   - Writes detailed tasks with exact code and acceptance criteria
   - Saves plan to `tasks/plan.md`

3. **Read the plan** — verify it covers the spec requirements

## Phase 3: Verify (plan-checker subagent)

Dispatch a **plan-checker subagent** to verify the plan:

1. **Prepare a checker brief** at `tasks/briefs/plan-check-brief.md` containing:
   - Path to tasks/plan.md
   - Path to SPEC.md
   - Path to tasks/research.md
   - Report path: `tasks/plan-check.md`

2. **Dispatch a plan-checker subagent** (type: `plan-checker`) with the brief. The checker:
   - Verifies spec coverage (every requirement has a task)
   - Verifies task atomicity (each task is self-contained)
   - Verifies dependency ordering
   - Verifies file scope (paths exist, are correct)
   - Verifies code correctness (syntax, imports)
   - **Verifies context fit** — can each task be executed in a fresh context window? Is the brief self-contained enough for a zero-context subagent? If a task requires reading >2000 lines to understand, flag it as too big.
   - Reports PASS or FAIL with specific issues

3. **If FAIL:** Fix the issues in the plan (re-dispatch planner if needed), re-check

## Phase 4: Present to User

Present the verified plan to the user for approval:
- Show task count and dependency order
- Show file map (what gets created/modified)
- Wait for unambiguous approval ("go", "yes", "approve")

## Phase 5: State Update

Update `tasks/STATE.md`:
- Set Plan section: path = tasks/plan.md, status = approved, task count
- Set Progress table: all tasks as pending
- Set Current Phase: phase = build

If user generated `tasks/plan.md`, commit it as a single preparatory commit.

## Rules

- **Read-only during planning.** Don't write code during planning — only plan.
- **Vertical slices.** Each task should deliver working, testable functionality.
- **No placeholders.** Every step must have actual content — code, commands, expected output.
- **Verify before presenting.** Always run the plan-checker before showing the plan to the user.
- **Exact file paths.** Always specify exact paths with line numbers when modifying existing files.
