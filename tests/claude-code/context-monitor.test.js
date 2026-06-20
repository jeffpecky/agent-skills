'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..', '..');
const hookScript = path.join(repoRoot, 'hooks', 'context-monitor.js');

function tempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agent-skills-hook-'));
}

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

test('context monitor injects warning when context is low', () => {
  const cwd = tempProject();
  const sessionId = `agent-skills-${process.pid}-${Date.now()}`;
  write(path.join(cwd, 'tasks', 'STATE.md'), '---\ncurrent_phase: build\n---\n');
  write(path.join(os.tmpdir(), `claude-ctx-${sessionId}.json`), JSON.stringify({
    timestamp: Math.floor(Date.now() / 1000),
    remaining_percentage: 30,
    used_pct: 70,
  }));

  const result = spawnSync(process.execPath, [hookScript], {
    cwd,
    input: JSON.stringify({ session_id: sessionId, cwd, hook_event_name: 'PostToolUse' }),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.hookSpecificOutput.hookEventName, 'PostToolUse');
  assert.match(output.hookSpecificOutput.additionalContext, /CONTEXT WARNING/);
  assert.match(output.hookSpecificOutput.additionalContext, /tasks\/STATE\.md/);
});

test('context monitor exits silently for unsafe session id', () => {
  const cwd = tempProject();
  const result = spawnSync(process.execPath, [hookScript], {
    cwd,
    input: JSON.stringify({ session_id: '../escape', cwd }),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
});
