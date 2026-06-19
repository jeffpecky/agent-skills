---
name: fresh-context-execution
description: Execute all phases using fresh-context subagents to prevent context rot. Use when running any multi-step command (/spec, /plan, /build auto, /test verify, /review), when session context is degrading, or when you want structural context isolation. The orchestrator stays lean — subagents do the heavy work.
---

# Fresh-Context Execution

## Overview

The entire Agent Skills workflow uses **fresh-context subagents** to structurally prevent context rot. Each phase dispatches specialized subagents with clean context windows. The orchestrator (your main session) stays lean — it only coordinates, collects results, and routes to the next phase.

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

**Wave-based execution:** Tasks are grouped into waves based on dependencies. Tasks within a wave have NO dependencies on each other and run in parallel. Waves execute sequentially — Wave N+1 waits for Wave N.

**Worktree isolation:** Each parallel task gets its own git worktree (via `using-git-worktrees`) to prevent file conflicts. Configurable via `tasks/config.json` (`use_worktrees: true/false`).

**Safety checks before execution:**
- Clean up orphaned worktrees from prior sessions
- Check for submodule paths (disable worktrees if tasks touch submodules)
- Check HEAD divergence (auto-degrade to sequential if HEAD diverged)

```
Wave 1 (parallel):
    ├── Task 1 → [subagent in worktree-1] → report
    ├── Task 2 → [subagent in worktree-2] → report
    └── Task 3 → [subagent in worktree-3] → report
    ↓ (all complete)
Wave 2 (parallel):
    ├── Task 4 → [subagent in worktree-4] → report
    └── Task 5 → [subagent in worktree-5] → report
    ↓ (all complete)
Wave 3 (sequential — depends on Wave 2):
    └── Task 6 → [subagent in worktree-6] → report
```

**Each subagent gets:**
1. A fresh LLM context window (prevents context rot)
2. Its own git worktree via `using-git-worktrees` (prevents file conflicts)
3. A task brief with requirements, acceptance criteria, and file paths

**The orchestrator:**
1. Reads the plan and extracts wave structure
2. For each wave: creates worktrees, dispatches subagents in parallel, collects reports
3. After wave completes: merges worktree branches, cleans up worktrees
4. Updates progress ledger after each wave

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
