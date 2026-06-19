---
name: state-management
description: Use when starting or resuming any multi-step work. Creates and maintains a shared state file that persists across sessions and coordinates between commands. Read this before running /spec, /plan, /build, /test, or /review.
---

# State Management

## Overview

Agent Skills uses a shared state file (`tasks/STATE.md`) to coordinate between commands and persist across sessions. This is the structural foundation that makes fresh-context subagents work — every subagent reads state before starting, and writes state when done.

## When to Use

Use when starting a new project, feature, or task, and when resuming work after a session restart, system restart, or context clear. Always read state at session start; always update state when a lifecycle phase completes or task status changes.

## The State File

Location: `tasks/STATE.md`

```markdown
# Project State

## Current Phase
- Phase: build | verify | review | ship
- Feature: {feature name from spec}
- Started: {ISO timestamp}

## Spec
- Path: SPEC.md
- Status: approved

## Plan
- Path: tasks/plan.md
- Status: approved
- Tasks: {total count}

## Progress
| Task | Status | Commits | Notes |
|------|--------|---------|-------|
| 1    | done   | abc1234 | —     |
| 2    | done   | def5678 | —     |
| 3    | active | —       | in progress |
| 4    | pending| —       | —     |

## Research
- Path: tasks/research.md
- Status: complete

## Verification
- Path: tasks/verification.md
- Status: pending | complete
- Verdict: PASS | FAIL

## Blockers
- {any active blockers}

## Decisions
- {key implementation decisions from /spec}
```

## When to Read State

Every command should read `tasks/STATE.md` at startup to understand:
- What phase the project is in
- What's been completed
- What's active
- What's blocked

## When to Write State

- `/spec` completes → update Spec section
- `/plan` completes → update Plan section
- `/build` completes a task → update Progress row
- `/test` completes → update Verification section
- `/review` completes → update phase to "review"
- Blocker encountered → update Blockers section

## Session Recovery

When resuming after a session restart:
1. Read `tasks/STATE.md`
2. Check `tasks/progress.md` for task completion
3. Check git log for commits since last known state
4. Resume from the first incomplete task

## Rules

- **Always read before writing.** Never overwrite state without reading current state first.
- **Atomic updates.** Update only the section that changed.
- **Timestamp changes.** Update "Started" or add "Last Activity" when state changes.
- **Don't lose progress.** If state file exists and you're starting fresh, check if there's existing work before overwriting.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I can remember the state in my head" | You might, but the next fresh-context subagent won't. Memory doesn't persist across context resets. |
| "Writing state files slows down execution" | A 10-second state write prevents hours of recovery when the agent crashes or Compaction occurs. |

## Red Flags

- Executing a command or task without reading tasks/STATE.md first.
- Modifying files without updating the progress ledger.
- Forgetting to log blockers or decisions.

## Verification

Before finishing a phase or session, confirm:
- [ ] tasks/STATE.md exists
- [ ] Current Phase matches the active step
- [ ] Progress ledger matches git log and task completion state
- [ ] Decisions and blockers are fully documented

