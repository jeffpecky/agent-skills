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

- Source implementation should not begin before `SPEC.md` and `tasks/plan.md` exist.
- `tasks/verification.md` must exist before `tasks/review.md` is finalized.
- `tasks/review.md` must exist before `tasks/ship-decision.md` is finalized.
- `tasks/STATE.md` should point to the current phase and artifact paths after each lifecycle phase.
- If a phase is blocked, record the blocker in `tasks/STATE.md` and stop the pipeline.
