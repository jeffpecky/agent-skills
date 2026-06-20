---
name: user-acceptance-testing
description: Conversational acceptance testing with persistent state. Use after verification passes and the implementation is technically complete, before considering the task fully done.
---

# User Acceptance Testing

## Overview

Conversational acceptance testing that validates the implementation meets the user's actual needs. State persists across sessions — you can resume where you left off after /clear.

**Philosophy:** Show expected, ask if reality matches. One test at a time.

## When to Use

- After verification passes and the implementation is technically complete
- Before considering the task fully done
- When you need to confirm the user's intent was satisfied

## Quick Start

### List Active Sessions

```bash
bash scripts/uat-state.sh list
```

### Create New Session

```bash
bash scripts/uat-state.sh create <phase>
```

### Resume Session

```bash
bash scripts/uat-state.sh resume <phase>
```

## UAT Workflow

### 1. Check for Active Sessions

Before starting, check if UAT sessions already exist:

```bash
bash scripts/uat-state.sh list
```

If sessions exist, offer to resume or start new.

### 2. Conduct Conversational UAT

Ask the user targeted questions one at a time:

```
Let's verify the implementation meets your needs:

1. **Original Intent**: Does the implementation do what you originally asked for?
2. **Edge Cases**: Are there any scenarios you'd like me to test?
3. **Behavior**: Does the behavior match your expectations?
4. **Missing Features**: Is there anything you expected that isn't included?
5. **Approval**: Do you approve this implementation for use?
```

### 3. Record UAT Results

After each test, update the UAT file:

```bash
bash scripts/uat-state.sh update <phase> <test-number> PASS
# or
bash scripts/uat-state.sh update <phase> <test-number> FAIL
```

### 4. Handle UAT Failures

If UAT fails, collect gaps for planning:

```bash
bash scripts/uat-gap-collect.sh <phase>
```

Feed gaps back into `planning-and-task-breakdown`:

```bash
# Add gaps to plan
cat tasks/reports/uat-gaps-phase-*.md >> tasks/plan.md
```

### 5. Final Approval

Once UAT passes:

1. Update the UAT report with final approval
2. Mark the task as fully complete in STATE.md
3. Archive the implementation artifacts

## Session Resumption

UAT state survives /clear because it's stored on disk:

```
tasks/reports/
  04-comments-UAT.md    ← Phase 4 UAT (in progress)
  05-auth-UAT.md        ← Phase 5 UAT (completed)
```

Each file has frontmatter with status and current test:

```yaml
---
phase: 04-comments
status: testing
current_test: "3. Reply to Comment"
created: 2026-06-20T10:00:00Z
updated: 2026-06-20T10:30:00Z
---
```

When resuming, read the frontmatter and continue from the current test.

## Integration with Pipeline

```
verification passes → UAT → gaps feed back → plan-phase --gaps → execute → re-UAT
```

UAT failures become new tasks in the planning phase, ensuring nothing slips through.
