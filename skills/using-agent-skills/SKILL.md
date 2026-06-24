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

Agent Skills is a collection of engineering workflow skills organized by development phase. Each skill encodes a specific process that senior engineers follow. This meta-skill is the commandless orchestrator: it discovers the user's intent, invokes the right skills, writes durable state, records trace events, and validates the run without requiring slash commands.

## Commandless Kernel Protocol

The user should not need to run `/spec`, `/plan`, `/build`, `/test`, `/review`, or `/ship`. Natural-language requests drive the lifecycle. Slash commands are optional shortcuts; the kernel behavior lives here.

For non-trivial lifecycle work:

1. Pin the target root and initialize machine state with `agent-skills-state.js init`.
2. Start the local audit log with `agent-skills-trace.js pipeline.started`.
3. Invoke each matching skill in lifecycle order and record `skill.invoked`, `artifact.written`, verification, review, and completion events.
4. Update `tasks/STATE.md` after each phase transition.
5. Run `agent-skills-pipeline.js validate --root <target-root>` before claiming completion.

## Conditional Skill Checkpoints

During commandless orchestration, invoke additional skills when the work crosses these boundaries:

- Starting or resuming multi-step work: `state-management`
- Unfamiliar brownfield codebase: `map-codebase`
- Task-specific codebase or dependency investigation: `research`
- External APIs, libraries, or frameworks: `research` with mode `external`
- Bugs, failed tests, or unexpected behavior: `debugging-and-error-recovery`
- API contracts or public interfaces: `api-and-interface-design`
- User-facing UI: `frontend-ui-engineering`
- Browser runtime validation: `browser-testing-with-devtools`
- Untrusted input, auth, secrets, or external integrations: `security-and-hardening`
- Performance budgets, regressions, or Core Web Vitals: `performance-optimization`
- Architecture/dependency relationship mapping: `knowledge-graph`
- User acceptance or final intent check: `user-acceptance-testing`
- Multi-milestone/version lifecycle: `milestone-lifecycle`

## Skill Discovery

When a task arrives, identify the development phase and apply the corresponding skill:

```
Task arrives
    │
    ├── Don't know what you want yet? ──────→ interview-me
    ├── Have a rough concept, need variants? → idea-refine
    ├── New project/feature/change? ──→ spec-driven-development
    ├── Existing unfamiliar codebase? ─→ map-codebase
    ├── Need task research? ───────────→ research
    ├── Have a spec, need tasks? ──────→ planning-and-task-breakdown
    ├── Implementing code? ────────────→ fresh-context-execution
    │   ├── Need durable state? ───────→ state-management
    │   ├── Parallel file work? ───────→ using-git-worktrees
    │   ├── UI work? ─────────────────→ frontend-ui-engineering
    │   ├── API work? ────────────────→ api-and-interface-design
    │   ├── Need better context? ─────→ context-engineering
    │   ├── External API/library? ─────→ research (external mode)
    │   ├── Need doc-verified code? ───→ source-driven-development
    │   └── Stakes high / unfamiliar code? ──→ doubt-driven-development
    ├── Writing/running tests? ────────→ test-driven-development
    │   └── Browser-based? ───────────→ browser-testing-with-devtools
    ├── Something broke? ──────────────→ debugging-and-error-recovery
    ├── Reviewing code? ───────────────→ code-review-and-quality
    │   ├── Too complex? ─────────────→ code-simplification
    │   ├── Security concerns? ───────→ security-and-hardening
    │   └── Performance concerns? ────→ performance-optimization
    ├── Committing/branching? ─────────→ git-workflow-and-versioning
    ├── CI/CD pipeline work? ──────────→ ci-cd-and-automation
    ├── Deprecating/migrating? ────────→ deprecation-and-migration
    ├── Writing docs/ADRs? ───────────→ documentation-and-adrs
    ├── Adding logs/metrics/alerts? ───→ observability-and-instrumentation
    ├── Mapping dependencies/decisions? → knowledge-graph
    ├── User acceptance check? ─────────→ user-acceptance-testing
    ├── Milestone/version lifecycle? ───→ milestone-lifecycle
    └── Deploying/launching? ─────────→ shipping-and-launch
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

### 7. Pin the Target Root and Trace Every Lifecycle

Before any non-trivial lifecycle run, identify the exact project root that artifacts and code changes belong to. Do not assume the repository root is the target when the user is working inside a nested app or fixture.

Record the target root in `tasks/STATE.md` and start a local trace before writing `SPEC.md` or implementation files:

```bash
node scripts/agent-skills-state.js --root <target-root> init --goal "<goal>"
node scripts/agent-skills-trace.js --root <target-root> pipeline.started goal="<goal>"
```

All lifecycle artifact writes and trace events must use that same target root. At completion, run:

```bash
node scripts/agent-skills-pipeline.js validate --root <target-root>
```

If validation fails, the lifecycle is blocked, not complete.

Artifact directory policy: use `tasks/` for agent-skills. `.planning/` belongs to GSD Core's deeper project substrate; `.task` is not an agent-skills contract. When a project is already initialized, helper scripts walk up from nested working directories to the existing `tasks/STATE.md` root unless `--root` is supplied.

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
11. Writing artifacts to the parent repo when the requested project is a nested directory
12. Completing a lifecycle without `tasks/trace.jsonl` and a passing pipeline validation

## Skill Rules

1. **Check for an applicable skill before starting work.** Skills encode processes that prevent common mistakes.

2. **Skills are workflows, not suggestions.** Follow the steps in order. Don't skip verification steps.

3. **Multiple skills can apply.** A feature implementation might involve `idea-refine` → `spec-driven-development` → `planning-and-task-breakdown` → `fresh-context-execution` → `test-driven-development` → `code-review-and-quality` → `code-simplification` → `shipping-and-launch` in sequence.

4. **When in doubt, start with a spec.** If the task is non-trivial and there's no spec, begin with `spec-driven-development`.

## Lifecycle Sequence

For a complete feature, the typical skill sequence is:

```
1.  interview-me                → Extract what the user actually wants
2.  idea-refine                 → Refine vague ideas
3.  spec-driven-development     → Define what we're building
4.  state-management            → Initialize durable lifecycle state
5.  map-codebase                → Build durable context for brownfield repos when needed
6.  research                    → Gather task-scoped internal/external evidence
7.  planning-and-task-breakdown → Break into verifiable chunks
8.  context-engineering         → Load the right context
9.  source-driven-development   → Verify against official docs
10. fresh-context-execution     → Build slice by slice
11. using-git-worktrees         → Isolate parallel or risky filesystem work when needed
12. observability-and-instrumentation → Instrument as you build (runs parallel with 10-13, not after)
13. doubt-driven-development    → Cross-examine non-trivial decisions in-flight
14. test-driven-development     → Prove each slice works
15. user-acceptance-testing     → Confirm the implementation matches user intent
16. code-review-and-quality     → Review before merge
17. code-simplification         → Reduce unnecessary complexity while preserving behavior
18. security-and-hardening      → Harden risky input/auth/integration surfaces
19. performance-optimization    → Measure and optimize when performance matters
20. git-workflow-and-versioning → Clean commit history
21. documentation-and-adrs      → Document decisions
22. knowledge-graph             → Preserve architecture/dependency knowledge when useful
23. deprecation-and-migration   → Retire old systems and move users safely when needed
24. milestone-lifecycle         → Advance/archive milestones when the project has them
25. shipping-and-launch         → Deploy safely
```

Not every task needs every skill. A bug fix might only need: `debugging-and-error-recovery` → `test-driven-development` → `code-review-and-quality`.

## Quick Reference

| Phase | Skill | One-Line Summary |
|-------|-------|-----------------|
| Define | interview-me | Surface what the user actually wants before any plan, spec, or code exists |
| Define | idea-refine | Refine ideas through structured divergent and convergent thinking |
| Define | spec-driven-development | Requirements and acceptance criteria before code |
| Build | state-management | Durable state, progress, blockers, and resume information |
| Build | map-codebase | Durable repo-wide map for brownfield onboarding |
| Build | research | Task-scoped internal/external research before planning or implementation |
| Plan | planning-and-task-breakdown | Decompose into small, verifiable tasks |
| Build | fresh-context-execution | Every task gets a fresh subagent + worktree isolation to prevent context rot and file conflicts |
| Build | using-git-worktrees | Isolated workspaces for parallel or risky implementation |
| Build | source-driven-development | Verify against official docs before implementing |
| Build | doubt-driven-development | Adversarial fresh-context review of every non-trivial decision |
| Build | context-engineering | Right context at the right time |
| Build | knowledge-graph | Map concepts, decisions, dependencies, and relationships |
| Build | frontend-ui-engineering | Production-quality UI with accessibility |
| Build | api-and-interface-design | Stable interfaces with clear contracts |
| Verify | test-driven-development | Failing test first, then make it pass |
| Verify | browser-testing-with-devtools | Chrome DevTools MCP for runtime verification |
| Verify | debugging-and-error-recovery | Reproduce → localize → fix → guard |
| Verify | user-acceptance-testing | Conversational acceptance check before declaring done |
| Review | code-review-and-quality | Five-axis review with quality gates |
| Review | code-simplification | Preserve behavior while reducing unnecessary complexity |
| Review | security-and-hardening | OWASP prevention, input validation, least privilege |
| Review | performance-optimization | Measure first, optimize only what matters |
| Ship | git-workflow-and-versioning | Atomic commits, clean history |
| Ship | ci-cd-and-automation | Automated quality gates on every change |
| Ship | deprecation-and-migration | Remove old systems and migrate users safely |
| Ship | documentation-and-adrs | Document the why, not just the what |
| Ship | observability-and-instrumentation | Structured logs, RED metrics, traces, symptom-based alerts |
| Ship | milestone-lifecycle | Multi-milestone/version lifecycle management |
| Ship | shipping-and-launch | Pre-launch checklist, monitoring, rollback plan |
