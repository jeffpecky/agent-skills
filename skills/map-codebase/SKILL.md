---
name: map-codebase
description: Maps an existing (brownfield) codebase into durable, repo-wide reference docs before any feature work. Use when onboarding agent-skills into a repo that already has code, when starting work in an unfamiliar codebase, or when the codebase structure has changed significantly. Produces persistent context that planning and execution read on every future phase.
---

# Map Codebase

## Overview

Learn the whole repository once, write it down, and reuse that knowledge on every future task. When agent-skills is dropped into a repo that already has code, plans and implementations are only as good as the agent's understanding of the existing stack, conventions, structure, and technical debt. This skill produces a durable, repo-wide map so every later `spec-driven-development`, `planning-and-task-breakdown`, `research`, and `fresh-context-execution` run starts grounded in the actual code rather than re-deriving it from scratch.

This is the brownfield onboarding step. Greenfield projects (no code yet) skip it and go straight to `interview-me`.

## When to Use

- Onboarding agent-skills into a repository that already contains code
- Starting work in a codebase you have not mapped before
- The repo structure has changed significantly since the last map (new top-level modules, a migration, a framework change)
- A plan or implementation keeps re-discovering the same repo-wide facts (stack, conventions) on every feature

**When NOT to use:**

- Greenfield projects with no code yet (go to `interview-me`)
- A single-file fix or typo where repo-wide context adds nothing
- You only need narrow, task-specific context for one feature — use `research` instead (see Map vs Research below)

## Map vs Research

These two skills are complementary, not redundant. `map-codebase` produces the substrate that `research` queries against.

| | `map-codebase` | `research` |
|---|---|---|
| Question | "What is this whole repo like?" | "What do I need for *this task*?" |
| Scope | Repo-wide, exhaustive | Task-scoped, narrow |
| When | Once, up front (onboarding) | Before each feature/task |
| Output | 7 durable docs in `tasks/codebase/` | `tasks/reports/research-report.md` (per-topic, overwritten) |
| Lifetime | Reused across many features | Disposable per task |
| Sources | Internal codebase only | Internal + external (Context7, web) |
| Consumer | Every future plan/execute, and `research` itself | The planner for the current phase |

Rule of thumb: the map describes the house; research scouts the room you are about to renovate. Run `map-codebase` once when onboarding, then let each `research` pass start from the map and investigate only the task-specific delta.

## How It Works

The skill orchestrates four focused mapping passes, each producing one or more documents in `tasks/codebase/`. Dispatch the passes as fresh-context `codebase-mapper` subagents (see `agents/codebase-mapper.md`) so the orchestrator stays lean — each pass explores deeply and writes its own docs to disk rather than returning content.

```
                 map-codebase (orchestrator)
                          │
   ┌──────────────┬──────┴───────┬──────────────────┐
   ▼              ▼              ▼                  ▼
  tech           arch          quality            concerns
   │              │              │                  │
   ▼              ▼              ▼                  ▼
 STACK.md      ARCHITECTURE   CONVENTIONS         CONCERNS.md
 INTEGRATIONS  STRUCTURE      TESTING
```

| Pass | Focus | Documents written |
|------|-------|-------------------|
| `tech` | Stack, runtime, dependencies, external services | `STACK.md`, `INTEGRATIONS.md` |
| `arch` | Patterns, layers, data flow, directory layout | `ARCHITECTURE.md`, `STRUCTURE.md` |
| `quality` | Naming, style, lint/format, test patterns | `CONVENTIONS.md`, `TESTING.md` |
| `concerns` | Tech debt, fragile areas, security gaps, scaling limits | `CONCERNS.md` |

### Step 1: Detect brownfield vs greenfield

If the repo has source files, this is brownfield — proceed. If it is empty or only scaffolding, skip mapping and route to `interview-me`.

### Step 2: Dispatch the four passes

Dispatch one `codebase-mapper` subagent per focus area (`tech`, `arch`, `quality`, `concerns`). Passes are independent and may run in parallel. Each subagent explores with read-only tools and writes its documents directly to `tasks/codebase/`.

### Step 3: Collect and summarize

After all passes return, confirm the seven documents exist in `tasks/codebase/`. Read `CONCERNS.md` and surface the top risks to the user — these often become future tasks. Do not dump full document contents into the conversation; the docs live on disk for later phases to load selectively.

### Step 4: Hand off to the lifecycle

The map is standing context. Subsequent skills load only the docs relevant to their work:

| Phase intent | Docs loaded |
|--------------|-------------|
| UI / frontend / components | `CONVENTIONS.md`, `STRUCTURE.md` |
| API / backend / endpoints | `ARCHITECTURE.md`, `CONVENTIONS.md` |
| database / schema / models | `ARCHITECTURE.md`, `STACK.md` |
| testing | `TESTING.md`, `CONVENTIONS.md` |
| integration / external API | `INTEGRATIONS.md`, `STACK.md` |
| refactor / cleanup | `CONCERNS.md`, `ARCHITECTURE.md` |
| setup / config | `STACK.md`, `STRUCTURE.md` |

## Document Set

All documents are written to `tasks/codebase/` (never `.planning/` — see `references/artifact-contracts.md`). Each document describes current state only, always cites real file paths in backticks, and is prescriptive ("use X pattern") rather than narrative.

- `STACK.md` — languages, runtime, package manager, frameworks, key dependencies, platform requirements
- `INTEGRATIONS.md` — external APIs/services, data storage, auth provider, monitoring, CI/CD, env vars (existence only, never secret values)
- `ARCHITECTURE.md` — system overview, component responsibilities, layers, data flow, key abstractions, anti-patterns, error handling
- `STRUCTURE.md` — directory layout, directory purposes, naming conventions, where to add new code
- `CONVENTIONS.md` — naming patterns, code style, lint/format config, import organization, error handling, function/module design
- `TESTING.md` — test framework, file organization, test structure, mocking patterns, fixtures, coverage, run commands
- `CONCERNS.md` — tech debt, known bugs, security considerations, performance bottlenecks, fragile areas, scaling limits, test coverage gaps

## Refreshing the Map

The map is durable, not permanent. Re-run `map-codebase` when the structure changes significantly (new top-level modules, framework migration, large refactor). For a targeted refresh after a single phase, a mapper pass may be scoped to changed subtrees rather than re-scanning the whole repo. Between refreshes, every phase reads the existing docs without regenerating them.

## Security

Never read or quote the contents of secret-bearing files into the map (`.env`, `*.pem`, `*.key`, `id_rsa*`, `credentials.*`, `.npmrc`, service-account JSON, etc.). The mapper notes only that such files exist (e.g., "`.env` present — contains environment configuration") and never includes values like `API_KEY=...`. The map documents are committed to git; a leaked secret here is a security incident. This guardrail is enforced in `agents/codebase-mapper.md`.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll just read files as I go" | Re-deriving repo-wide facts on every task is slower and inconsistent. Map once, reuse everywhere. |
| "The knowledge graph already covers this" | The graph answers "what depends on what," not "what are this repo's conventions / where do I put new code / what's the tech debt." Different question. |
| "research already does this" | `research` is task-scoped and disposable. The map is repo-wide and durable. They compose; they don't replace. |
| "This repo is small, I don't need a map" | Small repos map in one pass and still benefit — the planner gets grounded conventions for free. |
| "The map will go stale" | That's why it's refreshable. A slightly stale map beats no shared context. Refresh on significant structural change. |

## Red Flags

- Starting `spec-driven-development` on a brownfield repo with no `tasks/codebase/` docs
- Plans that invent file paths or conventions instead of citing the map
- Implementations that re-implement utilities already documented in the map
- Secret values appearing in any `tasks/codebase/` document
- Map documents describing what the code *was* or *could be* rather than what it *is*
- A single 1000-line dump instead of seven focused documents

## Verification

After mapping, confirm:

- [ ] Brownfield was correctly detected (greenfield would have skipped to `interview-me`)
- [ ] All seven documents exist in `tasks/codebase/`
- [ ] Every document cites real file paths, not vague descriptions
- [ ] No secret values appear in any document
- [ ] `CONCERNS.md` surfaces concrete risks with file paths and fix approaches
- [ ] Top concerns were surfaced to the user

## Next Step

After the map exists, **automatically invoke `agent-skills:interview-me`** (for non-trivial work) or route directly to the matching quick-task skill. The lifecycle proceeds normally from here — every downstream phase now reads `tasks/codebase/` for grounding.

```
Brownfield repo → map-codebase → interview-me → spec-driven-development → ...
```
