---
name: knowledge-graph
description: Build, query, and maintain a knowledge graph of concepts, decisions, and relationships. Use when exploring codebase architecture, mapping dependencies, tracking decision rationale, or visualizing project knowledge.
---

# Knowledge Graph

## Overview

Maintain a machine-readable knowledge graph of concepts, decisions, and relationships across the project. Query for related concepts, track changes over time, and visualize project knowledge.

## When to Use

- Exploring codebase architecture and module relationships
- Mapping dependencies between components
- Tracking decision rationale and technical debt
- Visualizing project knowledge for onboarding
- Research tasks requiring relationship mapping

## How It Works

1. Graphify CLI builds knowledge graph from codebase
2. Graph stored in `tasks/graphs/graph.json`
3. Query for related concepts and dependencies
4. Snapshot for diffing changes over time
5. Auto-update hook keeps graph fresh after commits

## Usage

```bash
node scripts/agent-skills-graph.js status
node scripts/agent-skills-graph.js build
node scripts/agent-skills-graph.js query <term> [--budget N]
node scripts/agent-skills-graph.js diff
node scripts/agent-skills-graph.js snapshot
node scripts/agent-skills-graph.js auto-update <commit|merge|pull|rebase|cherry-pick>
```

**Commands:**
- `status` - Check graphify configuration and build status
- `build` - Build or rebuild the knowledge graph
- `query <term>` - Search for concepts matching term
- `diff` - Compare current graph against snapshot
- `snapshot` - Create snapshot for future diffing
- `auto-update` - Trigger auto-update after HEAD-advancing command

**Examples:**
```bash
# Check if graph is available
node scripts/agent-skills-graph.js status

# Build knowledge graph
node scripts/agent-skills-graph.js build

# Query for authentication concepts
node scripts/agent-skills-graph.js query "authentication" --budget 10

# See what changed since last snapshot
node scripts/agent-skills-graph.js diff

# Create snapshot before major changes
node scripts/agent-skills-graph.js snapshot
```

## Setup

### Enable Graphify

Add to `tasks/config.json`:

```json
{
  "graphify": {
    "enabled": true,
    "auto_update": false,
    "stale_after_hours": 24
  }
}
```

### Install Graphify CLI

```bash
pip install graphifyy
```

### Enable Auto-Update (Optional)

To automatically rebuild graph after commits:

```json
{
  "graphify": {
    "enabled": true,
    "auto_update": true
  }
}
```

The auto-update hook runs after HEAD-advancing git commands (commit, merge, pull, rebase, cherry-pick).

## Output

### tasks/graphs/graph.json

Machine-readable graph structure:

```json
{
  "nodes": [
    {
      "id": "node-id",
      "type": "concept|decision|file|module",
      "properties": {
        "title": "Concept Name",
        "description": "What this concept represents"
      }
    }
  ],
  "edges": [
    {
      "source": "source-node-id",
      "target": "target-node-id",
      "type": "related_to|depends_on|implements|decides"
    }
  ]
}
```

### tasks/graphs/snapshot.json

Previous graph state for diffing:

```json
{
  "nodes": [...],
  "edges": [...],
  "snapshot_timestamp": "2026-06-20T12:00:00.000Z"
}
```

### tasks/graphs/.last-build-status.json

Build metadata:

```json
{
  "status": "ok|failed",
  "timestamp": "2026-06-20T12:00:00.000Z",
  "duration_ms": 1234,
  "auto_update": false,
  "triggered_by": null
}
```

## Query Results

Query results include:

- **Matching nodes** - Concepts matching the search term
- **Related edges** - Relationships connected to matching nodes
- **Summary** - Count of matches vs total graph size

Example query output:

```json
{
  "status": "ok",
  "query": "authentication",
  "budget": 10,
  "results": [
    {
      "id": "auth-module",
      "type": "module",
      "title": "Authentication Module",
      "description": "Handles user authentication and session management",
      "edges": [
        {
          "source": "auth-module",
          "target": "user-model",
          "type": "depends_on"
        }
      ]
    }
  ],
  "summary": {
    "nodes_found": 3,
    "total_nodes": 150,
    "edges_related": 5
  }
}
```

## Present Results to User

When presenting graph results:

1. **Start with summary** - "Found 3 concepts related to 'authentication' in a graph of 150 nodes"
2. **Show key nodes** - List the most relevant concepts with titles and descriptions
3. **Highlight relationships** - Show how concepts connect to each other
4. **Offer follow-up** - "Would you like me to query for related concepts or build a more detailed graph?"

## Integration with Other Skills

### Research

When researching a topic, query the graph first to understand existing knowledge:

```bash
# Check what we already know
node scripts/agent-skills-graph.js query "topic"

# Research new information
# ... (use research skill)
```

### Planning

Before planning implementation, query the graph for related decisions:

```bash
# Find related decisions
node scripts/agent-skills-graph.js query "decision"

# Check dependencies
node scripts/agent-skills-graph.js query "depends_on"
```

## Common Rationalizations

- "The graph is stale, I'll just search manually" — Stale graph still has useful structure; query it and note staleness
- "I don't need a graph for this small change" — Even small changes benefit from understanding context
- "Graphify isn't installed, I'll skip this" — Graphify is optional; skills work without it
- "Auto-update will slow down my commits" — Auto-update runs in background, non-blocking

## Red Flags

- **Graph is >24 hours old** — Run `build` to refresh before important queries
- **Query returns no results** — Graph may be empty or too small; run `build` first
- **Build fails** — Check Graphify installation and project configuration
- **Auto-update conflicts** — Check lock file in `tasks/graphs/` for concurrent builds

## Verification

After making changes:

```bash
# Verify graph builds successfully
node scripts/agent-skills-graph.js build

# Verify query works
node scripts/agent-skills-graph.js query "test"

# Verify snapshot creates correctly
node scripts/agent-skills-graph.js snapshot

# Verify diff works after changes
node scripts/agent-skills-graph.js diff
```

All commands should return `status: "ok"` when graphify is enabled and properly configured.
