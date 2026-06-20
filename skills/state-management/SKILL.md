---
name: state-management
description: Use when starting or resuming any multi-step work. Creates and maintains a shared state file that persists across sessions and coordinates between commands. Read this before running /spec, /plan, /build, /test, or /review.
---

# State Management

## Overview

Agent Skills uses a shared state file (`tasks/STATE.md`) to coordinate between commands and persist across sessions. This is the structural foundation that makes fresh-context subagents work — every subagent reads state before starting, and writes state when done.

For multi-area projects (backend, frontend, infra), Agent Skills supports **workstreams** — isolated planning contexts that share code but maintain separate state.

## When to Use

Use when starting a new project, feature, or task, and when resuming work after a session restart, system restart, or context clear. Always read state at session start; always update state when a lifecycle phase completes or task status changes.

## The State File

### Single-Area Projects

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

### Multi-Area Projects (Workstreams)

For projects with parallel areas (backend, frontend, infra), use workstreams:

```
tasks/
  workstreams/
    backend-api/
      STATE.md          # Isolated state for backend
      config.json       # Workstream config (area, dependencies)
    frontend-dash/
      STATE.md          # Isolated state for frontend
      config.json
    infrastructure/
      STATE.md          # Isolated state for infra
      config.json
```

Each workstream has its own STATE.md with the same structure as single-area projects. Workstreams can have cross-area dependencies tracked in config.json.

#### Workstream STATE.md

```markdown
# Workstream State

## Current Phase
- Phase: build
- Area: backend-api
- Started: 2025-01-15T10:00:00Z

## Progress
| Task | Status | Commits | Notes |
|------|--------|---------|-------|
| 1    | done   | abc1234 | —     |
| 2    | active | —       | in progress |

## Dependencies
- Depends on: frontend-dash (API contract)
- Blocked by: none

## Decisions
- Using REST instead of GraphQL
```

#### Workstream Config

```json
{
  "name": "backend-api",
  "area": "backend",
  "created": "2025-01-15T10:00:00Z",
  "dependencies": ["frontend-dash"],
  "sharedFiles": ["src/shared/types.ts"]
}
```

#### Workstream Commands

```bash
# Create a workstream
node scripts/agent-skills-workstream.js create backend-api --area backend

# List all workstreams
node scripts/agent-skills-workstream.js list

# Select active workstream
node scripts/agent-skills-workstream.js select backend-api

# Get status
node scripts/agent-skills-workstream.js status

# Add cross-area dependency
node scripts/agent-skills-workstream.js add-dependency backend-api frontend-dash

# Check if workstream can start (dependencies met)
node scripts/agent-skills-workstream.js can-start backend-api

# Get execution plan (waves, order)
node scripts/agent-skills-workstream.js execution-plan
```

## When to Read State

Every command should read `tasks/STATE.md` at startup to understand:
- What phase the project is in
- What's been completed
- What's active
- What's blocked

For workstreams, read the active workstream's STATE.md:
```bash
node scripts/agent-skills-workstream.js status
# Then read tasks/workstreams/{active}/STATE.md
```

## When to Write State

- `/spec` completes → update Spec section
- `/plan` completes → update Plan section
- `/build` completes a task → update Progress row
- `/test` completes → update Verification section
- `/review` completes → update phase to "review"
- Blocker encountered → update Blockers section

For workstreams, update the workstream's STATE.md, not the root STATE.md.

## Session Recovery

When resuming after a session restart:
1. Read `tasks/STATE.md` (single-area) or check active workstream
2. Check `tasks/progress.md` for task completion
3. Check git log for commits since last known state
4. Resume from the first incomplete task

For workstreams:
1. Check which workstream was active
2. Read that workstream's STATE.md
3. Check cross-area dependencies
4. Resume work

## Rules

- **Always read before writing.** Never overwrite state without reading current state first.
- **Atomic updates.** Update only the section that changed.
- **Timestamp changes.** Update "Started" or add "Last Activity" when state changes.
- **Don't lose progress.** If state file exists and you're starting fresh, check if there's existing work before overwriting.
- **Workstream isolation.** Each workstream maintains its own STATE.md. Don't mix workstream state.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I can remember the state in my head" | You might, but the next fresh-context subagent won't. Memory doesn't persist across context resets. |
| "Writing state files slows down execution" | A 10-second state write prevents hours of recovery when the agent crashes or Compaction occurs. |
| "Workstreams are overkill for my project" | If you have backend + frontend + infra, you need workstreams. Without them, state bleeds between areas. |

## Red Flags

- Executing a command or task without reading tasks/STATE.md first.
- Modifying files without updating the progress ledger.
- Forgetting to log blockers or decisions.
- Mixing workstream state (writing to root STATE.md when workstreams exist).

## Verification

Before finishing a phase or session, confirm:
- [ ] tasks/STATE.md exists (or active workstream's STATE.md)
- [ ] Current Phase matches the active step
- [ ] Progress ledger matches git log and task completion state
- [ ] Decisions and blockers are fully documented
- [ ] Cross-area dependencies are tracked (if using workstreams)

