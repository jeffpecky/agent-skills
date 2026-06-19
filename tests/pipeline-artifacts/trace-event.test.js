'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { spawnSync } = require('node:child_process');

const script = path.resolve(__dirname, 'trace-event.js');

function tempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agent-skills-trace-'));
}

test('trace-event appends JSONL event with timestamp and key values', () => {
  const cwd = tempProject();
  const result = spawnSync(process.execPath, [script, 'skill.invoked', 'skill=spec-driven-development'], {
    cwd,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  const tracePath = path.join(cwd, 'tasks', 'trace.jsonl');
  const lines = fs.readFileSync(tracePath, 'utf8').trim().split('\n');
  assert.equal(lines.length, 1);

  const event = JSON.parse(lines[0]);
  assert.equal(event.event, 'skill.invoked');
  assert.equal(event.skill, 'spec-driven-development');
  assert.match(event.ts, /^\d{4}-\d{2}-\d{2}T/);
});

test('trace-event appends without overwriting existing events', () => {
  const cwd = tempProject();

  let result = spawnSync(process.execPath, [script, 'pipeline.started', 'goal=demo'], {
    cwd,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);

  result = spawnSync(process.execPath, [script, 'pipeline.completed', 'verdict=GO'], {
    cwd,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);

  const lines = fs.readFileSync(path.join(cwd, 'tasks', 'trace.jsonl'), 'utf8').trim().split('\n');
  assert.equal(lines.length, 2);
  assert.equal(JSON.parse(lines[0]).event, 'pipeline.started');
  assert.equal(JSON.parse(lines[1]).event, 'pipeline.completed');
});

test('trace-event fails when event name is missing', () => {
  const cwd = tempProject();
  const result = spawnSync(process.execPath, [script], {
    cwd,
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Usage:/);
});
