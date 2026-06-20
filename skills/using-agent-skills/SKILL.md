---
name: using-agent-skills
description: Discovers and invokes agent skills. Use when starting a session or when you need to discover which skill applies to the current task. This is the meta-skill that governs how all other skills are discovered and invoked.
---

# Using Agent Skills

<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, skip this skill.
</SUBAGENT-STOP>

<EXTREMELY-IMPORTANT>
If you think there is even a 1% chance a skill might apply to what you are doing, you ABSOLUTELY MUST invoke the skill.

IF A SKILL APPLIES TO YOUR TASK, YOU DO NOT HAVE A CHOICE. YOU MUST USE IT.

This is not negotiable. This is not optional. You cannot rationalize your way out of this.
</EXTREMELY-IMPORTANT>

## Overview

Agent Skills is a collection of engineering workflow skills organized by development phase. Each skill encodes a specific process that senior engineers follow. This meta-skill helps you discover and apply the right skill for your current task.

## The Rule

**Invoke relevant or requested skills BEFORE any response or action.** Even a 1% chance a skill might apply means that you should invoke the skill to check. If an invoked skill turns out to be wrong for the situation, you don't need to use it.

`using-agent-skills` is the commandless orchestrator. The user should not need to run `/spec`, `/plan`, `/build`, `/test`, `/review`, or `/ship`. Those commands are optional shortcuts for platforms that support slash commands. In normal use, the user says what they want once, this meta-skill routes the work, and the lifecycle auto-chains end-to-end.

Core enforcement rules:

1. If a task matches a skill, you MUST invoke it.
2. Never implement directly if a skill applies.
3. Always follow the skill instructions exactly. Do not partially apply them.
4. Only proceed to implementation after required lifecycle steps are complete.
5. A task is not complete until its verification evidence exists.

## Red Flags — STOP, You're Rationalizing

These thoughts mean you're about to skip a skill. Stop and invoke it.

| Thought | Reality |
|---------|---------|
| "This is just a simple question" | Questions are tasks. Check for skills. |
| "I need more context first" | Skill check comes BEFORE context gathering. |
| "Let me explore the codebase first" | Skills tell you HOW to explore. Check first. |
| "This doesn't need a formal skill" | If a skill exists, use it. |
| "I'll just do this one thing first" | Check BEFORE doing anything. |
| "The skill is overkill" | Simple things become complex. Use it. |
| "I know what I'm doing" | Knowing the concept ≠ using the skill. Invoke it. |
| "I can skip this step" | Skills are workflows, not suggestions. Follow every step. |

## How to Invoke Skills

Use your platform's skill-loading mechanism:

- **Claude Code:** Use the `Skill` tool
- **Codex:** Skills load natively
- **Gemini CLI:** Use `activate_skill` tool
- **Other platforms:** Check your platform's documentation

## Skill Discovery

**Two routing paths:**

### Path 1: Non-trivial work (features, projects, significant changes)

ALWAYS follow the chain. Interview-me is MANDATORY:

```
User says "build X"
    │
    ▼
interview-me (MANDATORY — understand what they really want)
    │
    ├── Intent vague ──→ idea-refine ──→ spec-driven-development
    │                                        │
    └── Intent concrete ──→ spec-driven-development
                                        │
                                        ▼
                          planning-and-task-breakdown
                                        │
                                        ▼
                          fresh-context-execution
                          (wave-based parallel + worktree isolation)
                          ├── Wave 1: parallel tasks in worktrees
                          ├── Wave 2: parallel tasks in worktrees
                          └── Wave N: sequential if needed
                                        │
                                        ▼
                          code-review-and-quality
                                        │
                                        ▼
                              shipping-and-launch (DONE)
```

### Path 2: Quick tasks (single-line fixes, typos, small changes)

Use the flowchart to route directly to the right skill. No interview needed.

| Intent | Skill |
|--------|-------|
| Fix a bug | `debugging-and-error-recovery` |
| Write a test | `test-driven-development` |
| Review code | `code-review-and-quality` |
| Simplify code | `code-simplification` |
| Add security | `security-and-hardening` |
| Optimize perf | `performance-optimization` |
| Commit/branch | `git-workflow-and-versioning` |
| Add CI/CD | `ci-cd-and-automation` |
| Deprecate code | `deprecation-and-migration` |
| Write docs | `documentation-and-adrs` |
| Add logging | `observability-and-instrumentation` |
| Deploy | `shipping-and-launch` |

For compact routing, use `skills/skill-router/scripts/skill-index.json`.

## Conditional Skill Checkpoints

Pipeline skills are the backbone, but specialist skills must fire whenever their trigger appears. Run this checkpoint before each lifecycle phase, before each task-executor dispatch, after any test/build/browser run, and whenever new evidence changes the shape of the work.

| Trigger | Invoke | Where It Usually Fires |
|---------|--------|------------------------|
| Tests fail, build breaks, runtime output is unexpected, bug report arrives, logs/console show errors | `debugging-and-error-recovery` | Any phase; this is a stop-the-line interrupt |
| Designing endpoints, module boundaries, public interfaces, frontend/backend contracts, component props, or changing observable behavior | `api-and-interface-design` | Spec, plan, build, review |
| Building or modifying user-facing pages/components/layouts/interactions/state | `frontend-ui-engineering` | Spec, plan, build, review |
| Browser behavior needs proof, UI looks wrong, console/network/runtime state matters | `browser-testing-with-devtools` | Build, verify, debug |
| User input, auth, authorization, secrets, data storage, external service responses, or sensitive config are involved | `security-and-hardening` | Spec, plan, build, review, ship |
| Performance requirement exists, page feels slow, Core Web Vitals matter, or code changes hot paths | `performance-optimization` | Plan, build, verify, review |
| Framework/library correctness matters or current knowledge may be stale | `source-driven-development` | Spec, plan, build |
| Production behavior needs visibility through logs, metrics, traces, or alerts | `observability-and-instrumentation` | Plan, build, ship |
| Code works but is harder to understand than necessary | `code-simplification` | After green tests, review |

Specialist skills do not replace the lifecycle. They are nested into it, then control returns to the current phase.

Example:

```text
fresh-context-execution task: "Add POST /api/tasks and TaskForm"
  ↓
conditional checkpoint detects API surface → api-and-interface-design
  ↓
conditional checkpoint detects user-facing UI → frontend-ui-engineering
  ↓
test-driven-development implements behavior
  ↓
tests fail unexpectedly → debugging-and-error-recovery
  ↓
resume fresh-context-execution after verification passes
```

## Lifecycle Kernel

Agent Skills remains Markdown-first, but non-trivial lifecycle runs use a small Node kernel for enforceable state, trace, and gates. This makes workflow claims testable instead of relying only on model compliance.

Use these helpers when available:

```bash
node scripts/agent-skills-state.js init --goal "<goal>"
node scripts/agent-skills-state.js transition spec|plan|build|verify|review|ship|done
node scripts/agent-skills-trace.js skill.invoked skill=<skill-name>
node scripts/agent-skills-pipeline.js validate
```

The kernel owns:

- `tasks/STATE.md` as the current lifecycle checkpoint.
- `tasks/trace.jsonl` as ordered evidence of skill, persona, command, artifact, verification, and review events.
- Pipeline validation before review and ship.
- **Multi-file atomic state updates** via `agent-skills-planning-lock.js` (wraps STATE.md, progress.md, plan.md, trace.jsonl in a single lock):

```javascript
const { withPlanningLock } = require('./scripts/agent-skills-planning-lock.js');
await withPlanningLock(projectDir, async (ctx) => {
  const state = ctx.read('STATE.md');
  ctx.write('STATE.md', state.replace('build', 'verify'));
  ctx.write('progress.md', updatedProgress);
});
```

Tracing is not just for tests. Tests consume the trace to prove the pipeline, but the trace is also the runtime audit log for humans and future agents.

### Commandless Kernel Protocol

For non-trivial work, do this without waiting for slash commands:

1. Initialize state and trace before the first lifecycle skill:

```bash
node scripts/agent-skills-state.js init --goal "<user goal>"
node scripts/agent-skills-trace.js pipeline.started goal="<user goal>"
```

2. Before invoking each lifecycle skill, trace it:

```bash
node scripts/agent-skills-trace.js skill.invoked skill=<skill-name>
```

3. When entering each phase, update state:

```bash
node scripts/agent-skills-state.js transition spec
node scripts/agent-skills-state.js transition plan
node scripts/agent-skills-state.js transition build
node scripts/agent-skills-state.js transition verify
node scripts/agent-skills-state.js transition review
node scripts/agent-skills-state.js transition ship
```

4. When a lifecycle artifact is written, trace it:

```bash
node scripts/agent-skills-trace.js artifact.written path=SPEC.md
node scripts/agent-skills-trace.js artifact.written path=tasks/plan.md
node scripts/agent-skills-trace.js artifact.written path=tasks/reports/task-1-report.md
```

5. Before claiming the lifecycle is done, validate the pipeline and then close it:

```bash
node scripts/agent-skills-pipeline.js validate
node scripts/agent-skills-state.js transition done
node scripts/agent-skills-trace.js pipeline.completed verdict=GO
```

If validation fails, do not claim completion. Fix the missing artifact, failed verification, or trace gap; or record the blocker:

```bash
node scripts/agent-skills-trace.js pipeline.blocked reason="<blocker>"
```

### How to decide which path:

```
Is this a feature, project, or significant change?
├── YES → Path 1 (chain, interview-me first)
└── NO → Path 2 (flowchart, route directly)
```

## Core Operating Behaviors

These behaviors apply at all times, across all skills. They are non-negotiable.

### 1. Surface Assumptions

Before implementing anything non-trivial, explicitly state your assumptions:

```
ASSUMPTIONS I'M MAKING:
1. [assumption about requirements]
2. [assumption about architecture]
3. [assumption about scope]
→ Correct me now or I'll proceed with these.
```

Don't silently fill in ambiguous requirements. The most common failure mode is making wrong assumptions and running with them unchecked. Surface uncertainty early — it's cheaper than rework.

### 2. Manage Confusion Actively

When you encounter inconsistencies, conflicting requirements, or unclear specifications:

1. **STOP.** Do not proceed with a guess.
2. Name the specific confusion.
3. Present the tradeoff or ask the clarifying question.
4. Wait for resolution before continuing.

**Bad:** Silently picking one interpretation and hoping it's right.
**Good:** "I see X in the spec but Y in the existing code. Which takes precedence?"

### 3. Push Back When Warranted

You are not a yes-machine. When an approach has clear problems:

- Point out the issue directly
- Explain the concrete downside (quantify when possible — "this adds ~200ms latency" not "this might be slower")
- Propose an alternative
- Accept the human's decision if they override with full information

Sycophancy is a failure mode. "Of course!" followed by implementing a bad idea helps no one. Honest technical disagreement is more valuable than false agreement.

### 4. Enforce Simplicity

Your natural tendency is to overcomplicate. Actively resist it.

Before finishing any implementation, ask:
- Can this be done in fewer lines?
- Are these abstractions earning their complexity?
- Would a staff engineer look at this and say "why didn't you just..."?

If you build 1000 lines and 100 would suffice, you have failed. Prefer the boring, obvious solution. Cleverness is expensive.

### 5. Maintain Scope Discipline

Touch only what you're asked to touch.

Do NOT:
- Remove comments you don't understand
- "Clean up" code orthogonal to the task
- Refactor adjacent systems as a side effect
- Delete code that seems unused without explicit approval
- Add features not in the spec because they "seem useful"

Your job is surgical precision, not unsolicited renovation.

### 6. Verify, Don't Assume

Every skill includes a verification step. A task is not complete until verification passes. "Seems right" is never sufficient — there must be evidence (passing tests, build output, runtime data).

## Failure Modes to Avoid

These are the subtle errors that look like productivity but create problems:

1. Making wrong assumptions without checking
2. Not managing your own confusion — plowing ahead when lost
3. Not surfacing inconsistencies you notice
4. Not presenting tradeoffs on non-obvious decisions
5. Being sycophantic ("Of course!") to approaches with clear problems
6. Overcomplicating code and APIs
7. Modifying code or comments orthogonal to the task
8. Removing things you don't fully understand
9. Building without a spec because "it's obvious"
10. Skipping verification because "it looks right"

## Skill Rules

1. **Check for an applicable skill before starting work.** Skills encode processes that prevent common mistakes.

2. **Skills are workflows, not suggestions.** Follow the steps in order. Don't skip verification steps.

3. **Multiple skills can apply.** A feature implementation might involve `idea-refine` → `spec-driven-development` → `planning-and-task-breakdown` → `fresh-context-execution` → `test-driven-development` → `code-review-and-quality` → `code-simplification` → `shipping-and-launch` in sequence.

4. **When in doubt, start with interview-me.** If the task is non-trivial, ALWAYS start with `interview-me` to understand what the user really wants. Then chain to spec.

5. **AUTO-CHAIN: Skills chain to the next skill automatically.** Each skill's "Next Step" section tells you which skill to invoke next. Do NOT wait for the user to run a command — chain directly. The user says "build X" once, and the whole pipeline runs.

6. **Commands are optional.** Slash commands are convenience entry points only. They must not be required for end-to-end behavior.

## Lifecycle Sequence

For a complete feature, the main pipeline chains automatically. Conditional/during-build skills are invoked when needed — they don't chain.

### Main Pipeline (auto-chains):

```
User says "build X"
    │
    ▼
interview-me (MANDATORY — understand what they really want)
    │
    ├── Intent vague ──→ idea-refine ──→ spec-driven-development
    │                                        │
    └── Intent concrete ──→ spec-driven-development
                                        │
                                        ▼
                          planning-and-task-breakdown
                                        │
                                        ▼
                          fresh-context-execution
                          (wave-based parallel + worktree isolation)
                          ├── Wave 1: parallel tasks in worktrees
                          ├── Wave 2: parallel tasks in worktrees
                          └── Wave N: sequential if needed
                                        │
                                        ▼
                          code-review-and-quality
                                        │
                                        ▼
                              shipping-and-launch (DONE)
```

**Wave-based parallel execution with worktree isolation.** Tasks within a wave run in parallel, each in its own worktree. Waves execute sequentially. Zero tolerance for context rot and file conflicts.

**The only exception:** Single-line fixes, typo corrections, or changes where requirements are unambiguous. For everything else — interview first.

### Standalone skills (invoked when needed, don't chain):

| Skill | Invoked When |
|-------|-------------|
| context-engineering | Orchestrator loads context before dispatching subagents |
| source-driven-development | Using frameworks/libs during implementation |
| test-driven-development | Runs inside each task executor |
| doubt-driven-development | High stakes / unfamiliar code during build |
| observability-and-instrumentation | Shipping to production |
| frontend-ui-engineering | Building UI |
| api-and-interface-design | Designing APIs |
| browser-testing-with-devtools | UI/browser verification |
| debugging-and-error-recovery | Tests fail or bugs found |
| code-simplification | Code is complex |
| security-and-hardening | Handling auth/data/input |
| performance-optimization | Performance requirements exist |
| git-workflow-and-versioning | During each commit |
| ci-cd-and-automation | Setting up pipelines |
| deprecation-and-migration | Retiring old systems |
| documentation-and-adrs | Documenting decisions |

### Meta skills (not pipeline steps):

| Skill | Purpose |
|-------|---------|
| using-agent-skills | Routing + 1% enforcement (this skill) |
| skill-router | Token optimization (compact JSON index) |
| state-management | Shared STATE.md coordination |

### Bug fix shortcut:
`debugging-and-error-recovery` → `test-driven-development` → `code-review-and-quality` → `shipping-and-launch`

Not every task needs every skill. The "Next Step" section in each pipeline skill tells the agent what to chain to next.

## Quick Reference

| Phase | Skill | One-Line Summary |
|-------|-------|-----------------|
| Define | interview-me | Surface what the user actually wants before any plan, spec, or code exists |
| Define | idea-refine | Refine ideas through structured divergent and convergent thinking |
| Define | spec-driven-development | Requirements and acceptance criteria before code |
| Plan | planning-and-task-breakdown | Decompose into small, verifiable tasks |
| Build | fresh-context-execution | Every task gets a fresh subagent + worktree isolation to prevent context rot and file conflicts |
| Build | source-driven-development | Verify against official docs before implementing |
| Build | doubt-driven-development | Adversarial fresh-context review of every non-trivial decision |
| Build | context-engineering | Right context at the right time |
| Build | frontend-ui-engineering | Production-quality UI with accessibility |
| Build | api-and-interface-design | Stable interfaces with clear contracts |
| Verify | test-driven-development | Failing test first, then make it pass |
| Verify | browser-testing-with-devtools | Chrome DevTools MCP for runtime verification |
| Verify | debugging-and-error-recovery | Reproduce → localize → fix → guard |
| Review | code-review-and-quality | Five-axis review with quality gates |
| Review | code-simplification | Preserve behavior while reducing unnecessary complexity |
| Review | security-and-hardening | OWASP prevention, input validation, least privilege |
| Review | performance-optimization | Measure first, optimize only what matters |
| Ship | git-workflow-and-versioning | Atomic commits, clean history |
| Ship | ci-cd-and-automation | Automated quality gates on every change |
| Ship | deprecation-and-migration | Remove old systems and migrate users safely |
| Ship | documentation-and-adrs | Document the why, not just the what |
| Ship | observability-and-instrumentation | Structured logs, RED metrics, traces, symptom-based alerts |
| Ship | shipping-and-launch | Pre-launch checklist, monitoring, rollback plan |
