# Installing Agent Skills for OpenCode

## Prerequisites

- [OpenCode.ai](https://opencode.ai) installed

## Installation

Add agent-skills to the `plugin` array in your `opencode.json` (global or project-level):

```json
{
  "plugin": ["agent-skills@git+https://gitlab.com/msidev4-group/agent-skills.git"]
}
```

Restart OpenCode. The plugin installs through OpenCode's plugin manager and
registers all skills.

Verify by asking: "Tell me about your skills"

## Usage

Use OpenCode's natural language — the agent automatically selects the right skill:

- "Add authentication" → `spec-driven-development`
- "Fix this bug" → `debugging-and-error-recovery`
- "Review this code" → `code-review-and-quality`
- "Plan this feature" → `planning-and-task-breakdown`
- "Map this codebase" → `map-codebase` (brownfield repos)

Or use the `skill` tool explicitly:

```
use skill tool to list skills
use skill tool to load research
```

## How It Works

The plugin:
1. Registers `skills/` directory so OpenCode discovers all 28 skills
2. Injects `using-agent-skills` as bootstrap context (the routing meta-skill)
3. The agent auto-chains skills based on intent — no manual commands needed

## Updating

To pin a specific version:

```json
{
  "plugin": ["agent-skills@git+https://gitlab.com/msidev4-group/agent-skills.git#v2.0.0"]
}
```

## Troubleshooting

### Plugin not loading

1. Verify the plugin line in your `opencode.json`
2. Make sure you're running a recent version of OpenCode
3. Check that the `skills/` directory exists in the cloned repo

### Skills not found

1. Use `skill` tool to list what's discovered
2. Check that the plugin is loading (see above)

### Tool mapping

Skills speak in actions ("create a todo", "dispatch a subagent", "read a file"). On OpenCode these resolve to:

- "Create a todo" / "mark complete in todo list" → `todowrite`
- `Subagent (general-purpose):` → `task` tool with `subagent_type: "general"`
- "Invoke a skill" → OpenCode's native `skill` tool
- "Read a file" → `read`
- "Create a file" / "edit a file" / "delete a file" → `apply_patch`
- "Run a shell command" → `bash`
- "Search file contents" / "find files by name" → `grep`, `glob`
- "Fetch a URL" → `webfetch`
