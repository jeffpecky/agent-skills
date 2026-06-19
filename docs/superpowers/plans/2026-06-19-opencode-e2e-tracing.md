# OpenCode E2E Tracing & Superpowers Parity Test Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `agent-skills` pipeline testable end to end in OpenCode with durable artifacts, local JSONL tracing, a validator, and a tiny fixture project. Add first-class validation tests under `tests/` for all configuration/manifest directories (`.claude-plugin/`, `.claude/`, `.gemini/`, `.opencode/`) to ensure superpowers-level testing parity.

**Architecture:** The pipeline remains skill/persona driven, but every lifecycle phase writes predictable files under `tasks/` and trace events to `tasks/trace.jsonl`, with scripts validating a completed run. Add Superpowers-style explicit skill request tests as a first-class test category under `tests/`. Keep all test scripts, helpers, and harnesses under `tests/` like Superpowers. Use static validation tests in Node for Claude/Gemini manifests to keep the suite fast and dependency-free.

**Tech Stack:** Node.js CommonJS validation scripts, Node's built-in `node:test`, OpenCode manual E2E runbook, optional MLflow/OpenTelemetry tracing.

---

## File Structure

Create these files:

- `references/artifact-contracts.md` — canonical lifecycle artifact paths, writers, readers, and required status values for the native `tasks/` substrate.
- `references/pipeline-tracing.md` — local `tasks/trace.jsonl` schema and required event ordering.
- `tests/pipeline-artifacts/trace-event.js` — small CLI helper that appends JSONL trace events to `tasks/trace.jsonl`.
- `tests/pipeline-artifacts/validate-pipeline-run.js` — validates required artifacts and trace ordering for a completed run.
- `tests/pipeline-artifacts/trace-event.test.js` — unit tests for `trace-event.js`.
- `tests/pipeline-artifacts/validate-pipeline-run.test.js` — unit tests for `validate-pipeline-run.js`.
- `tests/explicit-skill-requests/run-all.sh` — runs all explicit skill request integration tests.
- `tests/explicit-skill-requests/run-test.sh` — runs one explicit skill request against an agent CLI and checks the expected skill was invoked.
- `tests/explicit-skill-requests/prompts/use-spec-driven-development.txt` — prompt fixture.
- `tests/explicit-skill-requests/prompts/use-planning-and-task-breakdown.txt` — prompt fixture.
- `tests/explicit-skill-requests/prompts/use-fresh-context-execution.txt` — prompt fixture.
- `tests/explicit-skill-requests/prompts/use-test-driven-development.txt` — prompt fixture.
- `tests/explicit-skill-requests/prompts/use-debugging-and-error-recovery.txt` — prompt fixture.
- `tests/explicit-skill-requests/prompts/use-code-review-and-quality.txt` — prompt fixture.
- `tests/explicit-skill-requests/prompts/use-shipping-and-launch.txt` — prompt fixture.
- `tests/claude-code/manifest.test.js` — validates `.claude-plugin/plugin.json` syntax, directories, and agent paths.
- `tests/claude-code/commands.test.js` — validates `.claude/commands/*.md` frontmatter rules and allowed-tools list.
- `tests/gemini/commands.test.js` — validates `.gemini/commands/*.toml` schema format, matching names, and description constraints.
- `tests/skill-validation/validate-skills.test.js` — validates `scripts/validate-skills.js` runs successfully.
- `testdata/fixtures/tiny-node-calculator/package.json` — tiny fixture package.
- `testdata/fixtures/tiny-node-calculator/src/calculator.js` — tiny source fixture.
- `testdata/fixtures/tiny-node-calculator/test/calculator.test.js` — tiny fixture test.
- `docs/opencode-e2e-testing.md` — manual OpenCode E2E runbook and pass/fail checklist.

Modify these files:

- `AGENTS.md` — clarify skills/procedures, agents/roles, commands/orchestration, artifacts/state, and trace expectations.
- `docs/opencode-setup.md` — link to the E2E testing/tracing runbook.
- `.gitignore` — ignore generated local trace/output artifacts only if needed; do not ignore `testdata/fixtures` or docs.
- `skills/fresh-context-execution/SKILL.md` — point to artifact and trace contracts and require durable outputs.
- `skills/spec-driven-development/SKILL.md` — point to artifact and trace contracts for spec/research handoff.
- `skills/planning-and-task-breakdown/SKILL.md` — point to artifact and trace contracts for `tasks/plan.md`.
- `skills/code-review-and-quality/SKILL.md` — point to `tasks/review.md` and trace completion event.
- `skills/shipping-and-launch/SKILL.md` — point to `tasks/ship-decision.md` and trace completion event.

Do not add OpenCode external tracing as a required dependency in this phase. Document MLflow/OpenTelemetry as optional in `docs/opencode-e2e-testing.md`.

---

### Task 1: Add Artifact Contract Documentation [COMPLETED]

**Files:**
- Create: `references/artifact-contracts.md`
- Modify: none
- Test: manual read plus downstream validator tests in later tasks

- [x] **Step 1: Create the artifact contract document**
- [x] **Step 2: Verify the file renders as Markdown**
- [x] **Step 3: Commit**

---

### Task 2: Add Local Pipeline Trace Contract [COMPLETED]

**Files:**
- Create: `references/pipeline-tracing.md`
- Modify: none
- Test: manual read plus downstream validator tests in later tasks

- [x] **Step 1: Create the trace contract document**
- [x] **Step 2: Verify the file renders as Markdown**
- [x] **Step 3: Commit**

---

### Task 3: Add Trace Event Helper [COMPLETED]

**Files:**
- Create: `tests/pipeline-artifacts/trace-event.js`
- Create: `tests/pipeline-artifacts/trace-event.test.js`
- Test: `node --test tests/pipeline-artifacts/trace-event.test.js`

- [x] **Step 1: Write failing tests for trace helper**
- [x] **Step 2: Run tests and verify they fail because script is missing**
- [x] **Step 3: Implement trace helper**
- [x] **Step 4: Run tests and verify they pass**
- [x] **Step 5: Commit**

---

### Task 4: Add Pipeline Run Validator [COMPLETED]

**Files:**
- Create: `tests/pipeline-artifacts/validate-pipeline-run.js`
- Create: `tests/pipeline-artifacts/validate-pipeline-run.test.js`
- Test: `node --test tests/pipeline-artifacts/validate-pipeline-run.test.js`

- [x] **Step 1: Write failing tests for validator**
- [x] **Step 2: Run tests and verify they fail because script is missing**
- [x] **Step 3: Implement validator**
- [x] **Step 4: Run tests and verify they pass**
- [x] **Step 5: Commit**

---

### Task 5: Add Explicit Skill Request Harness [COMPLETED]

**Files:**
- Create: `tests/explicit-skill-requests/run-test.sh`
- Create: `tests/explicit-skill-requests/run-all.sh`
- Create: `tests/explicit-skill-requests/prompts/*`
- Test: `bash tests/explicit-skill-requests/run-all.sh`

- [x] **Step 1: Create explicit skill request runner**
- [x] **Step 2: Create all-skill runner**
- [x] **Step 3: Add prompt fixtures**
- [x] **Step 4: Make shell scripts executable where supported**
- [x] **Step 5: Run explicit skill tests**
- [x] **Step 6: Commit**

---

### Task 6: Add Claude Code Manifest & Commands Validation Tests

**Files:**
- Create: `tests/claude-code/manifest.test.js`
- Create: `tests/claude-code/commands.test.js`
- Test: `node --test tests/claude-code/manifest.test.js tests/claude-code/commands.test.js`

- [ ] **Step 1: Write Claude Code manifest tests**

Create `tests/claude-code/manifest.test.js` with this exact content:

```javascript
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..', '..');
const manifestPath = path.join(repoRoot, '.claude-plugin', 'plugin.json');

test('Claude plugin.json manifest exists and has valid JSON schema', () => {
  assert.ok(fs.existsSync(manifestPath), 'plugin.json must exist');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  assert.equal(typeof manifest.name, 'string', 'name must be a string');
  assert.equal(manifest.name, 'agent-skills', 'plugin name must be agent-skills');
  assert.equal(typeof manifest.description, 'string', 'description must be a string');
  assert.equal(manifest.commands, './.claude/commands', 'commands directory must be registered');
  assert.equal(manifest.skills, './skills', 'skills directory must be registered');
  assert.ok(Array.isArray(manifest.agents), 'agents must be an array');
});

test('Claude plugin.json declared agents exist on disk', () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  for (const agentPath of manifest.agents) {
    const fullPath = path.resolve(repoRoot, agentPath);
    assert.ok(fs.existsSync(fullPath), `declared agent file must exist: ${agentPath}`);
  }
});
```

- [ ] **Step 2: Write Claude Code commands tests**

Create `tests/claude-code/commands.test.js` with this exact content:

```javascript
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..', '..');
const commandsDir = path.join(repoRoot, '.claude', 'commands');

function parseFrontmatter(content) {
  const match = content.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n/);
  if (!match) return null;

  const result = {};
  for (const line of match[1].split(/\r?\n/)) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key   = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key) result[key] = value;
  }
  return result;
}

test('Claude commands have valid description frontmatter', () => {
  assert.ok(fs.existsSync(commandsDir), 'commands directory must exist');
  const files = fs.readdirSync(commandsDir).filter(name => name.endsWith('.md'));
  assert.ok(files.length > 0, 'should have command markdown files');

  for (const file of files) {
    const content = fs.readFileSync(path.join(commandsDir, file), 'utf8');
    const fm = parseFrontmatter(content);
    assert.ok(fm, `command file ${file} must have frontmatter`);
    assert.ok(fm.description, `command file ${file} missing description`);
    assert.ok(fm.description.length <= 1024, `command file ${file} description exceeds 1024 chars`);
  }
});
```

- [ ] **Step 3: Run Claude Code tests and verify they pass**

Run: `node --test tests/claude-code/manifest.test.js tests/claude-code/commands.test.js`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/claude-code
git commit -m "test: add Claude Code manifest and command validation tests"
```

---

### Task 7: Add Gemini Commands Validation Tests

**Files:**
- Create: `tests/gemini/commands.test.js`
- Test: `node --test tests/gemini/commands.test.js`

- [ ] **Step 1: Write Gemini commands validation tests**

Create `tests/gemini/commands.test.js` with this exact content:

```javascript
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..', '..');
const commandsDir = path.join(repoRoot, '.gemini', 'commands');

function parseSimpleToml(content) {
  const result = {};
  for (const line of content.split(/\r?\n/)) {
    const clean = line.trim();
    if (!clean || clean.startsWith('#')) continue;
    const eq = clean.indexOf('=');
    if (eq === -1) continue;
    const key = clean.slice(0, eq).trim();
    const value = clean.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key) result[key] = value;
  }
  return result;
}

test('Gemini commands exist and have valid TOML schema', () => {
  assert.ok(fs.existsSync(commandsDir), 'gemini commands directory must exist');
  const files = fs.readdirSync(commandsDir).filter(name => name.endsWith('.toml'));
  assert.ok(files.length > 0, 'should have command toml files');

  for (const file of files) {
    const content = fs.readFileSync(path.join(commandsDir, file), 'utf8');
    const toml = parseSimpleToml(content);

    assert.ok(toml.name, `command file ${file} must have a name`);
    assert.ok(toml.description, `command file ${file} must have a description`);
    assert.ok(toml.description.length <= 1024, `command file ${file} description exceeds 1024 chars`);
  }
});
```

- [ ] **Step 2: Run Gemini tests and verify they pass**

Run: `node --test tests/gemini/commands.test.js`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/gemini
git commit -m "test: add Gemini command validation tests"
```

---

### Task 8: Add Skill Validator Unit Test

**Files:**
- Create: `tests/skill-validation/validate-skills.test.js`
- Test: `node --test tests/skill-validation/validate-skills.test.js`

- [ ] **Step 1: Write skill validator test**

Create `tests/skill-validation/validate-skills.test.js` with this exact content:

```javascript
'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { spawnSync } = require('node:child_process');

const script = path.resolve(__dirname, '..', '..', 'scripts', 'validate-skills.js');

test('scripts/validate-skills.js runs successfully against the repository skills', () => {
  const result = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /skills checked/i);
});
```

- [ ] **Step 2: Run test and verify it passes**

Run: `node --test tests/skill-validation/validate-skills.test.js`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/skill-validation/validate-skills.test.js
git commit -m "test: add skill validator unit test under tests/skill-validation"
```

---

### Task 9: Add Tiny Node Fixture

**Files:**
- Create: `testdata/fixtures/tiny-node-calculator/package.json`
- Create: `testdata/fixtures/tiny-node-calculator/src/calculator.js`
- Create: `testdata/fixtures/tiny-node-calculator/test/calculator.test.js`
- Test: `npm test` inside fixture directory

- [ ] **Step 1: Create fixture package**
- [ ] **Step 2: Create fixture source**
- [ ] **Step 3: Create fixture test**
- [ ] **Step 4: Run fixture tests**
- [ ] **Step 5: Commit**

---

### Task 10: Add OpenCode E2E Runbook

**Files:**
- Create: `docs/opencode-e2e-testing.md`
- Modify: `docs/opencode-setup.md`
- Test: manual link/path check

- [ ] **Step 1: Create E2E runbook**
- [ ] **Step 2: Link runbook from OpenCode setup doc**
- [ ] **Step 3: Verify links and key text**
- [ ] **Step 4: Commit**

---

### Task 11: Wire Artifact And Trace Contracts Into Core Skills

**Files:**
- Modify: `skills/fresh-context-execution/SKILL.md`
- Modify: `skills/spec-driven-development/SKILL.md`
- Modify: `skills/planning-and-task-breakdown/SKILL.md`
- Modify: `skills/code-review-and-quality/SKILL.md`
- Modify: `skills/shipping-and-launch/SKILL.md`
- Test: `node scripts/validate-skills.js`

- [ ] **Step 1: Update `fresh-context-execution`**
- [ ] **Step 2: Update `spec-driven-development`**
- [ ] **Step 3: Update `planning-and-task-breakdown`**
- [ ] **Step 4: Update review and ship skills**
- [ ] **Step 5: Run skill validator**
- [ ] **Step 6: Commit**

---

### Task 12: Clarify Architecture In AGENTS.md

**Files:**
- Modify: `AGENTS.md`
- Test: manual grep check

- [ ] **Step 1: Add architecture clarification**
- [ ] **Step 2: Add tracing expectation**
- [ ] **Step 3: Verify text exists**
- [ ] **Step 4: Commit**

---

### Task 13: Run Full Local Verification

**Files:**
- No new files
- Test: all local validation commands

- [ ] **Step 1: Run skill validation**
- [ ] **Step 2: Run unit tests**
- [ ] **Step 3: Run fixture tests**
- [ ] **Step 4: Smoke-test trace helper in repo root**
- [ ] **Step 5: Remove smoke-test generated trace**
- [ ] **Step 6: Commit any verification-only fixes**

---

## Self-Review

Spec coverage:
- Artifact contract is covered by Tasks 1 and 11.
- Local trace contract is covered by Tasks 2, 3, 4, and 12.
- Fixture-based E2E setup is covered by Tasks 9 and 10.
- Optional OpenCode external tracing is documented in Task 10 without becoming a dependency.
- Claude Code/Gemini manifest static validation is covered by Tasks 6, 7, and 8.
- Validation is covered by Tasks 3, 4, 6, 7, 8, and 13.

Placeholder scan:
- No `TBD`, `TODO`, or open-ended implementation placeholders are present.
- All new file contents are specified.
- All commands include expected outcomes.

Type/path consistency:
- The canonical local trace path is consistently `tasks/trace.jsonl`.
- The pipeline validator checks the same artifact paths defined in `references/artifact-contracts.md`.
- The fixture path is consistently `testdata/fixtures/tiny-node-calculator`.
