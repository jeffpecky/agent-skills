---
description: Run TDD workflow and verify implementation against spec goals. Uses a verifier subagent to check goal achievement, not just test execution.
---

Invoke the agent-skills:test-driven-development skill alongside agent-skills:state-management.

## Mode Selection

- **`/test`** — run TDD for the current task (inline, single task)
- **`/test verify`** — dispatch a verifier subagent to check all goals against the spec

`$ARGUMENTS` selects the mode. `verify` dispatches the verifier; anything else (or empty) runs the default TDD loop.

## Default: TDD for current task

Read `tasks/STATE.md` to find the active task. Then:

1. Read the task's acceptance criteria from `tasks/plan.md`
2. Write tests that describe the expected behavior (they should FAIL)
3. Confirm the test fails for the right reason
4. Implement the minimum code to make them pass
5. Refactor while keeping tests green
6. Run the full test suite for regressions
7. Commit

For bug fixes (Prove-It pattern):
1. Write a test that reproduces the bug (must FAIL)
2. Confirm the test fails
3. Implement the fix
4. Confirm the test passes
5. Run the full test suite for regressions

For browser-related issues, also invoke agent-skills:browser-testing-with-devtools.

## Verification mode: `/test verify`

Dispatch a **verifier subagent** to check whether the implementation achieves the spec goals — not just whether tests pass.

### Phase 1: Prepare verification brief

Create `tasks/briefs/verification-brief.md` containing:
- Path to SPEC.md
- Path to tasks/plan.md
- Instruction to verify every requirement against actual implementation
- Instruction to run tests and build
- Report path: `tasks/verification.md`

### Phase 2: Dispatch verifier subagent

Dispatch a **verifier subagent** (type: `verifier`) with the brief. The verifier:
- Reads the spec and plan
- Examines the implementation
- Checks every requirement (not just "does code exist" — does it WORK?)
- Runs the test suite
- Runs the build
- Reports PASS or FAIL with specific evidence

### Phase 3: Handle results

- **PASS:** Update `tasks/STATE.md` — Verification section: status = complete, verdict = PASS
- **FAIL:** Read the issues. For Critical issues, dispatch a fix subagent or ask the user. For Important issues, note them. Update state accordingly.

### Phase 4: State update

Update `tasks/STATE.md`:
- Set Verification section: status = complete, verdict = PASS|FAIL
- Set Current Phase: phase = review (if PASS)

## Rules

- **TDD is mandatory for default mode.** Write the test first, always.
- **Verify mode checks goals, not just tests.** The verifier asks "does this achieve what the spec requires?" not just "do tests pass?"
- **Evidence-based verification.** Every verdict must cite specific test results, code locations, or manual verification.
- **Don't skip verification.** After all tasks complete, always run `/test verify` before `/review`.
