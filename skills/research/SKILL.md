---
name: research
description: Research codebase patterns, conventions, and external APIs before implementing. Use when starting any non-trivial task to understand existing code and external dependencies.
---

# Research

## Overview

Gather context before implementing. Research first, implement second.

## When to Use

- Before any implementation task
- When you need to understand existing patterns
- When external APIs or libraries are involved
- When requirements are unclear

## Researcher Persona and Modes

The researcher agent is the persona that executes this skill. Do not split research into separate internal/external skills. Use one research workflow with a mode:

- `internal` — existing code, architecture, patterns, dependencies, conventions.
- `external` — APIs, libraries, frameworks, official docs, production evidence.
- `both` — internal integration points plus external source validation.

## Map vs Research

`research` is task-scoped and disposable; `map-codebase` is repo-wide and durable. They compose — the map is the substrate `research` queries against.

| | `research` | `map-codebase` |
|---|---|---|
| Question | "What do I need for *this task*?" | "What is this whole repo like?" |
| Scope | Narrow, one topic | Exhaustive, repo-wide |
| When | Before each feature/task | Once, up front (brownfield onboarding) |
| Output | `tasks/reports/research-report.md` (overwritten per topic) | 7 durable docs in `tasks/codebase/` |
| Sources | Internal + external (Context7, web) | Internal codebase only |

On a brownfield repo, use `map-codebase` only when repo-wide understanding is needed and no current map exists. Do not run it mechanically for narrow research. Each `research` pass should start from `tasks/codebase/` when those files exist and are current, then investigate only the task-specific delta instead of re-deriving repo-wide facts.

Use `map-codebase` first when:
- The repository is unfamiliar or broad in scope.
- The research question crosses multiple subsystems.
- `tasks/codebase/` is missing or stale.
- Future agents need durable architecture context.

Skip `map-codebase` when:
- The relevant files are already known.
- The research question is narrow and local.
- The existing codebase map is current.
- External API/library documentation is the main target.

## How It Works

1. Check existing `tasks/codebase/` docs and the knowledge graph for reusable context.
2. Decide mode: `internal`, `external`, or `both`.
3. If internal research is broad and no current map exists, run `map-codebase`; otherwise inspect targeted files directly.
4. Create a research brief for the researcher persona.
5. Researcher investigates internal code and/or external sources according to mode.
6. Research findings are written to `tasks/reports/`.
7. Update the knowledge graph with new durable findings when useful.

## Usage

```bash
bash /mnt/skills/user/research/scripts/research-brief.sh <topic> [output-dir] [research-type]
```

**Arguments:**
- `topic` - What to research (required)
- `output-dir` - Where to write reports (default: `tasks/reports/`)
- `research-type` - `internal` | `external` | `both` (default: `both`)

**Examples:**
```bash
# Research codebase patterns only (no external APIs)
bash scripts/research-brief.sh "existing auth patterns" "tasks/reports" internal

# Research external library only (no codebase)
bash scripts/research-brief.sh "Prisma ORM" "tasks/reports" external

# Research both (default)
bash scripts/research-brief.sh "JWT authentication" "tasks/reports" both
```

## Research Sources

### Internal — Codebase Patterns

**Use for:**
- Existing code patterns and conventions
- File structure and module organization
- Dependency versions and configurations
- Related implementations in the codebase

**How:**
1. Run `research-brief.sh` to create brief
2. Researcher persona reads brief
3. Researcher investigates codebase
4. Outputs `tasks/reports/research-report.md`

### External — APIs, Libraries, Frameworks

**Use for:**
- Framework API signatures and usage patterns
- Library configuration and setup
- Official examples and version-specific behavior
- Official migration guides between versions
- Architecture decisions and design patterns
- Performance benchmarks and comparisons
- Production war stories and case studies

**Source selection:**

| Question Type | Source | Example |
|---|---|---|
| API documentation | Official docs / Context7 | "How do I use Prisma's `findMany`?" |
| Configuration | Official docs / Context7 | "How do I set up Socket.io with Express?" |
| Version migration | Official docs / Context7 | "How do I migrate from Prisma 4 to 5?" |
| Architecture decision | Web search | "Should we use event sourcing?" |
| Performance comparison | Web search | "Which caching strategy is fastest for this use case?" |
| Production patterns | Web search | "How did teams deploy Socket.io at scale?" |
| Tool trade-offs | Web search | "Prisma vs Drizzle vs TypeORM?" |
| Known production issues | Web search | "Prisma connection pooling with Lambda" |

Rule: match the source to the question. Do not use web posts for API signatures when official docs are available. Do not use API docs as architecture advice when the question requires production evidence.

**Tools:**
- Context7 MCP — documentation
- Web search — real-world context

**How:**
1. Define the research question and source type.
2. Researcher persona uses official docs or Context7 for API/config/version questions.
3. Researcher persona uses web search for architecture, performance, trade-offs, known issues, and production patterns.
4. Record sources consulted, findings, confidence, evidence, implications, open questions, and recommendations.
5. Output `tasks/reports/RESEARCH.md`.

## Output

### tasks/reports/research-report.md (Internal)

```markdown
# Research Report: {Topic}

## Summary
{2-3 sentences: what you found}

## Existing Patterns
- {file}:{line} — {pattern description}

## Key Files
- {file path}: {why it matters}

## Dependencies
- {package}: {version} — {what it provides}

## Risks and Gotchas
- {risk}: {mitigation}

## Recommendations
- {recommendation}: {rationale}
```

### tasks/reports/RESEARCH.md (External)

```markdown
# Research Log

## Research Question
{What we needed to understand}

## Sources Consulted

### Context7
- {library}: {finding}

### Web Search
- {question}: {finding}

## Key Findings

### {Finding Title}
- **Source**: Context7 | Web search
- **Confidence**: certain | likely | uncertain | speculative
- **Evidence**: {Exact quote, code, or data}
- **Implication**: {What this means for implementation}

## Recommendations
1. {Actionable recommendation}
```

## Confidence Levels

| Level | Definition | Action |
|-------|------------|--------|
| **certain** | Verified in source code or official docs | Proceed with confidence |
| **likely** | Found in multiple reliable sources | Proceed, verify edge cases |
| **uncertain** | Found in single source | Verify before implementing |
| **speculative** | Inferred but not confirmed | Test assumption explicitly |

## Knowledge Graph Integration

Before researching a topic, check the knowledge graph for existing context:

```bash
# Query for existing knowledge
node scripts/agent-skills-graph.js query "<topic>" --budget 10

# Check graph status
node scripts/agent-skills-graph.js status
```

If the graph is available and contains relevant information:
- Use it as a starting point for your research
- Note any gaps or outdated information
- Update the graph with new findings after research completes

If the graph is not available or empty:
- Proceed with standard research workflow
- Consider building the graph if research reveals significant relationships

## Research Rules

1. **Research before planning.** Never skip research.
2. **Be specific.** Cite file paths and line numbers.
3. **Check before assuming.** If unsure, verify.
4. **Record what you didn't find.** Knowing gaps is valuable.
5. **Be concise.** Research report feeds into planning.
6. **Check the graph first.** Existing knowledge accelerates research.
7. **One research workflow.** Internal and external research are modes of this skill, not separate skills.
8. **Use map-codebase selectively.** Create or refresh a repo map only when broad durable context is needed.
9. **Match external source to question.** Documentation questions use official docs; trade-off questions use real-world evidence.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I know this codebase already." | Current code is the source of truth. Verify before planning. |
| "Research will slow me down." | Bad assumptions cost more than a short research pass. |
| "The task is mostly obvious." | Obvious tasks still need pattern and dependency checks. |
| "External research is a separate workflow." | External research is a mode of this skill. Keep one research workflow and one researcher persona. |
| "Map the repo before every research task." | Mapping is durable and repo-wide. Use it when broad context is needed, not for narrow local questions. |

## Red Flags

- Planning before checking existing code patterns.
- Guessing dependency versions or APIs.
- Skipping research because the requested change sounds small.
- Producing recommendations without cited files, docs, or evidence.
- Running `map-codebase` for a narrow local question where targeted reads would be clearer.
- Invoking a separate external research workflow instead of using `research` mode `external`.

## Verification

- [ ] Research brief or notes identify the question being answered.
- [ ] Research mode is explicit: `internal`, `external`, or `both`.
- [ ] Internal findings cite concrete files and line numbers where applicable.
- [ ] External findings cite authoritative docs or reliable sources where applicable.
- [ ] `map-codebase` was used only if broad repo-wide context was needed, or existing `tasks/codebase/` docs were consulted when available.
- [ ] Unknowns and risks are recorded instead of hidden.
- [ ] Recommendations are specific enough to feed planning.
