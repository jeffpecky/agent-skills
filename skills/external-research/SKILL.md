---
name: external-research
description: Research external APIs, libraries, and frameworks before implementing. Uses Context7 MCP for framework/library documentation and web search for architecture decisions, performance benchmarks, and production case studies. Works with the internal researcher for complete context gathering.
---

# External Research

Gather external context before jumping into solutions. Research first, implement second.

## When to Use

- Before starting any non-trivial implementation
- When you need to understand an API, library, or framework
- When the spec requires external knowledge (web APIs, third-party services)
- When debugging requires understanding external system behavior
- When the user asks about something you're unsure about

**When NOT to use:** Pure internal codebase changes with no external dependencies.

## Two Sources, Different Roles

Context7 and web search serve distinct purposes. Use the right one for the right question.

### Context7 MCP — Framework & Library Documentation

**Use Context7 for:**
- Framework API signatures and usage patterns
- Library configuration and setup
- Official examples and code snippets
- Version-specific behavior and changes
- Official migration guides between versions

**Context7 Setup:**

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"]
    }
  }
}
```

**Available Tools:**

| Tool | What It Does |
|------|-------------|
| **resolve-library-id** | Maps a library name to its Context7 ID |
| **get-library-docs** | Fetches up-to-date documentation for a library |

**Questions Context7 Answers:**
- "How do I configure Prisma with PostgreSQL?"
- "What's the Socket.io API for rooms?"
- "How does Express middleware work?"
- "What changed in React 19?"

### Web Search — Real-World Context

**Use web search for:**
- Architecture decisions and design patterns
- Performance benchmarks and comparisons
- Production war stories and case studies
- Tool comparisons and trade-off analysis
- Community-validated solutions to known issues

**Questions Web Search Answers:**
- "Should we use event sourcing for this feature?"
- "Which ORM is fastest for PostgreSQL in production?"
- "How did Stripe handle idempotency at scale?"
- "React vs Vue vs Svelte for this use case?"
- "What are the pitfalls of serverless with Prisma?"

**Web Search Use Cases:**

| Use Case | Why Context7 Isn't Enough | Example Question |
|----------|--------------------------|------------------|
| **Architecture decisions** | Requires case studies and real-world validation | "Should we use event sourcing?" |
| **Performance optimization** | Requires benchmarks, not API docs | "What's the fastest caching strategy?" |
| **Production war stories** | Requires engineering blog posts | "How did X company solve Y?" |
| **Tool comparison** | Requires trade-off analysis articles | "A vs B for our use case?" |

## Source Selection Guide

| Question Type | Source | Example |
|---------------|--------|---------|
| API documentation | Context7 | "How do I use Prisma's `findMany`?" |
| Configuration | Context7 | "How to set up Socket.io with Express?" |
| Architecture decision | Web search | "Should we use event sourcing?" |
| Performance comparison | Web search | "Which caching library is fastest?" |
| Production patterns | Web search | "How did X company solve Y?" |
| Tool trade-offs | Web search | "Prisma vs Drizzle vs TypeORM?" |
| Version migration | Context7 | "How to migrate from Prisma 4 to 5?" |
| Known issues | Web search | "Prisma connection pooling with Lambda" |

**Rule:** Match the question to the source. Don't use Context7 for architecture advice. Don't use web search for API signatures.

## Research Protocol

### Step 1: Define Research Question

Before searching, articulate what you need to learn:

```
Research Question: {What specifically do I need to understand?}
Source Type: {Documentation | Real-world context}
```

### Step 2: Query the Right Source

**For documentation questions:**
```
resolve-library-id: {library-name}
get-library-docs: {specific question}
```

**For real-world context questions:**
```
web search: "{architecture|performance|case study question}"
```

**For both (when you need docs AND real-world context):**
```
1. Context7 for API details
2. Web search for production patterns
```

### Step 3: Write Research Log

Create `tasks/reports/RESEARCH.md`:

```markdown
# Research Log

## Research Question
{What we needed to understand}

## Sources Consulted

### Context7
- {What you looked up}
- {Result: found | not found}

### Web Search
- {What you searched for}
- {Result: found | not found}

## Key Findings

### {Finding 1 Title}
- **Source**: Context7 | Web search
- **Confidence**: certain | likely | uncertain | speculative
- **Evidence**: {Exact quote, code, or data}
- **Implication**: {What this means for implementation}

## Open Questions
- {Questions that remain unanswered}

## Recommendations
1. {Actionable recommendation based on research}
```

## Confidence Levels

| Level | Definition | Action |
|-------|------------|--------|
| **certain** | Verified in official docs or source code | Proceed with confidence |
| **likely** | Found in multiple reliable sources | Proceed, verify edge cases |
| **uncertain** | Found in single source or unofficial | Verify before implementing |
| **speculative** | Inferred but not confirmed | Test assumption explicitly |

## Research Rules

1. **Match question to source.** Documentation → Context7. Real-world context → Web search.
2. **Cite sources.** Mark each finding as Context7 or Web search.
3. **Don't repeat.** If Context7 has the answer, don't web search the same thing.
4. **Record what you didn't find.** Knowing what's NOT documented is valuable.
5. **Verify with code when possible.** Documentation lies; running code doesn't.

## Two-Researcher Pattern

agent-skills has two complementary research patterns:

```
┌─────────────────────────────────────────────────────────┐
│                    RESEARCH PHASE                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────┐      ┌──────────────────┐         │
│  │ External Research │      │ Internal Research │         │
│  │ (this skill)      │      │ (researcher.md)   │         │
│  │                   │      │                   │         │
│  │ • APIs            │      │ • Existing code   │         │
│  │ • Libraries       │      │ • Patterns        │         │
│  │ • Frameworks      │      │ • Conventions     │         │
│  │ • Documentation   │      │ • Dependencies    │         │
│  └────────┬──────────┘      └────────┬──────────┘         │
│           │                          │                    │
│           └──────────┬───────────────┘                    │
│                      │                                    │
│                      ▼                                    │
│            ┌──────────────────┐                           │
│            │ Merged Context   │                           │
│            │ (RESEARCH.md)    │                           │
│            └──────────────────┘                           │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

| Researcher | Scope | Output | Tool |
|------------|-------|--------|------|
| **External** (this skill) | APIs, libraries, frameworks | `tasks/reports/RESEARCH.md` | Context7 + Web search |
| **Internal** (researcher.md) | Existing codebase patterns | `tasks/reports/research-report.md` | File system search |

### When to Use Which

| Situation | Use |
|-----------|-----|
| "How does the Cloudflare KV API work?" | External researcher |
| "What patterns does this codebase use for auth?" | Internal researcher |
| "How do I use Prisma with PostgreSQL?" | External researcher |
| "Where is the user service defined?" | Internal researcher |
| "What's the best way to implement WebSockets with this framework?" | Both |

## Example: Context7 Only

```markdown
# Research Log

## Research Question
How does Prisma handle database migrations in production?

## Sources Consulted

### Context7
- Prisma migration docs
- Result: Complete coverage

## Key Findings

### Migration Deployment
- **Source**: Context7
- **Confidence**: certain
- **Evidence**: `prisma migrate deploy` applies pending migrations without generating new ones.
- **Implication**: Use `migrate deploy` in CI/CD, not `migrate dev`

## Recommendations
1. Use `prisma migrate deploy` in production deployments
```

## Example: Web Search Only

```markdown
# Research Log

## Research Question
Should we use event sourcing for the order management system?

## Sources Consulted

### Web Search
- "Event sourcing in production" blog post
- "Event sourcing vs CRUD" comparison article
- Result: Found relevant case studies

## Key Findings

### Event Sourcing Trade-offs
- **Source**: Web search
- **Confidence**: likely
- **Evidence**: "Event sourcing excels at audit trails and temporal queries but adds complexity for simple CRUD operations" —martinfowler.com
- **Implication**: Good fit for order management (audit trail needed), but adds complexity

### Production Case Study
- **Source**: Web search
- **Confidence**: likely
- **Evidence**: "Shopify migrated to event sourcing for inventory management, reduced inconsistencies by 95%" —engineering.shopify.com
- **Implication**: Validated approach for similar domain

## Recommendations
1. Use event sourcing for order management (audit trail requirement)
2. Start with simple event store, evolve as needed
```

## Example: Both Sources

```markdown
# Research Log

## Research Question
How to implement real-time notifications with WebSockets and Express?

## Sources Consulted

### Context7
- Socket.io API docs
- Express middleware docs
- Result: Complete API coverage

### Web Search
- "Socket.io production deployment" blog post
- Result: Production patterns and pitfalls

## Key Findings

### Socket.io API
- **Source**: Context7
- **Confidence**: certain
- **Evidence**: `const io = new Server(httpServer)` attaches to existing HTTP server
- **Implication**: Can integrate with existing Express app

### Production Deployment
- **Source**: Web search
- **Confidence**: likely
- **Evidence**: "Use Redis adapter for horizontal scaling, sticky sessions for load balancers" —blog post
- **Implication**: Need Redis adapter for production

### Connection Handling
- **Source**: Web search
- **Confidence**: likely
- **Evidence**: "Implement heartbeat and reconnection logic, default timeout is 20s" —Stack Overflow
- **Implication**: Add custom timeout and reconnection

## Recommendations
1. Use Socket.io with Express (Context7 finding)
2. Add Redis adapter for production scaling (Web search finding)
3. Implement heartbeat and reconnection logic (Web search finding)
```
```
