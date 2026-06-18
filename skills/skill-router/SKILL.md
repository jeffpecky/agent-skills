---
name: skill-router
description: Dynamically selects and loads the right skill based on user intent to save context window space. Use when starting a task and unsure which skill to load, or when you want to minimize context usage by loading only the needed skill.
---

# Skill Router

## Overview

Routes user intent to the correct skill. Prevents context bloat and decision paralysis by loading only the required skill, rather than all skills at once.

This is a token-optimization layer on top of `using-agent-skills`. Where `using-agent-skills` provides the full flowchart for routing, this skill uses a compact JSON index (`scripts/skill-index.json`) to route with fewer tokens.

## When to Use

- At the start of a new task or conversation
- When unsure which specific skill applies
- When you want to minimize context window usage during skill discovery
- Do NOT use if the required skill is already in context

## Core Process

1. **Analyze Intent** — Determine the engineering phase (Planning, Building, Testing, Debugging, etc.)
2. **Match Skill** — Identify the correct skill using the routing logic below or `scripts/skill-index.json`
3. **Dynamic Load** — Read only the selected SKILL.md into context
4. **Execute** — Follow the loaded skill's process
5. **Re-evaluate** — If the task changes phase, return to step 1

## Routing Logic

| User Intent | Skill to Load |
|-------------|---------------|
| Don't know what you want yet | `interview-me` |
| Have a rough concept | `idea-refine` |
| Defining what to build | `spec-driven-development` |
| Planning tasks | `planning-and-task-breakdown` |
| Implementing code | `fresh-context-execution` |
| UI work | `frontend-ui-engineering` |
| API work | `api-and-interface-design` |
| Need better context | `context-engineering` |
| Need doc-verified code | `source-driven-development` |
| Stakes high / unfamiliar code | `doubt-driven-development` |
| Writing code | `fresh-context-execution` |
| Writing tests | `test-driven-development` |
| Browser testing | `browser-testing-with-devtools` |
| Fixing bugs/errors | `debugging-and-error-recovery` |
| Reviewing code | `code-review-and-quality` |
| Code too complex | `code-simplification` |
| Security concerns | `security-and-hardening` |
| Performance concerns | `performance-optimization` |
| Committing/branching | `git-workflow-and-versioning` |
| CI/CD pipeline work | `ci-cd-and-automation` |
| Deprecating/migrating | `deprecation-and-migration` |
| Writing docs/ADRs | `documentation-and-adrs` |
| Adding logs/metrics | `observability-and-instrumentation` |
| Deploying/launching | `shipping-and-launch` |

## JSON Index

For a compact routing reference, use `scripts/skill-index.json`. Generate it with:

```bash
bash skills/skill-router/scripts/generate-index.sh
```

The index contains only skill names and descriptions — much smaller than loading all SKILL.md files.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll load all skills to be safe." | Bloats context, wastes tokens, and degrades accuracy. Load only what you need. |
| "I can guess the skill without checking." | Guessing leads to applying the wrong workflow. Check the routing table. |
| "The full flowchart is fine, I don't need this." | The flowchart works. This is an optimization for token-constrained sessions. |

## Red Flags

- Agent executes a task without loading a specific skill
- Agent loads more than 2 skills simultaneously for a single task
- Agent reads all SKILL.md files instead of routing first

## Verification

- [ ] User intent was categorized correctly
- [ ] Only the necessary skill was loaded
- [ ] The loaded skill is being actively followed
