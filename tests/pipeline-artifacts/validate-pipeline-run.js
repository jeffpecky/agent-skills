#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { validate: validateState } = require('../../scripts/agent-skills-state.js');

const REQUIRED_ARTIFACTS = [
  'SPEC.md',
  'tasks/STATE.md',
  'tasks/research.md',
  'tasks/plan.md',
  'tasks/progress.md',
  'tasks/verification.md',
  'tasks/review.md',
  'tasks/ship-decision.md',
  'tasks/trace.jsonl',
];

const REQUIRED_TRACE_CHECKS = [
  { label: 'pipeline.started', match: e => e.event === 'pipeline.started' },
  { label: 'skill.invoked: spec-driven-development', match: e => e.event === 'skill.invoked' && e.skill === 'spec-driven-development' },
  { label: 'artifact.written: SPEC.md', match: e => e.event === 'artifact.written' && e.path === 'SPEC.md' },
  { label: 'skill.invoked: planning-and-task-breakdown', match: e => e.event === 'skill.invoked' && e.skill === 'planning-and-task-breakdown' },
  { label: 'artifact.written: tasks/plan.md', match: e => e.event === 'artifact.written' && e.path === 'tasks/plan.md' },
  { label: 'skill.invoked: fresh-context-execution', match: e => e.event === 'skill.invoked' && e.skill === 'fresh-context-execution' },
  { label: 'skill.invoked: test-driven-development', match: e => e.event === 'skill.invoked' && e.skill === 'test-driven-development' },
  { label: 'artifact.written: tasks/reports/task-*.md', match: e => e.event === 'artifact.written' && /^tasks\/reports\/task-.+-report\.md$/.test(e.path || '') },
  { label: 'verification.started', match: e => e.event === 'verification.started' },
  { label: 'verification result', match: e => e.event === 'verification.passed' || e.event === 'verification.failed' },
  { label: 'review.started', match: e => e.event === 'review.started' },
  { label: 'review.completed', match: e => e.event === 'review.completed' },
  { label: 'skill.invoked: shipping-and-launch', match: e => e.event === 'skill.invoked' && e.skill === 'shipping-and-launch' },
  { label: 'pipeline completion', match: e => e.event === 'pipeline.completed' || e.event === 'pipeline.blocked' },
];

function parseArgs(argv) {
  const rootIdx = argv.indexOf('--root');
  if (rootIdx === -1) return process.cwd();
  const root = argv[rootIdx + 1];
  if (!root) throw new Error('Usage: node tests/pipeline-artifacts/validate-pipeline-run.js --root <path>');
  return path.resolve(root);
}

function readTrace(tracePath) {
  return fs.readFileSync(tracePath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (err) {
        throw new Error(`Invalid JSON in tasks/trace.jsonl line ${index + 1}: ${err.message}`);
      }
    });
}

function validateArtifacts(root) {
  const errors = [];
  for (const rel of REQUIRED_ARTIFACTS) {
    if (!fs.existsSync(path.join(root, rel))) {
      errors.push(`Missing required artifact: ${rel}`);
    }
  }

  const reportsDir = path.join(root, 'tasks', 'reports');
  const hasReport = fs.existsSync(reportsDir)
    && fs.readdirSync(reportsDir).some(name => /^task-.+-report\.md$/.test(name));
  if (!hasReport) {
    errors.push('Missing required artifact: tasks/reports/task-*-report.md');
  }

  return errors;
}

function validateTrace(events) {
  const errors = [];
  let cursor = -1;

  for (const check of REQUIRED_TRACE_CHECKS) {
    const next = events.findIndex((event, index) => index > cursor && check.match(event));
    if (next === -1) {
      errors.push(`Missing trace event after index ${cursor}: ${check.label}`);
      continue;
    }
    cursor = next;
  }

  return errors;
}

function validateTestAudit(traceLines) {
  const required = ['test-audit.started', 'test-audit.completed'];
  const hasBlocked = traceLines.some(l => l.event === 'test-audit.blocked');

  for (const event of required) {
    if (!traceLines.some(l => l.event === event)) {
      return { valid: false, error: `Missing required event: ${event}` };
    }
  }

  if (hasBlocked) {
    return { valid: false, error: 'Test audit found blockers' };
  }

  return { valid: true };
}

function validate(root) {
  const errors = validateArtifacts(root);
  errors.push(...validateState(root));
  const tracePath = path.join(root, 'tasks', 'trace.jsonl');
  if (fs.existsSync(tracePath)) {
    const traceLines = readTrace(tracePath);
    errors.push(...validateTrace(traceLines));
    const auditResult = validateTestAudit(traceLines);
    if (!auditResult.valid) errors.push(auditResult.error);
  } else {
    errors.push('Missing required trace: tasks/trace.jsonl');
  }
  return errors;
}

function main() {
  const root = parseArgs(process.argv.slice(2));
  const errors = validate(root);
  if (errors.length > 0) {
    process.stderr.write(errors.map(error => `ERROR: ${error}`).join('\n') + '\n');
    process.exit(1);
  }
  process.stdout.write('pipeline validation passed\n');
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--test')) {
    const { test } = require('node:test');
    const assert = require('node:assert/strict');

    test('fails when test-audit.blocked is present', () => {
      const trace = [
        { event: 'pipeline.started' },
        { event: 'test-audit.started' },
        { event: 'test-audit.completed' },
        { event: 'test-audit.blocked' },
      ];
      const result = validateTestAudit(trace);
      assert.equal(result.valid, false);
      assert.match(result.error, /blockers/);
    });
  } else {
    try {
      main();
    } catch (err) {
      process.stderr.write(`${err.message}\n`);
      process.exit(1);
    }
  }
}

module.exports = { validate, validateArtifacts, validateTrace, validateTestAudit };
