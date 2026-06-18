---
name: dispatching-parallel-agents
description: Dispatches multiple agents in parallel for independent tasks. Use when facing 2+ independent failures, features, or investigations that don't share state or have sequential dependencies. Use when multiple test files fail with different root causes, when building independent features simultaneously, or when debugging multiple unrelated issues.
---

# Dispatching Parallel Agents

## Overview

When you have multiple independent tasks, running them sequentially wastes time. Each task can be investigated and resolved by its own agent with isolated context. Dispatch them in parallel — they run concurrently, you merge results.

**Core principle:** One agent per independent problem domain. Let them work concurrently.

## When to Use

- 3+ test files failing with different root causes
- Multiple independent features to build
- Multiple unrelated bugs to fix
- Each problem can be understood without context from others
- No shared state between investigations

**When NOT to use:**
- Failures are related (fixing one might fix others)
- Need to understand full system state
- Agents would interfere with each other (editing same files)
- Exploratory debugging (you don't know what's broken yet)

## The Pattern

### Step 1: Identify Independent Domains

Group failures by what's broken:

```
File A tests: Authentication flow
File B tests: Payment processing
File C tests: Notification system

Each domain is independent — fixing auth doesn't affect payments.
```

### Step 2: Create Focused Agent Tasks

Each agent gets:
- **Specific scope:** One file, one subsystem, one feature
- **Clear goal:** Make these tests pass / implement this feature
- **Constraints:** Don't change other code
- **Expected output:** Summary of what you found and fixed

### Step 3: Dispatch in Parallel

Issue all agent dispatches in the same response — they run in parallel:

```
Agent 1 → Fix authentication.test.ts failures
Agent 2 → Fix payment-processing.test.ts failures
Agent 3 → Fix notification-system.test.ts failures
# All three run concurrently
```

Multiple dispatch calls in one response = parallel execution. One per response = sequential.

### Step 4: Review and Integrate

When agents return:
- Read each summary
- Verify fixes don't conflict
- Run full test suite
- Integrate all changes

## Agent Prompt Structure

Good agent prompts are:

1. **Focused** — One clear problem domain
2. **Self-contained** — All context needed to understand the problem
3. **Specific about output** — What should the agent return?

```
Fix the 3 failing tests in src/auth/authentication.test.ts:

1. "should reject expired tokens" — expects 401 but gets 500
2. "should validate refresh token rotation" — stale token accepted
3. "should enforce rate limiting" — no rate limit response

Your task:
1. Read the test file and understand what each test verifies
2. Identify root cause — timing issues or actual bugs?
3. Fix by:
   - Replacing arbitrary timeouts with event-based waiting
   - Fixing bugs in auth implementation if found
   - Adjusting test expectations if testing changed behavior

Do NOT just increase timeouts — find the real issue.

Return: Summary of root cause, changes made, and test results.
```

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll fix them one at a time" | Three independent problems take 3x longer sequentially. Parallel is free speed. |
| "They might be related" | If you're not sure, investigate one first. If it's independent, parallelize the rest. |
| "Managing multiple agents is complex" | Each agent is self-contained. You just merge results at the end. |
| "I can hold all three in my head" | You can't. Each agent has its own context window — that's more total capacity. |

## Red Flags

- Dispatching agents that edit the same file (conflicts)
- No clear scope per agent ("fix everything")
- Vague output expectations ("let me know what you find")
- Dispatching related failures in parallel (fixing one might fix others)
- Not running full test suite after merging results

## Verification

After parallel agents complete:

- [ ] Each agent returned a summary of changes
- [ ] No conflicts between agent changes (different files)
- [ ] Full test suite passes after integration
- [ ] Each fix addresses root cause, not symptoms
- [ ] No regressions introduced by parallel changes
