# OpenCode E2E Testing

This runbook validates that OpenCode follows the `agent-skills` lifecycle end to end.

## Goal

Prove a natural-language request produces the expected skills, artifacts, code changes, tests, verification, review, and local trace.

## Fixture

Use `testdata/fixtures/tiny-node-calculator`.

## Manual Run

1. Copy the fixture to a temporary directory.
2. Copy or symlink these `agent-skills` files into that temporary directory:
   - `AGENTS.md`
   - `skills/`
   - `agents/`
   - `tasks/`
   - `tests/pipeline-artifacts/trace-event.js`
   - `tests/pipeline-artifacts/validate-pipeline-run.js`
   - `references/artifact-contracts.md`
   - `references/pipeline-tracing.md`
3. Start OpenCode in the temporary directory.
4. Prompt OpenCode:

```text
Add multiply(a, b) to this tiny calculator project using the complete agent-skills lifecycle. Follow AGENTS.md strictly. Use durable artifacts under tasks/. Do not skip spec, plan, TDD, verification, review, or state updates. Record trace events in tasks/trace.jsonl.
```

5. After OpenCode finishes, run:

```bash
npm test
node tests/pipeline-artifacts/validate-pipeline-run.js --root .
```

## Required Artifacts

- `SPEC.md`
- `tasks/STATE.md`
- `tasks/research.md`
- `tasks/plan.md`
- `tasks/progress.md`
- `tasks/reports/task-*-report.md`
- `tasks/verification.md`
- `tasks/review.md`
- `tasks/ship-decision.md`
- `tasks/trace.jsonl`

## Pass Criteria

- OpenCode invokes the lifecycle skills in order.
- Source implementation does not begin before spec and plan artifacts exist.
- `multiply(a, b)` is implemented.
- A regression test for `multiply(2, 3) === 6` exists.
- `npm test` passes.
- `validate-pipeline-run.js` passes.
- Review and ship decision artifacts exist.

## Optional External Tracing

Use OpenCode tracing to inspect model turns, token usage, and tool calls. The local `tasks/trace.jsonl` remains the validation source of truth.

### MLflow Example

Install the OpenCode MLflow plugin according to MLflow's current documentation, then configure `opencode.json` with the plugin entry and set:

```bash
export MLFLOW_TRACKING_URI=http://localhost:5000
export MLFLOW_EXPERIMENT_ID=<experiment-id>
```

On PowerShell:

```powershell
$env:MLFLOW_TRACKING_URI = "http://localhost:5000"
$env:MLFLOW_EXPERIMENT_ID = "<experiment-id>"
```

Inspect the external trace for:

- skill tool invocations
- file reads/writes
- model turns per phase
- token usage
- test command execution
