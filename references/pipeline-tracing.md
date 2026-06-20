# Pipeline Tracing

`tasks/trace.jsonl` is a local, vendor-neutral audit log for `agent-skills` lifecycle runs. External tracing platforms such as OpenTelemetry, MLflow, Langfuse, and LangSmith are useful for observability, but the local trace is the testable workflow evidence.

Each line is one JSON object.

## Required Fields

| Field | Type | Description |
|---|---|---|
| `ts` | string | ISO-8601 timestamp |
| `event` | string | Event name |

Additional fields are event-specific.

## Event Names

- `pipeline.started`
- `pipeline.completed`
- `pipeline.blocked`
- `skill.invoked`
- `skill.completed`
- `persona.spawned`
- `persona.completed`
- `artifact.expected`
- `artifact.written`
- `command.started`
- `command.completed`
- `command.failed`
- `verification.started`
- `verification.passed`
- `verification.failed`
- `review.started`
- `review.completed`
- `state.updated`
- `test-audit.started`
- `test-audit.completed`
- `test-audit.blocked`

## Minimum Lifecycle Ordering

For a complete feature pipeline, events should show this order:

```text
pipeline.started
skill.invoked: spec-driven-development
artifact.written: SPEC.md
skill.invoked: planning-and-task-breakdown
artifact.written: tasks/plan.md
skill.invoked: fresh-context-execution
skill.invoked: test-driven-development
artifact.written: tasks/reports/task-*.md
verification.started
verification.passed OR verification.failed
review.started
review.completed
skill.invoked: shipping-and-launch
pipeline.completed OR pipeline.blocked
```

## Example

```jsonl
{"ts":"2026-06-19T12:00:00.000Z","event":"pipeline.started","goal":"add multiply function"}
{"ts":"2026-06-19T12:00:10.000Z","event":"skill.invoked","skill":"spec-driven-development"}
{"ts":"2026-06-19T12:01:00.000Z","event":"artifact.written","path":"SPEC.md"}
{"ts":"2026-06-19T12:02:00.000Z","event":"pipeline.completed","verdict":"GO"}
```

## External Tracing

Use OpenCode tracing to inspect model turns, tool calls, durations, and token usage. Use `tasks/trace.jsonl` to validate lifecycle compliance.
