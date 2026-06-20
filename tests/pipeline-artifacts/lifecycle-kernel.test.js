'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..', '..');
const stateScript = path.join(repoRoot, 'scripts', 'agent-skills-state.js');
const traceScript = path.join(repoRoot, 'scripts', 'agent-skills-trace.js');
const pipelineScript = path.join(repoRoot, 'scripts', 'agent-skills-pipeline.js');

function tempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agent-skills-kernel-'));
}

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

test('state kernel initializes and transitions lifecycle state', () => {
  const cwd = tempProject();

  let result = spawnSync(process.execPath, [stateScript, 'init', '--goal', 'demo'], { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);

  result = spawnSync(process.execPath, [stateScript, 'transition', 'spec'], { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);

  const state = fs.readFileSync(path.join(cwd, 'tasks', 'STATE.md'), 'utf8');
  assert.match(state, /current_phase: spec/);
  assert.match(state, /goal: demo/);
});

test('state kernel rejects invalid phase transitions', () => {
  const cwd = tempProject();

  let result = spawnSync(process.execPath, [stateScript, 'init'], { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);

  result = spawnSync(process.execPath, [stateScript, 'transition', 'build'], { cwd, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Invalid transition: none -> build/);
});

test('trace kernel appends JSONL events from a stable scripts path', () => {
  const cwd = tempProject();
  const result = spawnSync(process.execPath, [traceScript, 'skill.invoked', 'skill=spec-driven-development'], {
    cwd,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  const lines = fs.readFileSync(path.join(cwd, 'tasks', 'trace.jsonl'), 'utf8').trim().split('\n');
  assert.equal(lines.length, 1);
  assert.equal(JSON.parse(lines[0]).skill, 'spec-driven-development');
});

test('pipeline kernel validates artifacts and trace order from scripts path', () => {
  const cwd = tempProject();
  write(path.join(cwd, 'SPEC.md'), '# Spec\n');
  write(path.join(cwd, 'tasks', 'STATE.md'), '---\ncurrent_phase: done\n---\n');
  write(path.join(cwd, 'tasks', 'research.md'), '# Research\n');
  write(path.join(cwd, 'tasks', 'plan.md'), '# Plan\n');
  write(path.join(cwd, 'tasks', 'progress.md'), '# Progress\n');
  write(path.join(cwd, 'tasks', 'reports', 'task-1-report.md'), '# Task Report\n');
  write(path.join(cwd, 'tasks', 'verification.md'), '# Verification\nPASS\n');
  write(path.join(cwd, 'tasks', 'review.md'), '# Review\nGO\n');
  write(path.join(cwd, 'tasks', 'ship-decision.md'), '# Ship Decision\nGO\n');
  write(path.join(cwd, 'tasks', 'trace.jsonl'), [
    { ts: '2026-06-19T00:00:00.000Z', event: 'pipeline.started' },
    { ts: '2026-06-19T00:00:01.000Z', event: 'skill.invoked', skill: 'spec-driven-development' },
    { ts: '2026-06-19T00:00:02.000Z', event: 'artifact.written', path: 'SPEC.md' },
    { ts: '2026-06-19T00:00:03.000Z', event: 'skill.invoked', skill: 'planning-and-task-breakdown' },
    { ts: '2026-06-19T00:00:04.000Z', event: 'artifact.written', path: 'tasks/plan.md' },
    { ts: '2026-06-19T00:00:05.000Z', event: 'skill.invoked', skill: 'fresh-context-execution' },
    { ts: '2026-06-19T00:00:06.000Z', event: 'skill.invoked', skill: 'test-driven-development' },
    { ts: '2026-06-19T00:00:07.000Z', event: 'artifact.written', path: 'tasks/reports/task-1-report.md' },
    { ts: '2026-06-19T00:00:07.500Z', event: 'test-audit.started' },
    { ts: '2026-06-19T00:00:07.600Z', event: 'test-audit.completed' },
    { ts: '2026-06-19T00:00:08.000Z', event: 'verification.started' },
    { ts: '2026-06-19T00:00:09.000Z', event: 'verification.passed' },
    { ts: '2026-06-19T00:00:10.000Z', event: 'review.started' },
    { ts: '2026-06-19T00:00:11.000Z', event: 'review.completed' },
    { ts: '2026-06-19T00:00:12.000Z', event: 'skill.invoked', skill: 'shipping-and-launch' },
    { ts: '2026-06-19T00:00:13.000Z', event: 'pipeline.completed', verdict: 'GO' },
  ].map(JSON.stringify).join('\n') + '\n');

  const result = spawnSync(process.execPath, [pipelineScript, 'validate', '--root', cwd], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /pipeline validation passed/i);
});
