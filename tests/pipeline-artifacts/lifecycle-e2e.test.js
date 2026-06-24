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

function setupTestProject() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-skills-e2e-'));
  
  // Copy fixture files to simulate a real project run
  const fixtureSrc = path.join(repoRoot, 'testdata', 'fixtures', 'tiny-node-calculator');
  fs.mkdirSync(path.join(cwd, 'src'), { recursive: true });
  fs.mkdirSync(path.join(cwd, 'test'), { recursive: true });
  fs.copyFileSync(
    path.join(fixtureSrc, 'src', 'calculator.js'),
    path.join(cwd, 'src', 'calculator.js')
  );
  fs.copyFileSync(
    path.join(fixtureSrc, 'test', 'calculator.test.js'),
    path.join(cwd, 'test', 'calculator.test.js')
  );
  fs.copyFileSync(
    path.join(fixtureSrc, 'package.json'),
    path.join(cwd, 'package.json')
  );
  
  return cwd;
}

function writeArtifact(cwd, relPath, content = '# Done\n') {
  const full = path.join(cwd, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
}

test('E2E: complete commandless lifecycle run succeeds and passes validation', () => {
  const cwd = setupTestProject();

  // 1. pipeline.started
  let res = spawnSync(process.execPath, [stateScript, 'init', '--goal', 'add multiply'], { cwd, encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);
  res = spawnSync(process.execPath, [traceScript, 'pipeline.started', 'goal=add multiply'], { cwd, encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);

  // 2. spec
  res = spawnSync(process.execPath, [stateScript, 'transition', 'spec'], { cwd, encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);
  res = spawnSync(process.execPath, [traceScript, 'skill.invoked', 'skill=spec-driven-development'], { cwd, encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);
  
  writeArtifact(cwd, 'SPEC.md', '# Spec\n');
  res = spawnSync(process.execPath, [traceScript, 'artifact.written', 'path=SPEC.md'], { cwd, encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);

  // 3. plan
  res = spawnSync(process.execPath, [stateScript, 'transition', 'plan'], { cwd, encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);
  res = spawnSync(process.execPath, [traceScript, 'skill.invoked', 'skill=planning-and-task-breakdown'], { cwd, encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);
  
  writeArtifact(cwd, 'tasks/research.md');
  writeArtifact(cwd, 'tasks/plan.md');
  writeArtifact(cwd, 'tasks/progress.md');
  res = spawnSync(process.execPath, [traceScript, 'artifact.written', 'path=tasks/plan.md'], { cwd, encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);

  // 4. build
  res = spawnSync(process.execPath, [stateScript, 'transition', 'build'], { cwd, encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);
  res = spawnSync(process.execPath, [traceScript, 'skill.invoked', 'skill=fresh-context-execution'], { cwd, encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);
  res = spawnSync(process.execPath, [traceScript, 'skill.invoked', 'skill=test-driven-development'], { cwd, encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);
  
  writeArtifact(cwd, 'tasks/reports/task-1-report.md', '# Task 1 Report\n');
  res = spawnSync(process.execPath, [traceScript, 'artifact.written', 'path=tasks/reports/task-1-report.md'], { cwd, encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);

  // 4b. test audit
  res = spawnSync(process.execPath, [traceScript, 'test-audit.started'], { cwd, encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);
  res = spawnSync(process.execPath, [traceScript, 'test-audit.completed'], { cwd, encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);

  // 5. verify
  res = spawnSync(process.execPath, [stateScript, 'transition', 'verify'], { cwd, encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);
  res = spawnSync(process.execPath, [traceScript, 'verification.started'], { cwd, encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);
  
  writeArtifact(cwd, 'tasks/verification.md', '# Verification\nPASS\n');
  res = spawnSync(process.execPath, [traceScript, 'verification.passed'], { cwd, encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);

  // 6. review
  res = spawnSync(process.execPath, [stateScript, 'transition', 'review'], { cwd, encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);
  res = spawnSync(process.execPath, [traceScript, 'review.started'], { cwd, encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);
  
  writeArtifact(cwd, 'tasks/review.md', '# Review\nGO\n');
  res = spawnSync(process.execPath, [traceScript, 'review.completed'], { cwd, encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);

  // 7. ship
  res = spawnSync(process.execPath, [stateScript, 'transition', 'ship'], { cwd, encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);
  res = spawnSync(process.execPath, [traceScript, 'skill.invoked', 'skill=shipping-and-launch'], { cwd, encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);
  
  writeArtifact(cwd, 'tasks/ship-decision.md', '# Ship\nGO\n');

  // 8. pipeline completion (must happen before validation since validation reads final trace)
  res = spawnSync(process.execPath, [stateScript, 'transition', 'done'], { cwd, encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);
  res = spawnSync(process.execPath, [traceScript, 'pipeline.completed', 'verdict=GO'], { cwd, encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);

  // 9. pipeline validation (validates all artifacts and trace ordering)
  res = spawnSync(process.execPath, [pipelineScript, 'validate', '--root', cwd], { cwd, encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);

  // Verify final state file persists correctly
  const state = fs.readFileSync(path.join(cwd, 'tasks', 'STATE.md'), 'utf8');
  assert.match(state, /current_phase: done/);
  assert.match(state, /goal: add multiply/);
});

test('E2E: validation fails when spec or trace is missing', () => {
  const cwd = setupTestProject();

  // Initialize and write half of the run
  spawnSync(process.execPath, [stateScript, 'init', '--goal', 'demo'], { cwd });
  spawnSync(process.execPath, [traceScript, 'pipeline.started'], { cwd });
  writeArtifact(cwd, 'tasks/plan.md');

  // Run pipeline validation, which must fail since SPEC.md is missing and trace is incomplete
  const res = spawnSync(process.execPath, [pipelineScript, 'validate', '--root', cwd], { encoding: 'utf8' });
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /ERROR: Missing required artifact: SPEC\.md/);
});
