---
name: milestone-lifecycle
description: Manages multi-milestone project lifecycles. Use when a project has multiple milestones or versions, when transitioning from one milestone to the next, when archiving completed work, or when starting a new milestone after completing one. Covers the full cycle: new-milestone → plan → build → verify → review → ship → complete-milestone → new-milestone.
---

# Milestone Lifecycle

## Overview

Projects with multiple milestones need structured transitions between them. This skill manages the full lifecycle: creating new milestones, executing them through the standard pipeline, completing and archiving them, and starting the next one. Each milestone is a self-contained unit of work with its own requirements, roadmap, and verification.

**Core principle:** Milestones are sequential. Complete one fully before starting the next. No partial milestones, no parallel milestones.

## When to Use

- Starting a new milestone after completing a previous one
- A project has multiple planned milestones (v1, v2, v3, etc.)
- Need to archive completed milestone work
- Transitioning between major project phases
- User says "start next milestone" or "move to v2"

**When NOT to use:**
- Single-milestone projects (use standard lifecycle)
- Within a milestone (use `fresh-context-execution`)
- Quick fixes or small changes

## The Milestone Lifecycle

```
new-milestone
    │
    ▼
planning-and-task-breakdown
    │
    ▼
fresh-context-execution
    │
    ▼
code-review-and-quality
    │
    ▼
shipping-and-launch
    │
    ▼
complete-milestone
    │
    ▼
(new-milestone — loop)
```

## Step 1: New Milestone

When starting a new milestone:

### 1.1 Gather Milestone Goal

```bash
node scripts/agent-skills-state.js init --goal "Milestone [version]: [goal]"
```

Ask the user:
- What is the goal of this milestone?
- What are the key deliverables?
- Are there dependencies on the previous milestone?

### 1.2 Determine Version

```bash
node scripts/agent-skills-transition.js route .
```

The transition script checks for existing milestones in `.milestones/` and determines the next version.

### 1.3 Create Milestone Directory

```bash
mkdir -p .milestones/v[version]
```

### 1.4 Define Requirements

Write `.milestones/v[version]/REQUIREMENTS.md`:

```markdown
# Milestone [version] Requirements

## Goal
[One paragraph describing what this milestone achieves]

## Deliverables
- [ ] Deliverable 1
- [ ] Deliverable 2
- [ ] Deliverable 3

## Success Criteria
- [ ] All deliverables complete
- [ ] All tests pass
- [ ] No regressions from previous milestone
```

### 1.5 Create Roadmap

Write `.milestones/v[version]/ROADMAP.md`:

```markdown
# Milestone [version] Roadmap

## Phase 1: Foundation
- [ ] Task 1: ...
- [ ] Task 2: ...

## Phase 2: Core Features
- [ ] Task 3: ...
- [ ] Task 4: ...

## Phase 3: Polish
- [ ] Task 5: ...
- [ ] Task 6: ...
```

### 1.6 Initialize Phase Directories

```bash
node scripts/agent-skills-phase.js init .
```

This creates `tasks/phases/` with a default first phase.

### 1.7 Link to Previous Milestone (if applicable)

If this milestone builds on a previous one, reference the archived work:

```bash
# Check previous milestone's archived work
ls .milestones/v[previous]/
```

## Step 2: Execute Milestone

Once the milestone is set up, follow the standard pipeline:

1. **Plan:** `planning-and-task-breakdown` — break milestone into tasks
2. **Build:** `fresh-context-execution` — execute tasks with parallel subagents
3. **Review:** `code-review-and-quality` — review all changes
4. **Ship:** `shipping-and-launch` — commit and tag

### Phase Tracking

Use phase directories to track progress within a milestone:

```bash
# List phases
node scripts/agent-skills-phase.js list .

# Create a new phase
node scripts/agent-skills-phase.js create . build

# Mark phase as active
node scripts/agent-skills-phase.js activate . 02-build

# Complete a phase
node scripts/agent-skills-phase.js complete . 01-setup

# Check progress
node scripts/agent-skills-phase.js progress .
```

### Transition Between Phases

After completing a phase, check the transition route:

```bash
node scripts/agent-skills-transition.js route .
```

Routes:
- **Route A:** More phases → advance to next phase
- **Route B:** Last phase, no other workstreams → ready to complete milestone
- **Route B1:** Last phase, other workstreams active → block, show progress
- **Route C:** More milestones → advance to next milestone

## Step 3: Complete Milestone

When all phases are complete and all tasks pass verification:

### 3.1 Verify Completion

```bash
# Check phase progress
node scripts/agent-skills-phase.js progress .

# Verify all phases have SUMMARY.md
node scripts/agent-skills-transition.js route .
```

All phases must have `SUMMARY.md` files indicating completion.

### 3.2 Archive Milestone

```bash
node scripts/agent-skills-transition.js archive-milestone . v[version]
```

This:
- Creates `.milestones/v[version]/COMPLETED.md`
- Copies workstream state into the milestone archive
- Preserves all artifacts for future reference

### 3.3 Update State

```bash
node scripts/agent-skills-state.js transition done
node scripts/agent-skills-trace.js milestone.completed version=v[version]
```

### 3.4 Git Tag (if applicable)

```bash
git tag -a v[version] -m "Milestone [version] complete"
```

## Step 4: Start Next Milestone

After archiving, return to Step 1 for the next milestone:

```bash
# Check if more milestones are planned
node scripts/agent-skills-transition.js route .
# Returns route: 'C' if more milestones exist
```

## Multi-Workstream Milestones

For milestones with parallel workstreams (backend, frontend, infra):

### Create Workstreams

```bash
node scripts/agent-skills-workstream.js create backend-api --area backend
node scripts/agent-skills-workstream.js create frontend-dash --area frontend
node scripts/agent-skills-workstream.js create infrastructure --area infra
```

### Track Progress

```bash
# Check workstream progress
node scripts/agent-skills-workstream.js status

# Check for collisions
node scripts/agent-skills-workstream.js check-collision
```

### Transition with Workstreams

When a workstream completes, check if others are still active:

```bash
node scripts/agent-skills-transition.js route .
# Returns route: 'B1' if other workstreams are active
```

**Route B1:** This workstream is done, but others are still running. Show progress and wait.

## Milestone Directory Structure

```
.milestones/
  v1/
    REQUIREMENTS.md    # What this milestone achieves
    ROADMAP.md         # How we'll get there
    COMPLETED.md       # Archive marker (written on completion)
    workstreams/       # Archived workstream state
  v2/
    REQUIREMENTS.md
    ROADMAP.md
tasks/
  phases/
    01-setup/
      PLAN.md
      SUMMARY.md
    02-build/
      PLAN.md
      SUMMARY.md
  STATE.md             # Current lifecycle state
  plan.md              # Current milestone plan
```

## Verification

After each milestone transition:

- [ ] Previous milestone fully archived with COMPLETED.md
- [ ] New milestone has REQUIREMENTS.md and ROADMAP.md
- [ ] Phase directories initialized
- [ ] State updated to reflect current milestone
- [ ] Git tag created (if applicable)
- [ ] No orphaned worktrees from previous milestone

## Red Flags

- Starting a new milestone before completing the current one
- Multiple milestones in progress simultaneously
- Missing COMPLETED.md in archived milestones
- Phase directories not initialized for new milestone
- State not updated after transition

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll just skip the archive step" | Archived milestones preserve context for future reference and debugging. |
| "We can work on two milestones at once" | Parallel milestones create merge conflicts and context confusion. Complete one first. |
| "The old milestone doesn't need a tag" | Tags mark exact completion points. Without them, you can't know what "done" looked like. |
| "Phase tracking is overhead" | Phase tracking shows progress and enables recovery. Without it, you lose visibility. |

## Next Step

After completing a milestone and starting the next one, **automatically invoke `agent-skills:planning-and-task-breakdown`** to break the new milestone into tasks.

```
New milestone created → invoke planning-and-task-breakdown
```
