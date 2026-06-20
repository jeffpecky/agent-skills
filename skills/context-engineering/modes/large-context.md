# Large Context Mode (>=500K tokens)

For models with large context windows (Opus, GPT-4, etc.).

## Strategy

Load everything upfront. No lazy-loading needed.

## Context Loading

- Load full CLAUDE.md at session start
- Load full spec document
- Load all relevant source files
- Load prior wave summaries
- Load cross-phase context

## Benefits

- No need to manage context budget
- Can hold entire codebase in context
- Cross-file reasoning is easier

## Risks

- Higher token cost
- May lose focus in very large contexts
- Slower responses

## When to Use

- Complex features spanning multiple files
- Architecture decisions requiring full codebase view
- Debugging across multiple components
