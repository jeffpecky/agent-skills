---
name: fresh-context-execution
description: Execute all phases using fresh-context subagents to prevent context rot. Automatically parallelizes independent tasks. Use when running any multi-step command (/spec, /plan, /build auto, /test verify, /review), when session context is degrading, or when you want structural context isolation. The orchestrator stays lean — subagents do the heavy work.
---

# Fresh-Context Execution

## Overview

The entire Agent Skills workflow uses **fresh-context subagents** to structurally prevent context rot. Each phase dispatches specialized subagents with clean context windows. The orchestrator (your main session) stays lean — it only coordinates, collects results, and routes to the next phase.

**Automatic parallelism:** Independent tasks run concurrently. Dependent tasks run sequentially. The system decides — you don't.

This is GSD Core's central insight applied to Agent Skills: *most work in a coding session does not need to happen in the main context at all.* Research, planning, code writing, and verification are each discrete, bounded tasks. Each can be handed to a specialized subagent that starts with a clean context window and reports its result back to a thin orchestrator.

## The Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  ORCHESTRATOR (your main session — stays lean throughout)           │
│                                                                     │
│  /spec  → dispatch researcher    → collect research report          │
│  /plan  → dispatch planner       → collect plan                     │
│         → dispatch plan-checker  → verify plan                      │
│  /build → dispatch executors     → collect reports per task         │
│  /test  → dispatch verifier      → collect verification             │
│  /review→ dispatch 3 reviewers   → synthesize reports               │
│  /ship  → create PR, archive                                         │
│                                                                     │
│  Context growth: minimal (only coordination overhead)               │
└────────┬────────────────────────────────────────────────────────────┘
         │
         │  Each arrow = fresh subagent with clean context
         ▼
┌──────────────────────────────────────────────────────────────────────┐
│  STATE FILE (tasks/STATE.md — persists across sessions)             │
│                                                                      │
│  • Current phase, spec path, plan path, progress table              │
│  • Read by every subagent at start                                   │
│  • Updated by orchestrator after each phase completes                │
│  • Survives session restarts — resume from last known state          │
└──────────────────────────────────────────────────────────────────────┘
```

## Parallel vs Sequential Execution

The system automatically determines execution mode based on task dependencies:

```
Dependency Analysis
    │
    ├── Tasks A, B, C (no dependencies) → PARALLEL
    ├── Task D (depends on A) → SEQUENTIAL (after A)
    └── Tasks E, F (no dependencies) → PARALLEL
```

**When tasks are independent:**
- Run in parallel (same wave)
- Each gets its own worktree
- Faster completion

**When tasks are dependent:**
- Run sequentially (different waves)
- Later waves wait for earlier waves
- Correct execution order

**You don't decide** — the dependency analyzer determines the execution plan.

## Phase-by-Phase Subagent Dispatch

### /spec — Research + Spec

| Subagent | Purpose | Produces |
|----------|---------|----------|
| `researcher` | Investigates codebase, patterns, dependencies | `tasks/research.md` |

The researcher starts with a clean window, explores the codebase, and writes a structured report. The orchestrator reads the report and uses it to ask the user informed questions. No codebase details accumulate in the orchestrator's context.

### /plan — Plan + Verify

| Subagent | Purpose | Produces |
|----------|---------|----------|
| `planner` | Creates detailed implementation plan | `tasks/plan.md` |
| `plan-checker` | Verifies plan quality before execution | `tasks/plan-check.md` |

The planner starts with a clean window containing the spec and research report. It produces a detailed plan with exact code and file paths. The plan-checker starts with its own clean window and verifies the plan will actually work — before any code is written.

### /build auto — Execute (Wave-Based Parallel)

| Subagent | Purpose | Produces |
|----------|---------|----------|
| `task-executor` (per task) | Implements one task with TDD | `tasks/reports/task-{N}-report.md` |

**Pre-Execution Validation**

Before executing waves, validate the plan:

```bash
node scripts/agent-skills-dependency.js validate tasks/plan.md
```

**If validation fails:**
- Dependency cycles → STOP, fix plan
- File overlap → WARNING, consider sequential execution for overlapping tasks

**If validation passes:**
- Proceed with wave execution

**Model Resolution**

Each subagent gets the optimal model based on its role. Configure in `tasks/config.json`:

```json
{
  "roles": {
    "planner": { "model": "claude-opus-4-7", "effort": "high" },
    "executor": { "model": "claude-sonnet-4-6", "effort": "medium" },
    "verifier": { "model": "claude-opus-4-7", "effort": "high" }
  }
}
```

If no config exists, all roles default to the orchestrator's current model.

When spawning subagents, read the role's model from config:

```bash
ROLE_CONFIG=$(bash scripts/resolve-model.sh "$ROLE" tasks/config.json)
MODEL=$(echo "$ROLE_CONFIG" | grep -o '"model":"[^"]*"' | cut -d'"' -f4)
```

**Adaptive Prompt Enrichment**

Prompts adapt based on the model's context window size:

| Context Window | Strategy | Effect |
|----------------|----------|--------|
| >=500K | Rich | Include prior summaries, cross-phase context, research reports |
| 200K-500K | Standard | Full prompt as-is |
| <200K | Thinned | Omit extended examples, load on-demand via @-references |

Detect context window from config or model metadata:

```bash
CONTEXT_WINDOW=$(cat tasks/config.json | grep '"context_window"' | grep -o '[0-9]*' 2>/dev/null || echo "200000")
ADAPTED_PROMPT=$(bash scripts/adapt-prompt.sh "$CONTEXT_WINDOW" "tasks/prompt-$ROLE.md" "$ROLE")
```

**Wave Execution**

1. Run `node scripts/agent-skills-dependency.js compute-waves tasks/plan.md`
2. Parse the JSON output to get wave assignments
3. Use the programmatic scheduler (`scripts/agent-skills-scheduler.js`) for wave-based parallel execution with progress tracking
4. Within each wave, execute tasks in parallel (if no file overlap)

**Worktree isolation:** Each parallel task gets its own git worktree (via `using-git-worktrees`) to prevent file conflicts. Configurable via `tasks/config.json` (`use_worktrees: true/false`).

**Safety checks before execution:**
```bash
# Clean up orphaned worktrees from prior sessions
node scripts/agent-skills-transition.js clean-orphans .

# Check for git stash (forbidden in worktrees — corrupts parallel work)
node scripts/agent-skills-transition.js stash-check .

# Verify CWD is primary worktree (not inside a worktree)
node scripts/agent-skills-transition.js cwd-guard .
```
- Check for submodule paths (disable worktrees if tasks touch submodules)
- Check HEAD divergence (auto-degrade to sequential if HEAD diverged)

**Each subagent gets:**
1. A fresh LLM context window (prevents context rot)
2. Its own git worktree via `using-git-worktrees` (prevents file conflicts)
3. A task brief with requirements, acceptance criteria, and file paths

**The orchestrator:**
1. Runs dependency validation and wave computation via `agent-skills-dependency.js`
2. For each wave: creates worktrees, dispatches subagents in parallel, collects reports
3. After wave completes: merges worktree branches and cleans up:
   ```bash
   # Merge each worktree branch into main
   node scripts/agent-skills-transition.js merge-worktree . <branch-name>
   
   # Clean up orphaned worktrees
   node scripts/agent-skills-transition.js clean-orphans .
   
   # Update shared state after all merges (batch-locked)
   echo '{"STATE.md": {"action": "write", "content": "..."}}' | \
     node scripts/agent-skills-transition.js post-wave-update . "STATE.md,progress.md"
   ```
4. Updates progress ledger after each wave

## Agent Task Structure

Each subagent receives a focused task brief:

```
Task: Fix authentication tests

Area: backend
Scope: src/auth/authentication.test.ts
Goal: Make all 3 failing tests pass
Constraints: Do not modify other files

Skills to use:
- debugging-and-error-recovery (diagnose root cause)
- test-driven-development (fix approach)

Acceptance Criteria:
- [ ] All 3 tests pass
- [ ] No regressions in other tests
- [ ] Root cause identified and fixed

Verification: Run full test suite and confirm all tests pass.

Return: Summary of root cause, changes made, and test results.
```

**Key principles:**
- **Focused scope** — One file, one subsystem, one feature
- **Clear goal** — Make these tests pass / implement this feature
- **Constraints** — Don't change other code
- **Specific output** — What should the agent return?
- **Skill routing** — Which skill to invoke for this task
- **Acceptance criteria** — Specific, verifiable conditions for completion
- **Verification** — How to confirm the task is complete

## Parallel Execution Integration

When multiple tasks are independent, the system automatically:

1. **Groups tasks by wave** — Tasks with no dependencies run together
2. **Groups tasks by area** — Backend, frontend, infra tasks can run in parallel across areas
3. **Creates worktrees** — Each task gets isolated file access
4. **Dispatches in parallel** — Multiple subagents run concurrently
5. **Collects results** — Reports are gathered from each subagent
6. **Merges changes** — Worktree branches are integrated
7. **Runs full test suite** — Validates no conflicts

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

#### Workstream Execution Flow

```bash
# 1. Create workstreams for each area
node scripts/agent-skills-workstream.js create backend-api --area backend
node scripts/agent-skills-workstream.js create frontend-dash --area frontend
node scripts/agent-skills-workstream.js create infrastructure --area infra

# 2. Add cross-area dependencies
node scripts/agent-skills-workstream.js add-dependency backend-api frontend-dash

# 3. Get execution plan (waves, order)
node scripts/agent-skills-workstream.js execution-plan

# 4. Select active workstream and execute
node scripts/agent-skills-workstream.js select backend-api
# Then run /build for backend tasks
```

#### Cross-Area Coordination

When areas have dependencies:

```
backend Task C depends on frontend Task D
→ frontend wave 1 must complete before backend wave 2
→ system automatically sequences across areas
```

The workstream manager tracks:
- Which areas are complete
- Which areas are blocked by dependencies
- When to start dependent work

#### Workstream Task Briefs

Each workstream gets its own task briefs with area context:

```
Task: Implement payment API endpoint

Area: backend-api
Workstream: backend-api
Scope: src/api/payments/
Goal: Create POST /api/payments endpoint
Constraints: Use existing auth middleware, follow REST conventions

Skills to use:
- api-and-interface-design (contract-first)
- test-driven-development (implementation)

Acceptance Criteria:
- [ ] POST /api/payments creates payment record
- [ ] Input validation matches API spec
- [ ] Auth middleware integrated
- [ ] Tests pass

Verification: Run payment tests and confirm all pass.

Return: Summary of implementation, API contract, and test results.
```

### Single-Area Projects

For single-area projects, use the standard flow:

```
Area: backend (parallel within area):
  Wave 1:
    ├── Task A: Fix auth tests (worktree 1)
    └── Task B: Fix payment tests (worktree 2)
  Wave 2:
    └── Task C: Update auth API (worktree 3)
```

## Programmatic Scheduler

The task scheduler (`scripts/agent-skills-scheduler.js`) provides wave-based parallel execution with progress tracking.

### Dispatch Flow

1. Read the PLAN.md to extract tasks and dependencies
2. Run dependency resolver to compute waves: `node scripts/agent-skills-dependency.js resolve PLAN.md`
3. Dispatch each wave using the scheduler:
   ```bash
   # Dispatch all tasks
   node scripts/agent-skills-scheduler.js dispatch PLAN.md
   
   # Check progress
   node scripts/agent-skills-scheduler.js progress
   
   # Check specific task status
   node scripts/agent-skills-scheduler.js status
   ```

### Progress Tracking

The scheduler maintains progress in `tasks/progress/`:
- `{task-id}.status` — JSON file with status, timestamp, and optional error

Status values:
- `pending` — Not started
- `running` — Currently executing
- `complete` — Finished successfully
- `failed` — Failed with error
- `blocked` — Blocked by dependency failure
- `cancelled` — Cancelled by user

### Retry Logic

Failed tasks can be retried:
```bash
node scripts/agent-skills-scheduler.js retry <task-id>
```

The scheduler will re-dispatch the task with a fresh context.

### /test verify — Verify

| Subagent | Purpose | Produces |
|----------|---------|----------|
| `verifier` | Checks goal achievement against spec | `tasks/verification.md` |

The verifier starts with a clean window containing the spec and plan. It checks whether the implementation actually achieves the spec goals — not just whether tests pass. Evidence-based verification with specific citations.

### /review — Review

| Subagent | Purpose | Produces |
|----------|---------|----------|
| `code-reviewer` | Five-axis code review | Review report |
| `security-auditor` | Security and vulnerability pass | Audit report |
| `test-engineer` | Test coverage analysis | Coverage report |

Three specialist subagents run in parallel with fresh context. The orchestrator synthesizes their reports into a single go/no-go decision.

## Shared State: tasks/STATE.md

The state file is the backbone of the system. It:
- **Persists across sessions** — restart doesn't lose progress
- **Coordinates between commands** — each command knows what the others did
- **Enables recovery** — check progress ledger + git log after compaction
- **Lives on disk** — not in conversation memory

Every subagent reads state at startup. The orchestrator updates state after each phase.

## When to Use

**ALWAYS.** Every task gets a fresh subagent — no exceptions. This is the zero-tolerance approach to context rot prevention.

| Scenario | Approach |
|----------|----------|
| 1 task | Fresh-context subagent (even for 1 task) |
| 2 tasks | Fresh-context subagent per task |
| 3+ tasks | Fresh-context subagent per task |
| Long session, quality degrading | Fresh-context subagent (prevention) |

## Advantages Over Inline Execution

| Aspect | Inline (all in one session) | Fresh-Context Subagents |
|--------|---------------------------|------------------------|
| Context rot | Accumulates across all phases | Structurally prevented — each phase starts clean |
| Quality degradation | Gets worse with each phase | Consistent — every phase at full capacity |
| Session recovery | Must re-explain everything | STATE.md + disk state survives |
| Cross-command coordination | None (commands are independent) | STATE.md links all phases |
| Research quality | Limited by what orchestrator already knows | Researcher explores from scratch |
| Plan quality | Limited by orchestrator's context | Planner gets clean window + research |
| Verification depth | Orchestrator checks what it remembers | Verifier checks every requirement |

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "Subagent overhead is too expensive" | Context rot causing rework is more expensive. One bad decision due to degraded context cascades into hours of debugging. |
| "It's faster to do it all inline" | It *feels* faster until the verifier misses a requirement because it's buried in history. |
| "My context is fine, I don't need this" | Context rot is silent. You don't notice until quality degrades. Prevention is cheaper than recovery. |
| "The spec phase is short, no need for a subagent" | The researcher gives you codebase context without polluting your session. Even short phases benefit. |
| "I'll just compact when context gets full" | Compaction loses nuance. Fresh subagents start with perfect clarity. |

## Red Flags

- More than 3 tasks executed inline without subagent dispatch
- Orchestrator writing implementation code instead of coordinating
- Subagent receiving the full conversation history instead of its brief
- State file not updated after phase completion
- Subagent dispatched without explicit model selection
- Multiple phases collapsed into one subagent
- No research phase before spec
- No plan verification before execution

## Durable Artifacts and Trace

Follow `references/artifact-contracts.md` for canonical output paths. In standalone mode, use:

- `tasks/research.md`
- `tasks/plan.md`
- `tasks/briefs/task-{N}-brief.md`
- `tasks/reports/task-{N}-report.md`
- `tasks/progress.md`
- `tasks/verification.md`
- `tasks/review.md`
- `tasks/STATE.md`

Use `tasks/` for `agent-skills` pipeline artifacts. Do not write to `.planning/`; that is GSD Core's project substrate and is intentionally out of scope.

When tracing is requested or `tasks/trace.jsonl` exists, append events following `references/pipeline-tracing.md`.

## Verification

After completing all phases via fresh-context execution:

- [ ] Each phase dispatched its designated subagent(s)
- [ ] Each subagent received a complete brief (not conversation history)
- [ ] Each subagent wrote its report to disk
- [ ] STATE.md is complete and accurate
- [ ] All tests pass across all tasks
- [ ] Build succeeds
- [ ] Orchestrator context remained lean throughout
- [ ] Session could be resumed from STATE.md alone

## Next Step

After all tasks complete via fresh-context execution, **automatically invoke `agent-skills:code-review-and-quality`** to review the changes.

```
All tasks done → invoke code-review-and-quality
```
