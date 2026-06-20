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

## Research Sources

### Internal — Codebase Patterns

**Use for:**
- Existing code patterns and conventions
- File structure and module organization
- Dependency versions and configurations
- Related implementations in the codebase

**How:**
1. Invoke the `researcher` persona
2. Pass the research brief
3. Researcher outputs `tasks/reports/research-report.md`

### External — APIs, Libraries, Frameworks

**Use for:**
- Framework API signatures and usage patterns
- Library configuration and setup
- Architecture decisions and design patterns
- Performance benchmarks and comparisons

**Tools:**
- Context7 MCP — documentation
- Web search — real-world context

## Research Protocol

### Step 1: Define Research Question

```
Research Question: {What specifically do I need to understand?}
Source Type: {Internal | External | Both}
```

### Step 2: Execute Research

**For internal research:**
```
invoke_persona "researcher"
Brief: Investigate {topic} in codebase
Output: tasks/reports/research-report.md
```

**For external research:**
```
Context7: resolve-library-id → get-library-docs
Web search: "{question}"
```

**For both:**
```
1. Internal: researcher persona → research-report.md
2. External: Context7 + web search → RESEARCH.md
```

### Step 3: Write Research Log

Create `tasks/reports/RESEARCH.md`:

```markdown
# Research Log

## Research Question
{What we needed to understand}

## Internal Findings
- {file}:{line} — {pattern description}
- {file}:{line} — {pattern description}

## External Findings

### Context7
- {library}: {finding}

### Web Search
- {question}: {finding}

## Key Takeaways
- {Takeaway 1}
- {Takeaway 2}

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

## Rules

1. **Research before planning.** Never skip research.
2. **Be specific.** Cite file paths and line numbers.
3. **Check before assuming.** If unsure, verify.
4. **Record what you didn't find.** Knowing gaps is valuable.
5. **Be concise.** Research report feeds into planning.
