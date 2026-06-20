# Artifact Contracts

`agent-skills` uses durable files so fresh-context agents do not depend on conversation memory. These paths are the canonical standalone layout.

`agent-skills` uses `tasks/` as its native durable state substrate. Do not write to `.planning/`; that is GSD Core's project substrate and is intentionally out of scope for this lightweight skill-pack contract.

## Canonical Standalone Layout

```text
SPEC.md
tasks/
  STATE.md
  progress.md
  trace.jsonl
  research.md
  plan.md
  verification.md
  review.md
  ship-decision.md
  codebase/
    STACK.md
    INTEGRATIONS.md
    ARCHITECTURE.md
    STRUCTURE.md
    CONVENTIONS.md
    TESTING.md
    CONCERNS.md
  graphs/
    graph.json
    graph.html
    GRAPH_REPORT.md
    .last-build-status.json
    snapshot.json
  briefs/
    research-brief.md
    task-1-brief.md
  reports/
    task-1-report.md
```

## Artifact Table

| Artifact | Writer | Readers | Required When |
|---|---|---|---|
| `SPEC.md` | Orchestrator using `spec-driven-development` | `planner`, `plan-checker`, `verifier`, reviewers | Non-trivial feature/change |
| `tasks/research.md` | `researcher` | `planner`, `plan-checker`, `task-executor` | Non-trivial feature/change |
| `tasks/plan.md` | `planner` | `plan-checker`, `task-executor`, `verifier` | Before build |
| `tasks/progress.md` | Orchestrator and executors | Orchestrator, `verifier` | During build |
| `tasks/reports/task-*.md` | `task-executor` | Orchestrator, `verifier`, reviewers | Per executed task |
| `tasks/verification.md` | `verifier` | Review and ship phases | Before review/ship |
| `tasks/review.md` | `code-reviewer` or review orchestrator | Ship phase, user | Before ship |
| `tasks/ship-decision.md` | Orchestrator using `shipping-and-launch` | User | Ship phase |
| `tasks/STATE.md` | Orchestrator | All phases | Always |
| `tasks/trace.jsonl` | Orchestrator and agents | Validators, humans, future agents | Recommended for E2E/testing |
| `tasks/codebase/*.md` | `map-codebase` skill (via `codebase-mapper`) | `spec-driven-development`, `planning-and-task-breakdown`, `fresh-context-execution`, `research` | Brownfield onboarding; refreshed on significant structural change |
| `tasks/graphs/graph.json` | `knowledge-graph` skill | research, planning, debug | When `graphify.enabled: true` |
| `tasks/graphs/.last-build-status.json` | `knowledge-graph` skill | Hook, CLI | When graph build completes |
| `tasks/graphs/snapshot.json` | `knowledge-graph` skill | Diff, report | When graph exists |

## State Values

Valid current phases:

- `none`
- `spec`
- `plan`
- `build`
- `verify`
- `review`
- `ship`
- `done`
- `blocked`

Valid artifact statuses:

- `none`
- `draft`
- `approved`
- `in_progress`
- `complete`
- `failed`
- `blocked`

Valid verification verdicts:

- `PASS`
- `FAIL`
- `BLOCKED`

Valid review and ship verdicts:

- `GO`
- `NO-GO`
- `BLOCKED`

## Invariants

- For brownfield repos, `tasks/codebase/` should be mapped before `SPEC.md` so planning is grounded in existing code. Greenfield repos skip mapping.
- Source implementation should not begin before `SPEC.md` and `tasks/plan.md` exist.
- `tasks/verification.md` must exist before `tasks/review.md` is finalized.
- `tasks/review.md` must exist before `tasks/ship-decision.md` is finalized.
- `tasks/STATE.md` should point to the current phase and artifact paths after each lifecycle phase.
- If a phase is blocked, record the blocker in `tasks/STATE.md` and stop the pipeline.

## Graphify Artifacts

When Graphify is enabled (`graphify.enabled: true` in `tasks/config.json`), knowledge graph artifacts are stored in `tasks/graphs/`:

| Artifact | Description | Lifecycle |
|---|---|---|
| `graph.json` | Machine-readable graph structure (nodes, edges, metadata) | Overwritten on each build |
| `graph.html` | Interactive visualization (if Graphify configured for HTML output) | Overwritten on each build |
| `GRAPH_REPORT.md` | Human-readable summary of graph state and key insights | Overwritten on each build |
| `.last-build-status.json` | Build timing, success/failure, and Graphify version | Overwritten on each build |
| `snapshot.json` | Previous graph state for diffing | Created on first build, updated before overwrite |

**Retention Rule:** The `graphify-out/` directory (Graphify's native output) is intentionally **NOT** deleted after copying to `tasks/graphs/`. This preserves the raw Graphify output for debugging and maintains parity with GSD Core's documented behavior.

**Auto-Update Hooks:** When `graphify.auto_update: true`, Graphify rebuilds automatically after HEAD-advancing git commands (commit, merge, pull, rebase, cherry-pick). The hook is opt-in and non-blocking.
