---
name: planning-and-task-breakdown
description: Breaks work into ordered tasks. Use when you have a spec or clear requirements and need to break work into implementable tasks. Use when a task feels too large to start, when you need to estimate scope, or when parallel work is possible.
---

# Planning and Task Breakdown

## Overview

Decompose work into small, verifiable tasks with explicit acceptance criteria. Good task breakdown is the difference between an agent that completes work reliably and one that produces a tangled mess. Every task should be small enough to implement, test, and verify in a single focused session.

## When to Use

- You have a spec and need to break it into implementable units
- A task feels too large or vague to start
- Work needs to be parallelized across multiple agents or sessions
- You need to communicate scope to a human
- The implementation order isn't obvious

**When NOT to use:** Single-file changes with obvious scope, or when the spec already contains well-defined tasks.

## The Planning Process

### Step 1: Enter Plan Mode

Before writing any code, operate in read-only mode:

- Read the spec and relevant codebase sections
- Identify existing patterns and conventions
- Map dependencies between components
- Note risks and unknowns

**Do NOT write code during planning.** The output is a plan document, not implementation.

### Step 2: Identify the Dependency Graph

Map what depends on what:

```
Database schema
    │
    ├── API models/types
    │       │
    │       ├── API endpoints
    │       │       │
    │       │       └── Frontend API client
    │       │               │
    │       │               └── UI components
    │       │
    │       └── Validation logic
    │
    └── Seed data / migrations
```

Implementation order follows the dependency graph bottom-up: build foundations first.

### Validate Dependencies

After writing all tasks, run dependency validation:

```bash
node scripts/agent-skills-dependency.js validate tasks/plan.md
```

This will:
1. Detect dependency cycles (BLOCKER if found)
2. Check files_modified overlap (WARNING if found)
3. Compute wave assignments

Fix any issues before proceeding to execution.

### Plan Quality Validation

After writing the plan, run semantic validation across 12 dimensions:

```bash
node scripts/agent-skills-plan-checker.js report .
```

This checks:
- Objective clarity, file scope, decision coverage
- Test coverage, dependency correctness, risk identification
- Acceptance criteria, wave assignment, checkpoint placement
- Cross-phase wiring, shared data paths, convention compliance

**If validation fails:** Fix the missing dimension before proceeding. HIGH severity failures (objective, test coverage, dependencies, acceptance) must be resolved.

**Phase directory tracking** (for multi-phase projects):

```bash
# Initialize phase structure
node scripts/agent-skills-phase.js init .

# Create phases for your plan
node scripts/agent-skills-phase.js create . setup
node scripts/agent-skills-phase.js create . build
node scripts/agent-skills-phase.js create . verify

# Activate the first phase
node scripts/agent-skills-phase.js activate . 01-setup
```

### Step 3: Slice Vertically

Instead of building all the database, then all the API, then all the UI — build one complete feature path at a time:

**Bad (horizontal slicing):**
```
Task 1: Build entire database schema
Task 2: Build all API endpoints
Task 3: Build all UI components
Task 4: Connect everything
```

**Good (vertical slicing):**
```
Task 1: User can create an account (schema + API + UI for registration)
Task 2: User can log in (auth schema + API + UI for login)
Task 3: User can create a task (task schema + API + UI for creation)
Task 4: User can view task list (query + API + UI for list view)
```

Each vertical slice delivers working, testable functionality.

### Step 4: Write Tasks

Each task follows this structure with YAML frontmatter for machine-readable wave and dependency data:

```markdown
---
id: task-1
wave: 1
depends_on: []
files_modified:
  - src/db/schema.ts
  - src/db/models/user.ts
autonomous: true
---

### Task 1: Database schema + models

**Area:** backend

**Skill:** test-driven-development

**Description:** Create user table schema and Prisma models.

**Acceptance Criteria:**
- [ ] User table created with required fields
- [ ] Prisma client generates correctly
- [ ] Migration runs without errors

**Verification:** Run `npx prisma migrate dev` and confirm schema applies.
```

**Frontmatter fields (required for execution):**
- `id` — Unique task identifier (e.g., `task-1`)
- `wave` — Wave number (computed from dependencies, see Step 5)
- `depends_on` — Array of task IDs this depends on (empty array if none)
- `files_modified` — Files this task will modify (used for overlap detection)
- `autonomous` — `true` = execute without stopping; `false` = checkpoint before execution (human reviews)

### Step 5: Order, Wave-Group, and Checkpoint

Arrange tasks into **waves** based on dependencies. Tasks within a wave have NO dependencies on each other and can run in parallel. Waves execute sequentially — Wave 2 waits for Wave 1 to complete.

**Wave Assignment Algorithm (same as gsd-core):**

```
waves = {}
for each task in plan_order:
  if task.depends_on is empty:
    task.wave = 1
  else:
    task.wave = max(waves[dep] for dep in task.depends_on) + 1
  waves[task.id] = task.wave

# File overlap forces later wave
for each task B in plan_order:
  for each earlier task A where A != B:
    if any file in B.files_modified is also in A.files_modified:
      B.wave = max(B.wave, A.wave + 1)
      waves[B.id] = B.wave
```

**After assigning waves, write the plan with frontmatter:**

```markdown
# Implementation Plan: [Feature Name]

## Task List

---
id: task-1
wave: 1
depends_on: []
files_modified:
  - src/db/schema.ts
autonomous: true
---
### Task 1: Database schema + models
...

---
id: task-2
wave: 1
depends_on: []
files_modified:
  - src/types/api.ts
autonomous: true
---
### Task 2: API types and interfaces
...

---
id: task-3
wave: 2
depends_on: [task-1, task-2]
files_modified:
  - src/api/auth.ts
autonomous: true
---
### Task 3: Auth endpoints
...
```

**Wave rules:**
1. Tasks within a wave can run in parallel (each gets its own worktree)
2. Waves execute sequentially — Wave N+1 waits for Wave N
3. Dependencies are satisfied across waves, not within waves
4. If a task has no dependencies, it goes in Wave 1
5. Same-wave tasks must have zero `files_modified` overlap
6. `autonomous: false` tasks stop at a checkpoint for human review

**Validate after writing:**

```bash
node scripts/agent-skills-dependency.js validate tasks/plan.md
```

This cross-validates declared waves against DAG-computed waves. If a task's declared wave doesn't match the computed wave, fix the plan.

## Task Sizing Guidelines

| Size | Files | Scope | Example |
|------|-------|-------|---------|
| **XS** | 1 | Single function or config change | Add a validation rule |
| **S** | 1-2 | One component or endpoint | Add a new API endpoint |
| **M** | 3-5 | One feature slice | User registration flow |
| **L** | 5-8 | Multi-component feature | Search with filtering and pagination |
| **XL** | 8+ | **Too large — break it down further** | — |

If a task is L or larger, it should be broken into smaller tasks. An agent performs best on S and M tasks.

**When to break a task down further:**
- It would take more than one focused session (roughly 2+ hours of agent work)
- You cannot describe the acceptance criteria in 3 or fewer bullet points
- It touches two or more independent subsystems (e.g., auth and billing)
- You find yourself writing "and" in the task title (a sign it is two tasks)

## Plan Document Template

```markdown
# Implementation Plan: [Feature/Project Name]

## Overview
[One paragraph summary of what we're building]

## Architecture Decisions
- [Key decision 1 and rationale]
- [Key decision 2 and rationale]

## Task List

### Phase 1: Foundation
- [ ] Task 1: ...
- [ ] Task 2: ...

### Checkpoint: Foundation
- [ ] Tests pass, builds clean

### Phase 2: Core Features
- [ ] Task 3: ...
- [ ] Task 4: ...

### Checkpoint: Core Features
- [ ] End-to-end flow works

### Phase 3: Polish
- [ ] Task 5: ...
- [ ] Task 6: ...

### Checkpoint: Complete
- [ ] All acceptance criteria met
- [ ] Ready for review

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| [Risk] | [High/Med/Low] | [Strategy] |

## Open Questions
- [Question needing human input]
```

## Parallelization Opportunities

When multiple agents or sessions are available:

- **Safe to parallelize:** Independent feature slices, tests for already-implemented features, documentation
- **Must be sequential:** Database migrations, shared state changes, dependency chains
- **Needs coordination:** Features that share an API contract (define the contract first, then parallelize)

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll figure it out as I go" | That's how you end up with a tangled mess and rework. 10 minutes of planning saves hours. |
| "The tasks are obvious" | Write them down anyway. Explicit tasks surface hidden dependencies and forgotten edge cases. |
| "Planning is overhead" | Planning is the task. Implementation without a plan is just typing. |
| "I can hold it all in my head" | Context windows are finite. Written plans survive session boundaries and compaction. |

## Red Flags

- Starting implementation without a written task list
- Tasks that say "implement the feature" without acceptance criteria
- No verification steps in the plan
- All tasks are XL-sized
- No checkpoints between tasks
- Dependency order isn't considered

## Durable Artifacts

Write the implementation plan to `tasks/plan.md` unless the user or project brief supplies another path. Follow `references/artifact-contracts.md` for artifact ownership and `references/pipeline-tracing.md` for local trace events.

## Verification

Before starting implementation, confirm:

- [ ] Every task has acceptance criteria
- [ ] Every task has a verification step
- [ ] Task dependencies are identified and ordered correctly
- [ ] No task touches more than ~5 files
- [ ] Checkpoints exist between major phases
- [ ] The human has reviewed and approved the plan

## Next Step

After the plan is approved, **automatically invoke `agent-skills:fresh-context-execution`** to dispatch each task to a fresh subagent. Every task gets a clean context window — no exceptions. This prevents context rot regardless of task count.

```
Plan approved → invoke fresh-context-execution (always, even for 1 task)
```
