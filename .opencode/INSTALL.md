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

Use OpenCode's native `skill` tool:

```
use skill tool to list skills
use skill tool load spec-driven-development
```

Or just use natural language — the agent auto-selects the right skill:

- "Add authentication" → `spec-driven-development`
- "Fix this bug" → `debugging-and-error-recovery`
- "Review this code" → `code-review-and-quality`
- "Plan this feature" → `planning-and-task-breakdown`
- "Map this codebase" → `map-codebase` (brownfield repos)

## Updating

OpenCode installs Agent Skills through a git-backed package spec. Some OpenCode
and Bun versions pin that resolved git dependency in a lockfile or cache, so a
restart may not pick up the newest commit. If updates do not appear, clear
OpenCode's package cache or reinstall the plugin.

To pin a specific version:

```json
{
  "plugin": ["agent-skills@git+https://gitlab.com/msidev4-group/agent-skills.git#v2.0.0"]
}
```

## Troubleshooting

### Plugin not loading

1. Check logs: `opencode run --print-logs "hello" 2>&1 | grep -i agent-skills`
2. Verify the plugin line in your `opencode.json`
3. Make sure you're running a recent version of OpenCode

### Windows install issues

Some Windows OpenCode builds have upstream installer issues with git-backed
plugin specs. If OpenCode cannot install the plugin, try installing with system
npm and pointing OpenCode at the local package:

```powershell
npm install agent-skills@git+https://gitlab.com/msidev4-group/agent-skills.git --prefix "$HOME\.config\opencode"
```

Then use the installed package path in `opencode.json`:

```json
{
  "plugin": ["~/.config/opencode/node_modules/agent-skills"]
}
```

### Skills not found

1. Use `skill` tool to list what's discovered
2. Check that the plugin is loading (see above)

### Tool mapping

Skills speak in actions ("create a todo", "dispatch a subagent", "read a file"). On OpenCode these resolve to:

- "Create a todo" / "mark complete in todo list" → `todowrite`
- `Subagent (general-purpose):` → `task` tool with `subagent_type: "general"` (or `"explore"` for codebase exploration)
- "Invoke a skill" → OpenCode's native `skill` tool
- "Read a file" → `read`
- "Create a file" / "edit a file" / "delete a file" → `apply_patch`
- "Run a shell command" → `bash`
- "Search file contents" / "find files by name" → `grep`, `glob`
- "Fetch a URL" → `webfetch`
