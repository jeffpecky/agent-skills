# Small Context Mode (<200K tokens)

For models with smaller context windows (Sonnet, Haiku, etc.).

## Strategy

Extract to files, reference on-demand. Keep core task in context.

## Context Loading

- Load only essential sections from CLAUDE.md
- Extract examples to separate files
- Reference source files via @-references
- Load wave summaries only when needed

## File Extraction Pattern

Move extended content to separate files:

```
context-engineering/
  references/
    examples-large-context.md
    examples-small-context.md
    patterns-extended.md
```

## Benefits

- Fits more tasks in context
- Faster responses
- Better focus on current task

## Risks

- More file reads needed
- May miss cross-file patterns
- Requires more context management

## When to Use

- Single-file changes
- Simple bug fixes
- Well-defined tasks with clear scope
