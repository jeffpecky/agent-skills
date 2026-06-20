---
name: research
description: Research codebase patterns, conventions, and external APIs before implementing. Use when starting any non-trivial task to understand existing code and external dependencies.
---

# Research

Gather context before implementing. Research first, implement second.

## When to Use

- Before any implementation task
- When you need to understand existing patterns
- When external APIs or libraries are involved
- When requirements are unclear

## How It Works

1. Create research brief
2. Researcher persona investigates codebase
3. Researcher finds external APIs/docs
4. Research findings written to `tasks/reports/`

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
- Architecture decisions and design patterns
- Performance benchmarks and comparisons

**Tools:**
- Context7 MCP — documentation
- Web search — real-world context

**How:**
1. Researcher persona uses Context7 for API docs
2. Researcher persona uses web search for patterns
3. Outputs `tasks/reports/RESEARCH.md`

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

## Research Rules

1. **Research before planning.** Never skip research.
2. **Be specific.** Cite file paths and line numbers.
3. **Check before assuming.** If unsure, verify.
4. **Record what you didn't find.** Knowing gaps is valuable.
5. **Be concise.** Research report feeds into planning.
