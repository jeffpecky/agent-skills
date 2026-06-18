# agent-skills

This is the agent-skills project — a collection of production-grade engineering skills for AI coding agents.

## Project Structure

```
skills/       → Core skills (SKILL.md per directory)
agents/       → Agent personas (code-reviewer, test-engineer, security-auditor, web-performance-auditor, task-executor, researcher, planner, plan-checker, verifier)
hooks/        → Session lifecycle hooks
.claude/commands/ → Slash commands (/spec, /plan, /build, /test, /review, /code-simplify, /ship; plus /webperf specialist audit)
references/   → Supplementary checklists (testing, performance, security, accessibility)
docs/         → Setup guides for different tools
tasks/        → Project state and artifacts (STATE.md, plan.md, research.md, briefs/, reports/)
```

## Skills by Phase

**Define:** interview-me, idea-refine, spec-driven-development, state-management
**Plan:** planning-and-task-breakdown, fresh-context-execution
**Build:** fresh-context-execution, test-driven-development, context-engineering, source-driven-development, doubt-driven-development, frontend-ui-engineering, api-and-interface-design
**Verify:** browser-testing-with-devtools, debugging-and-error-recovery, fresh-context-execution
**Review:** code-review-and-quality, code-simplification, security-and-hardening, performance-optimization, fresh-context-execution
**Ship:** git-workflow-and-versioning, ci-cd-and-automation, deprecation-and-migration, documentation-and-adrs, observability-and-instrumentation, shipping-and-launch

## Context Rot Prevention (All Phases)

Agent Skills uses **fresh-context subagents** across ALL phases to structurally prevent context rot — not just during build. This is ported from GSD Core's architecture.

### The Pattern

```
/spec  → researcher subagent     → tasks/research.md
/plan  → planner subagent        → tasks/plan.md
       → plan-checker subagent   → tasks/plan-check.md
/build → task-executor per task  → tasks/reports/task-{N}-report.md
/test  → verifier subagent       → tasks/verification.md
/review→ 3 parallel subagents    → synthesized review report
```

Each subagent starts with a **clean context window**, receives only its task brief, does the work, writes a report to disk, and terminates. The orchestrator stays lean throughout.

### Shared State

`tasks/STATE.md` persists across sessions and coordinates between commands:
- Current phase, spec path, plan path, progress table
- Read by every subagent at start
- Updated by orchestrator after each phase
- Enables session recovery — resume from last known state

### Agent Personas

| Agent | Phase | Purpose |
|-------|-------|---------|
| `researcher` | /spec | Investigates codebase, patterns, dependencies |
| `planner` | /plan | Creates detailed implementation plan |
| `plan-checker` | /plan | Verifies plan quality before execution |
| `task-executor` | /build | Implements one task with TDD |
| `verifier` | /test | Checks goal achievement against spec |
| `code-reviewer` | /review | Five-axis code review |
| `security-auditor` | /review | Security and vulnerability pass |
| `test-engineer` | /review | Test coverage analysis |

## Conventions

- Every skill lives in `skills/<name>/SKILL.md`
- YAML frontmatter with `name` and `description` fields
- Description starts with what the skill does (third person), followed by trigger conditions ("Use when...")
- Every skill has: Overview, When to Use, Process, Common Rationalizations, Red Flags, Verification
- References are in `references/`, not inside skill directories
- Supporting files only created when content exceeds 100 lines

## Commands

- `npm test` — Not applicable (this is a documentation project)
- Validate: Check that all SKILL.md files have valid YAML frontmatter with name and description

## Boundaries

- Always: Follow the skill-anatomy.md format for new skills
- Never: Add skills that are vague advice instead of actionable processes
- Never: Duplicate content between skills — reference other skills instead
