'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { spawnSync } = require('node:child_process');

const script = path.resolve(__dirname, 'validate-pipeline-run.js');

function tempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agent-skills-pipeline-'));
}

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function writeValidRun(root) {
  write(path.join(root, 'SPEC.md'), '# Spec\n');
  write(path.join(root, 'tasks', 'STATE.md'), '# Project State\n- Phase: done\n');
  write(path.join(root, 'tasks', 'research.md'), '# Research\n');
  write(path.join(root, 'tasks', 'plan.md'), '# Plan\n');
  write(path.join(root, 'tasks', 'progress.md'), '# Progress\n');
  write(path.join(root, 'tasks', 'reports', 'task-1-report.md'), '# Task Report\n');
  write(path.join(root, 'tasks', 'verification.md'), '# Verification\nPASS\n');
  write(path.join(root, 'tasks', 'review.md'), '# Review\nGO\n');
  write(path.join(root, 'tasks', 'ship-decision.md'), '# Ship Decision\nGO\n');
  write(path.join(root, 'tasks', 'trace.jsonl'), [
    { ts: '2026-06-19T00:00:00.000Z', event: 'pipeline.started' },
    { ts: '2026-06-19T00:00:01.000Z', event: 'skill.invoked', skill: 'spec-driven-development' },
    { ts: '2026-06-19T00:00:02.000Z', event: 'artifact.written', path: 'SPEC.md' },
    { ts: '2026-06-19T00:00:03.000Z', event: 'skill.invoked', skill: 'planning-and-task-breakdown' },
    { ts: '2026-06-19T00:00:04.000Z', event: 'artifact.written', path: 'tasks/plan.md' },
    { ts: '2026-06-19T00:00:05.000Z', event: 'skill.invoked', skill: 'fresh-context-execution' },
    { ts: '2026-06-19T00:00:06.000Z', event: 'skill.invoked', skill: 'test-driven-development' },
    { ts: '2026-06-19T00:00:07.000Z', event: 'artifact.written', path: 'tasks/reports/task-1-report.md' },
    { ts: '2026-06-19T00:00:08.000Z', event: 'verification.started' },
    { ts: '2026-06-19T00:00:09.000Z', event: 'verification.passed' },
    { ts: '2026-06-19T00:00:10.000Z', event: 'review.started' },
    { ts: '2026-06-19T00:00:11.000Z', event: 'review.completed' },
    { ts: '2026-06-19T00:00:12.000Z', event: 'skill.invoked', skill: 'shipping-and-launch' },
    { ts: '2026-06-19T00:00:13.000Z', event: 'pipeline.completed', verdict: 'GO' },
  ].map(JSON.stringify).join('\n') + '\n');
}

test('validator passes a complete pipeline run', () => {
  const root = tempProject();
  writeValidRun(root);

  const result = spawnSync(process.execPath, [script, '--root', root], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /pipeline validation passed/i);
});

test('validator fails when required artifact is missing', () => {
  const root = tempProject();
  writeValidRun(root);
  fs.rmSync(path.join(root, 'tasks', 'verification.md'));

  const result = spawnSync(process.execPath, [script, '--root', root], { encoding: 'utf8' });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing required artifact: tasks\/verification\.md/);
});

test('validator fails when trace ordering is invalid', () => {
  const root = tempProject();
  writeValidRun(root);
  write(path.join(root, 'tasks', 'trace.jsonl'), [
    { ts: '2026-06-19T00:00:00.000Z', event: 'pipeline.started' },
    { ts: '2026-06-19T00:00:01.000Z', event: 'pipeline.completed', verdict: 'GO' },
  ].map(JSON.stringify).join('\n') + '\n');

  const result = spawnSync(process.execPath, [script, '--root', root], { encoding: 'utf8' });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing trace event/);
});
