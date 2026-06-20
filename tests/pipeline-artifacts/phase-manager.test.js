'use strict';
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

const { listPhases, createPhase, activatePhase, completePhase, getCurrentPhase, getProgress, initPhaseStructure, parsePhaseDirName, formatPhaseDirName } = require('../../scripts/agent-skills-phase.js');

describe('Phase Manager', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-test-'));
    fs.mkdirSync(path.join(tmpDir, 'tasks'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('parsePhaseDirName', () => {
    it('should parse "01-setup"', () => {
      const result = parsePhaseDirName('01-setup');
      assert.deepEqual(result, { order: 1, name: 'setup' });
    });

    it('should parse "02-build"', () => {
      const result = parsePhaseDirName('02-build');
      assert.deepEqual(result, { order: 2, name: 'build' });
    });

    it('should return null for invalid names', () => {
      assert.equal(parsePhaseDirName('setup'), null);
      assert.equal(parsePhaseDirName('01_'), null);
      assert.equal(parsePhaseDirName('abc'), null);
    });
  });

  describe('formatPhaseDirName', () => {
    it('should format correctly', () => {
      assert.equal(formatPhaseDirName(1, 'setup'), '01-setup');
      assert.equal(formatPhaseDirName(12, 'build'), '12-build');
    });
  });

  describe('listPhases', () => {
    it('should return empty when no phases exist', () => {
      const phases = listPhases(tmpDir);
      assert.deepEqual(phases, []);
    });

    it('should list phases sorted by order', () => {
      createPhase(tmpDir, 'build', 2);
      createPhase(tmpDir, 'setup', 1);
      const phases = listPhases(tmpDir);
      assert.equal(phases.length, 2);
      assert.equal(phases[0].name, '01-setup');
      assert.equal(phases[1].name, '02-build');
    });

    it('should detect plan presence', () => {
      createPhase(tmpDir, 'setup', 1);
      fs.writeFileSync(path.join(tmpDir, 'tasks', 'phases', '01-setup', 'PLAN.md'), '# Plan');
      const phases = listPhases(tmpDir);
      assert.equal(phases[0].hasPlan, true);
      assert.equal(phases[0].status, 'in_progress');
    });

    it('should detect summary presence', () => {
      createPhase(tmpDir, 'setup', 1);
      fs.writeFileSync(path.join(tmpDir, 'tasks', 'phases', '01-setup', 'PLAN.md'), '# Plan');
      fs.writeFileSync(path.join(tmpDir, 'tasks', 'phases', '01-setup', 'SUMMARY.md'), '# Done');
      const phases = listPhases(tmpDir);
      assert.equal(phases[0].hasSummary, true);
      assert.equal(phases[0].status, 'complete');
    });

    it('should count tasks in phase', () => {
      createPhase(tmpDir, 'setup', 1);
      const tasksDir = path.join(tmpDir, 'tasks', 'phases', '01-setup', 'tasks');
      fs.writeFileSync(path.join(tasksDir, 'task-1.md'), '# Task 1');
      fs.writeFileSync(path.join(tasksDir, 'task-2.md'), '# Task 2');
      const phases = listPhases(tmpDir);
      assert.equal(phases[0].taskCount, 2);
    });
  });

  describe('createPhase', () => {
    it('should create phase directory', () => {
      const result = createPhase(tmpDir, 'setup', 1);
      assert.equal(result.success, true);
      assert.equal(result.name, '01-setup');
      assert.ok(fs.existsSync(result.path));
    });

    it('should create tasks subdirectory', () => {
      const result = createPhase(tmpDir, 'setup', 1);
      assert.ok(fs.existsSync(path.join(result.path, 'tasks')));
    });

    it('should auto-assign order', () => {
      createPhase(tmpDir, 'setup', 1);
      const result = createPhase(tmpDir, 'build');
      assert.equal(result.name, '02-build');
    });

    it('should reject duplicate phases', () => {
      createPhase(tmpDir, 'setup', 1);
      const result = createPhase(tmpDir, 'setup', 1);
      assert.equal(result.success, false);
      assert.ok(result.error.includes('already exists'));
    });
  });

  describe('activatePhase', () => {
    it('should activate a phase', () => {
      createPhase(tmpDir, 'setup', 1);
      const result = activatePhase(tmpDir, '01-setup');
      assert.equal(result.success, true);
      assert.equal(result.active, '01-setup');
    });

    it('should write active marker', () => {
      createPhase(tmpDir, 'setup', 1);
      activatePhase(tmpDir, '01-setup');
      const marker = path.join(tmpDir, 'tasks', 'phases', '.active');
      assert.ok(fs.existsSync(marker));
      assert.equal(fs.readFileSync(marker, 'utf-8'), '01-setup');
    });

    it('should reject non-existent phase', () => {
      const result = activatePhase(tmpDir, '99-nope');
      assert.equal(result.success, false);
    });
  });

  describe('completePhase', () => {
    it('should write SUMMARY.md', () => {
      createPhase(tmpDir, 'setup', 1);
      const result = completePhase(tmpDir, '01-setup', '# Setup Complete\n\nAll done.');
      assert.equal(result.success, true);
      const summary = fs.readFileSync(path.join(tmpDir, 'tasks', 'phases', '01-setup', 'SUMMARY.md'), 'utf-8');
      assert.ok(summary.includes('Setup Complete'));
    });

    it('should use default summary if none provided', () => {
      createPhase(tmpDir, 'setup', 1);
      completePhase(tmpDir, '01-setup');
      const summary = fs.readFileSync(path.join(tmpDir, 'tasks', 'phases', '01-setup', 'SUMMARY.md'), 'utf-8');
      assert.ok(summary.includes('Phase completed'));
    });

    it('should reject non-existent phase', () => {
      const result = completePhase(tmpDir, '99-nope');
      assert.equal(result.success, false);
    });
  });

  describe('getCurrentPhase', () => {
    it('should return null when no phase active', () => {
      assert.equal(getCurrentPhase(tmpDir), null);
    });

    it('should return active phase', () => {
      createPhase(tmpDir, 'setup', 1);
      activatePhase(tmpDir, '01-setup');
      assert.equal(getCurrentPhase(tmpDir), '01-setup');
    });

    it('should return null if active phase was deleted', () => {
      createPhase(tmpDir, 'setup', 1);
      activatePhase(tmpDir, '01-setup');
      fs.rmSync(path.join(tmpDir, 'tasks', 'phases', '01-setup'), { recursive: true });
      assert.equal(getCurrentPhase(tmpDir), null);
    });
  });

  describe('getProgress', () => {
    it('should return empty progress when no phases', () => {
      const progress = getProgress(tmpDir);
      assert.equal(progress.overall.total, 0);
      assert.equal(progress.overall.percent, 0);
    });

    it('should calculate overall progress', () => {
      createPhase(tmpDir, 'setup', 1);
      createPhase(tmpDir, 'build', 2);
      createPhase(tmpDir, 'ship', 3);

      completePhase(tmpDir, '01-setup');
      completePhase(tmpDir, '02-build');

      const progress = getProgress(tmpDir);
      assert.equal(progress.overall.total, 3);
      assert.equal(progress.overall.complete, 2);
      assert.equal(progress.overall.percent, 67);
    });

    it('should calculate per-phase progress', () => {
      createPhase(tmpDir, 'setup', 1);
      const tasksDir = path.join(tmpDir, 'tasks', 'phases', '01-setup', 'tasks');
      fs.writeFileSync(path.join(tasksDir, 'task-1.md'), '# Task 1');
      fs.writeFileSync(path.join(tasksDir, 'task-1.status.json'), JSON.stringify({ status: 'done' }));
      fs.writeFileSync(path.join(tasksDir, 'task-2.md'), '# Task 2');

      const progress = getProgress(tmpDir);
      assert.equal(progress.phases[0].taskCount, 2);
      assert.equal(progress.phases[0].completedCount, 1);
      assert.equal(progress.phases[0].progress, 50);
    });
  });

  describe('initPhaseStructure', () => {
    it('should create phases directory', () => {
      initPhaseStructure(tmpDir);
      assert.ok(fs.existsSync(path.join(tmpDir, 'tasks', 'phases')));
    });

    it('should create default first phase', () => {
      initPhaseStructure(tmpDir);
      const phases = listPhases(tmpDir);
      assert.equal(phases.length, 1);
      assert.equal(phases[0].name, '01-setup');
    });

    it('should not overwrite existing phases', () => {
      createPhase(tmpDir, 'custom', 1);
      initPhaseStructure(tmpDir);
      const phases = listPhases(tmpDir);
      assert.equal(phases.length, 1);
      assert.equal(phases[0].name, '01-custom');
    });
  });
});
