---
description: Conduct a five-axis code review. Uses parallel subagents for code-reviewer, security-auditor, and test-engineer specialist reviews.
---

Invoke the agent-skills:code-review-and-quality skill alongside agent-skills:state-management.

## Phase A — Parallel fan-out

Spawn three specialist subagents concurrently using the Agent tool. **Issue all three Agent tool calls in a single assistant turn so they execute in parallel** — sequential calls defeat the purpose.

1. **`code-reviewer`** — Five-axis review (correctness, readability, architecture, security, performance) on the staged changes or recent commits. Output the standard review template.
2. **`security-auditor`** — Vulnerability and threat-model pass. Check OWASP Top 10, secrets handling, auth/authz, dependency CVEs. Output the standard audit report.
3. **`test-engineer`** — Analyze test coverage for the change. Identify gaps in happy path, edge cases, error paths, and concurrency scenarios. Output the standard coverage analysis.

Each subagent gets its own fresh context window and returns only its report to this main session.

## Phase B — Merge in main context

Once all three reports are back, the main agent synthesizes them:

1. **Code Quality** — Aggregate Critical/Important findings from `code-reviewer`. Resolve duplicates.
2. **Security** — Promote any Critical findings to launch blockers.
3. **Performance** — Pull from `code-reviewer`'s performance axis.
4. **Test Coverage** — Pull from `test-engineer`'s analysis.

## Phase C — Report

Produce a structured review:

```markdown
## Code Review

### Critical Issues (must fix)
- [Source: code-reviewer | security-auditor | test-engineer] — {finding}

### Important Issues (should fix)
- [Source] — {finding}

### Suggestions (nice to have)
- [Source] — {finding}

### Strengths
- {what the code does well}
```

## Phase D — State update

Update `tasks/STATE.md`:
- Set Current Phase: phase = ship (if no Critical issues)
- Note any Critical issues in Blockers section

## Rules

- **Parallel execution.** All three Phase A personas run in parallel — never sequentially.
- **Subagents don't call each other.** The main agent merges in Phase B.
- **Critical issues block.** If any persona returns a Critical finding, the default is to NOT proceed to `/ship` until resolved.
- **Fresh context per subagent.** Each subagent starts clean — no accumulated session history.
