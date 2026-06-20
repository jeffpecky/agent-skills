# Agent Skills

**Production-grade engineering skills for AI coding agents.**

Skills encode the workflows, quality gates, and best practices that senior engineers use when building software. These ones are packaged so AI agents follow them consistently across every phase of development.

![Addy's Agent Skills](https://addyosmani.com/assets/images/addys-agent-skills.jpg)

```
  DEFINE          PLAN           BUILD          VERIFY         REVIEW          SHIP
 ┌──────┐      ┌──────┐      ┌──────┐      ┌──────┐      ┌──────┐      ┌──────┐
 │ Idea │ ───▶ │ Spec │ ───▶ │ Code │ ───▶ │ Test │ ───▶ │  QA  │ ───▶ │  Go  │
 │Refine│      │  PRD │      │ Impl │      │Debug │      │ Gate │      │ Live │
 └──────┘      └──────┘      └──────┘      └──────┘      └──────┘      └──────┘
  /spec          /plan          /build        /test         /review       /ship
```

---

## How It Works

Agent Skills uses a **two-path routing** system and **fresh-context subagents** to prevent context rot:

### Path 1: Non-trivial work (features, projects, significant changes)

The pipeline auto-chains through 6 skills. Interview-me is MANDATORY:

```
User says "build X"
    │
    ▼
interview-me (MANDATORY — understand what they really want)
    │
    ├── Intent vague ──→ idea-refine ──→ spec-driven-development
    │                                        │
    └── Intent concrete ──→ spec-driven-development
                                        │
                                        ▼
                          planning-and-task-breakdown
                          (dependency analysis + task ordering)
                                        │
                                        ▼
                          fresh-context-execution
                          (every task gets a fresh subagent)
                          (automatic parallel execution)
                          (worktree isolation for concurrent tasks)
                          (cross-area coordination via workstreams)
                                        │
                                        ▼
                          code-review-and-quality
                                        │
                                        ▼
                              shipping-and-launch (DONE)
```

### Path 2: Quick tasks (single-line fixes, typos, small changes)

Route directly to the right skill. No interview needed.

### Context Rot Prevention

Each task in the pipeline is dispatched to a **fresh subagent** with a clean context window. The orchestrator stays lean — it only coordinates, collects results, and routes to the next phase. This structurally prevents the quality degradation that accumulates when you run many tasks in one session.

### Session Recovery

A shared state file (`tasks/STATE.md`) persists across sessions. The session-start hook reads it on startup, so you can close Claude, reopen it, and resume from where you left off.

### Lifecycle Kernel

Agent Skills is Markdown-first, but it includes a small Node-based lifecycle kernel under `scripts/` so serious workflows have enforceable state, trace, and gates:

```bash
node scripts/agent-skills-state.js init --goal "build X"
node scripts/agent-skills-state.js transition spec
node scripts/agent-skills-trace.js skill.invoked skill=spec-driven-development
node scripts/agent-skills-pipeline.js validate
```

`tasks/trace.jsonl` is both runtime audit evidence and test input. Tests use it to prove lifecycle compliance; agents and humans use it to resume and debug the workflow.

### Multi-Area Projects (Workstreams)

For projects with parallel areas (backend, frontend, infra), Agent Skills supports **workstreams** — isolated planning contexts that share code but maintain separate state:

```bash
# Create workstreams for each area
node scripts/agent-skills-workstream.js create backend-api --area backend
node scripts/agent-skills-workstream.js create frontend-dash --area frontend
node scripts/agent-skills-workstream.js create infrastructure --area infra

# Add cross-area dependencies
node scripts/agent-skills-workstream.js add-dependency backend-api frontend-dash

# Get execution plan (waves, order)
node scripts/agent-skills-workstream.js execution-plan

# Select active workstream and execute
node scripts/agent-skills-workstream.js select backend-api
```

Each workstream gets its own `tasks/workstreams/{name}/STATE.md` with isolated progress tracking, while cross-area dependencies are respected during execution.

---

## Commandless by Default

Agent Skills works like Superpowers: invoke `using-agent-skills`, then the meta-skill routes and auto-chains the lifecycle. The user should not need to run `/spec`, `/plan`, `/build`, `/test`, `/review`, or `/ship` for normal end-to-end work.

```text
User says "build X"
  ↓
using-agent-skills routes intent
  ↓
state + trace initialized
  ↓
interview-me → spec-driven-development → planning-and-task-breakdown
  ↓
fresh-context-execution → code-review-and-quality → shipping-and-launch
  ↓
pipeline validation + completion trace
```

## Optional Commands

7 slash commands map to the development lifecycle for platforms and users that prefer explicit entry points. They are convenience wrappers around the same skills and artifacts; they are not the primary orchestration model.

| What you're doing | Command | Key principle |
|-------------------|---------|---------------|
| Define what to build | `/spec` | Interview first, then spec |
| Plan how to build it | `/plan` | Small, atomic tasks |
| Build incrementally | `/build` | One slice at a time |
| Prove it works | `/test` | Tests are proof |
| Review before merge | `/review` | Improve code health |
| Simplify the code | `/code-simplify` | Clarity over cleverness |
| Ship to production | `/ship` | Faster is safer |

Want fewer manual steps once the spec exists? **`/build auto`** generates the plan and implements every task using fresh-context subagents — you approve the plan once, then it runs autonomously. Each task gets a clean context window to prevent context rot.

Skills also activate automatically based on what you're doing — designing an API triggers `api-and-interface-design`, building UI triggers `frontend-ui-engineering`, and so on.

During commandless runs, `using-agent-skills` also performs conditional checkpoints before each lifecycle phase and task dispatch. Failures stop the line with `debugging-and-error-recovery`; API/interface work invokes `api-and-interface-design`; user-facing UI invokes `frontend-ui-engineering`; browser, security, performance, source-docs, observability, and simplification skills fire when their triggers appear.

---

## Quick Start

<details>
<summary><b>Claude Code (recommended)</b></summary>

**Marketplace install:**

```
/plugin marketplace add addyosmani/agent-skills
/plugin install agent-skills@addy-agent-skills
```

> **SSH errors?** The marketplace clones repos via SSH. If you don't have SSH keys set up on GitHub, either [add your SSH key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/adding-a-new-ssh-key-to-your-github-account) or use the full HTTPS URL to force the HTTPS cloning:
> ```bash
> /plugin marketplace add https://github.com/addyosmani/agent-skills.git
> /plugin install agent-skills@addy-agent-skills
> ```

**Local / development:**

```bash
git clone https://github.com/addyosmani/agent-skills.git
claude --plugin-dir /path/to/agent-skills
```

</details>

<details>
<summary><b>Cursor</b></summary>

Copy any `SKILL.md` into `.cursor/rules/`, or reference the full `skills/` directory. See [docs/cursor-setup.md](docs/cursor-setup.md).

</details>

<details>
<summary><b>Antigravity CLI</b></summary>

Install as a native plugin for skills, subagents, and slash commands. See [docs/antigravity-setup.md](docs/antigravity-setup.md).

**Install from the repo:**

```bash
agy plugin install https://github.com/addyosmani/agent-skills.git
```

**Install from a local clone:**

```bash
git clone https://github.com/addyosmani/agent-skills.git
agy plugin install ./agent-skills
```

</details>

<details>
<summary><b>Gemini CLI</b></summary>

Install as native skills for auto-discovery, or add to `GEMINI.md` for persistent context. See [docs/gemini-cli-setup.md](docs/gemini-cli-setup.md).

**Install from the repo:**

```bash
gemini skills install https://github.com/addyosmani/agent-skills.git --path skills
```

**Install from a local clone:**

```bash
gemini skills install ./agent-skills/skills/
```

</details>

<details>
<summary><b>Windsurf</b></summary>

Add skill contents to your Windsurf rules configuration. See [docs/windsurf-setup.md](docs/windsurf-setup.md).

</details>

<details>
<summary><b>OpenCode</b></summary>

Uses agent-driven skill execution via AGENTS.md and the `skill` tool.

See [docs/opencode-setup.md](docs/opencode-setup.md).

</details>

<details>
<summary><b>GitHub Copilot</b></summary>

Use agent definitions from `agents/` as Copilot personas and skill content in `.github/copilot-instructions.md`. See [docs/copilot-setup.md](docs/copilot-setup.md).

</details>

<details>
  <summary><b>Kiro IDE & CLI </b></summary>
  Skills for Kiro reside under ".kiro/skills/" and can be stored under Project or Global level. Kiro also supports Agents.md. See Kiro docs at https://kiro.dev/docs/skills/
</details>

<details>
<summary><b>Codex / Other Agents</b></summary>

Skills are plain Markdown - they work with any agent that accepts system prompts or instruction files. See [docs/getting-started.md](docs/getting-started.md).

</details>

---

## All 28 Skills

The pack includes 28 skills total — 25 lifecycle skills plus 3 meta-skills (`using-agent-skills`, `skill-router`, `state-management`). Each skill is a structured workflow with steps, verification gates, and anti-rationalization tables.

### Meta - Routing and coordination

| Skill | What It Does | Use When |
|-------|-------------|----------|
| [using-agent-skills](skills/using-agent-skills/SKILL.md) | Meta-skill: 1% enforcement, two-path routing, auto-chaining rules | Starting a session or deciding which skill applies |
| [skill-router](skills/skill-router/SKILL.md) | Compact JSON index for token-efficient skill routing | Minimizing context usage during skill discovery |
| [state-management](skills/state-management/SKILL.md) | Shared state file (tasks/STATE.md) that persists across sessions | Starting or resuming any multi-step work |

### Define - Clarify what to build

| Skill | What It Does | Use When |
|-------|-------------|----------|
| [interview-me](skills/interview-me/SKILL.md) | **MANDATORY for non-trivial work.** One-question-at-a-time interview until ~95% confidence about intent | Starting any new feature or project |
| [idea-refine](skills/idea-refine/SKILL.md) | Structured divergent/convergent thinking to turn vague ideas into concrete proposals | You have a rough concept that needs exploration |
| [spec-driven-development](skills/spec-driven-development/SKILL.md) | Write a PRD covering objectives, commands, structure, code style, testing, and boundaries | Starting a new project, feature, or significant change |

### Plan - Break it down

| Skill | What It Does | Use When |
|-------|-------------|----------|
| [planning-and-task-breakdown](skills/planning-and-task-breakdown/SKILL.md) | Decompose specs into small, verifiable tasks with acceptance criteria and dependency ordering | You have a spec and need implementable units |

### Build - Write the code

| Skill | What It Does | Use When |
|-------|-------------|----------|
| [fresh-context-execution](skills/fresh-context-execution/SKILL.md) | Execute plans using fresh-context subagents to prevent context rot. Every task gets a clean window. | Every implementation task (always, no exceptions) |
| [using-git-worktrees](skills/using-git-worktrees/SKILL.md) | Creates isolated workspaces for parallel task execution. Prevents file conflicts between parallel agents. | Before fresh-context-execution when tasks can run in parallel |
| [context-engineering](skills/context-engineering/SKILL.md) | Feed agents the right information at the right time | Starting a session, switching tasks |
| [source-driven-development](skills/source-driven-development/SKILL.md) | Ground every framework decision in official documentation | Using frameworks/libs where correctness matters |
| [doubt-driven-development](skills/doubt-driven-development/SKILL.md) | Adversarial fresh-context review of every non-trivial decision | High stakes, unfamiliar code |
| [frontend-ui-engineering](skills/frontend-ui-engineering/SKILL.md) | Component architecture, design systems, responsive design, WCAG 2.1 AA | Building or modifying user-facing interfaces |
| [api-and-interface-design](skills/api-and-interface-design/SKILL.md) | Contract-first design, Hyrum's Law, error semantics | Designing APIs, module boundaries |
| [test-driven-development](skills/test-driven-development/SKILL.md) | Red-Green-Refactor, test pyramid, DAMP over DRY, Beyonce Rule | Implementing logic, fixing bugs |

### Verify - Prove it works

| Skill | What It Does | Use When |
|-------|-------------|----------|
| [debugging-and-error-recovery](skills/debugging-and-error-recovery/SKILL.md) | 6-step triage with multi-component diagnostic, data flow tracing, defense-in-depth | Tests fail, builds break, behavior unexpected |
| [browser-testing-with-devtools](skills/browser-testing-with-devtools/SKILL.md) | Chrome DevTools MCP for live runtime data | Building or debugging anything in a browser |

### Review - Quality gates before merge

| Skill | What It Does | Use When |
|-------|-------------|----------|
| [code-review-and-quality](skills/code-review-and-quality/SKILL.md) | Five-axis review, change sizing, severity labels | Before merging any change |
| [code-simplification](skills/code-simplification/SKILL.md) | Chesterton's Fence, Rule of 500, reduce complexity | Code works but is harder to read than it should be |
| [security-and-hardening](skills/security-and-hardening/SKILL.md) | OWASP Top 10 prevention, auth patterns, secrets management | Handling user input, auth, data storage |
| [performance-optimization](skills/performance-optimization/SKILL.md) | Measure-first approach, Core Web Vitals, profiling | Performance requirements exist |

### Ship - Deploy with confidence

| Skill | What It Does | Use When |
|-------|-------------|----------|
| [git-workflow-and-versioning](skills/git-workflow-and-versioning/SKILL.md) | Trunk-based development, atomic commits, commit-as-save-point | Making any code change (always) |
| [ci-cd-and-automation](skills/ci-cd-and-automation/SKILL.md) | Shift Left, feature flags, quality gate pipelines | Setting up or modifying build/deploy pipelines |
| [deprecation-and-migration](skills/deprecation-and-migration/SKILL.md) | Code-as-liability, migration patterns, zombie code removal | Removing old systems, migrating users |
| [documentation-and-adrs](skills/documentation-and-adrs/SKILL.md) | Architecture Decision Records, API docs, inline standards | Making architectural decisions, changing APIs |
| [observability-and-instrumentation](skills/observability-and-instrumentation/SKILL.md) | Structured logging, RED metrics, OpenTelemetry tracing | Adding telemetry, shipping to production |
| [shipping-and-launch](skills/shipping-and-launch/SKILL.md) | Pre-launch checklists, staged rollouts, rollback procedures | Preparing to deploy to production |

---

## Agent Personas

Pre-configured specialist personas for targeted reviews and execution:

| Agent | Role | Purpose |
|-------|------|---------|
| [code-reviewer](agents/code-reviewer.md) | Senior Staff Engineer | Five-axis code review |
| [test-engineer](agents/test-engineer.md) | QA Specialist | Test strategy and coverage analysis |
| [security-auditor](agents/security-auditor.md) | Security Engineer | Vulnerability detection, OWASP assessment |
| [web-performance-auditor](agents/web-performance-auditor.md) | Web Performance Engineer | Core Web Vitals audit |
| [researcher](agents/researcher.md) | Codebase Researcher | Investigates patterns, dependencies, conventions |
| [planner](agents/planner.md) | Implementation Planner | Creates detailed plans with exact code |
| [plan-checker](agents/plan-checker.md) | Plan Quality Reviewer | Verifies plan quality and context fit |
| [task-executor](agents/task-executor.md) | Task Executor | Implements one task with TDD in fresh context |
| [verifier](agents/verifier.md) | Goal Verifier | Checks implementation achieves spec goals |

---

## Reference Files

Quick-reference material that skills pull in when needed:

| Reference | Covers |
|-----------|--------|
| [testing-patterns.md](references/testing-patterns.md) | Test structure, naming, mocking, anti-patterns |
| [security-checklist.md](references/security-checklist.md) | Pre-commit checks, auth, input validation, OWASP Top 10 |
| [performance-checklist.md](references/performance-checklist.md) | Core Web Vitals targets, measurement commands |
| [accessibility-checklist.md](references/accessibility-checklist.md) | Keyboard nav, screen readers, ARIA, testing tools |
| [root-cause-tracing.md](references/root-cause-tracing.md) | Backward tracing technique for deep call stack bugs |
| [defense-in-depth.md](references/defense-in-depth.md) | Four-layer validation pattern (entry, business, environment, debug) |
| [condition-based-waiting.md](references/condition-based-waiting.md) | Replacing arbitrary timeouts with event-based waiting |

---

## How Skills Work

Every skill follows a consistent anatomy:

```
┌─────────────────────────────────────────────────┐
│  SKILL.md                                       │
│                                                 │
│  ┌─ Frontmatter ─────────────────────────────┐  │
│  │ name: lowercase-hyphen-name               │  │
│  │ description: Guides agents through [task].│  │
│  │              Use when…                    │  │
│  └───────────────────────────────────────────┘  │
│  Overview         → What this skill does        │
│  When to Use      → Triggering conditions       │
│  Process          → Step-by-step workflow       │
│  Rationalizations → Excuses + rebuttals         │
│  Red Flags        → Signs something's wrong     │
│  Verification     → Evidence requirements       │
│  Next Step        → What to chain to next       │
└─────────────────────────────────────────────────┘
```

**Key design choices:**

- **Process, not prose.** Skills are workflows agents follow, not reference docs they read.
- **Anti-rationalization.** Every skill includes a table of common excuses with counter-arguments.
- **Verification is non-negotiable.** Every skill ends with evidence requirements.
- **Auto-chaining.** Pipeline skills chain to the next via "Next Step" sections.
- **Fresh context.** Subagents start with clean windows to prevent context rot.
- **Progressive disclosure.** Supporting references load only when needed.

---

## Project Structure

```
agent-skills/
├── skills/                            # 28 skills (25 lifecycle + 3 meta)
│   ├── interview-me/                  #   Define (MANDATORY)
│   ├── idea-refine/                   #   Define
│   ├── spec-driven-development/       #   Define
│   ├── planning-and-task-breakdown/   #   Plan
│   ├── fresh-context-execution/       #   Build (always, context rot prevention)
│   ├── using-git-worktrees/           #   Build (parallel workspace isolation)
│   ├── context-engineering/           #   Build
│   ├── source-driven-development/     #   Build
│   ├── doubt-driven-development/      #   Build
│   ├── frontend-ui-engineering/       #   Build
│   ├── test-driven-development/       #   Build
│   ├── api-and-interface-design/      #   Build
│   ├── browser-testing-with-devtools/ #   Verify
│   ├── debugging-and-error-recovery/  #   Verify
│   ├── code-review-and-quality/       #   Review
│   ├── code-simplification/           #   Review
│   ├── security-and-hardening/        #   Review
│   ├── performance-optimization/      #   Review
│   ├── git-workflow-and-versioning/   #   Ship
│   ├── ci-cd-and-automation/          #   Ship
│   ├── deprecation-and-migration/     #   Ship
│   ├── documentation-and-adrs/        #   Ship
│   ├── observability-and-instrumentation/ # Ship
│   ├── shipping-and-launch/           #   Ship
│   ├── using-agent-skills/            #   Meta: routing + enforcement
│   ├── skill-router/                  #   Meta: compact JSON index
│   └── state-management/              #   Meta: shared state coordination
├── agents/                            # 9 specialist personas
├── references/                        # 7 supplementary references
├── hooks/                             # Session lifecycle hooks
├── scripts/                           # Lifecycle kernel: state, trace, pipeline validation
│   ├── agent-skills-state.js          #   State machine + file locking
│   ├── agent-skills-trace.js          #   JSONL event tracing
│   ├── agent-skills-pipeline.js       #   Artifact + trace validation
│   ├── agent-skills-dependency.js     #   Dependency analysis + wave computation
│   ├── agent-skills-lock.js           #   O_EXCL atomic file locking
│   ├── agent-skills-scheduler.js      #   Wave-based parallel dispatch
│   └── agent-skills-workstream.js     #   Multi-area workstream management
├── tasks/                             # Project state (STATE.md, progress.md)
│   └── workstreams/                   #   Per-area isolated state (backend, frontend, infra)
├── tests/                             # 59 tests (all passing)
├── .claude/commands/                  # 7 slash commands (Claude Code)
├── .gemini/commands/                  # 7 slash commands (Gemini CLI)
├── commands/                          # 8 slash commands (Antigravity CLI)
├── plugin.json                        # Antigravity plugin manifest
└── docs/                              # Setup guides per tool
```

---

## Why Agent Skills?

AI coding agents default to the shortest path — which often means skipping specs, tests, security reviews, and the practices that make software reliable. Agent Skills gives agents structured workflows that enforce the same discipline senior engineers bring to production code.

Each skill encodes hard-won engineering judgment: *when* to write a spec, *what* to test, *how* to review, and *when* to ship. These aren't generic prompts — they're the kind of opinionated, process-driven workflows that separate production-quality work from prototype-quality work.

Skills bake in best practices from Google's engineering culture — including concepts from [Software Engineering at Google](https://abseil.io/resources/swe-book) and Google's [engineering practices guide](https://google.github.io/eng-practices/). You'll find Hyrum's Law in API design, the Beyonce Rule and test pyramid in testing, change sizing and review speed norms in code review, Chesterton's Fence in simplification, trunk-based development in git workflow, Shift Left and feature flags in CI/CD, and a dedicated deprecation skill treating code as a liability. These aren't abstract principles — they're embedded directly into the step-by-step workflows agents follow.

---

## Contributing

Skills should be **specific** (actionable steps, not vague advice), **verifiable** (clear exit criteria with evidence requirements), **battle-tested** (based on real workflows), and **minimal** (only what's needed to guide the agent).

See [docs/skill-anatomy.md](docs/skill-anatomy.md) for the format specification and [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

MIT - use these skills in your projects, teams, and tools.
