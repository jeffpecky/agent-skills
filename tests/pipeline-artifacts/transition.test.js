'use strict';
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('node:child_process');

const {
  determineRoute,
  archiveMilestone,
  postWaveUpdate,
  stashCheck,
  cwdGuard,
  listWorkstreams,
  listMilestones,
  getPhaseProgress,
  getWorkstreamProgress
} = require('../../scripts/agent-skills-transition.js');

const transitionScript = path.join(__dirname, '..', '..', 'scripts', 'agent-skills-transition.js');

describe('Transition & Worktree Safety', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transition-test-'));
    fs.mkdirSync(path.join(tmpDir, 'tasks'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // --- TRANSITION ROUTES ---

  describe('determineRoute', () => {
    it('should return route A when more phases exist', () => {
      const phasesDir = path.join(tmpDir, 'tasks', 'phases');
      fs.mkdirSync(path.join(phasesDir, '01-setup'), { recursive: true });
      fs.writeFileSync(path.join(phasesDir, '01-setup', 'SUMMARY.md'), 'done');
      fs.mkdirSync(path.join(phasesDir, '02-build'), { recursive: true });
      fs.writeFileSync(path.join(phasesDir, '02-build', 'PLAN.md'), '# Build');

      const result = determineRoute(tmpDir);
      assert.equal(result.route, 'A');
      assert.equal(result.action, 'advance_phase');
    });

    it('should return route B when all phases complete and no other workstreams', () => {
      const phasesDir = path.join(tmpDir, 'tasks', 'phases');
      fs.mkdirSync(path.join(phasesDir, '01-setup'), { recursive: true });
      fs.writeFileSync(path.join(phasesDir, '01-setup', 'SUMMARY.md'), 'done');

      const result = determineRoute(tmpDir);
      assert.equal(result.route, 'B');
      assert.equal(result.action, 'archive');
    });

    it('should return route B1 when other workstreams are active', () => {
      const phasesDir = path.join(tmpDir, 'tasks', 'phases');
      fs.mkdirSync(path.join(phasesDir, '01-setup'), { recursive: true });
      fs.writeFileSync(path.join(phasesDir, '01-setup', 'SUMMARY.md'), 'done');

      // Create another active workstream
      const wsDir = path.join(tmpDir, '.workstreams', 'frontend');
      fs.mkdirSync(path.join(wsDir, 'phases', '01-ui'), { recursive: true });
      fs.writeFileSync(path.join(wsDir, 'phases', '01-ui', 'PLAN.md'), '# UI');

      const result = determineRoute(tmpDir);
      assert.equal(result.route, 'B1');
      assert.equal(result.action, 'block');
      assert.ok(result.workstreams.length > 0);
    });
  });

  describe('archiveMilestone', () => {
    it('should create milestone directory', () => {
      const result = archiveMilestone(tmpDir, 'v1');
      assert.equal(result.success, true);
      assert.ok(fs.existsSync(path.join(tmpDir, '.milestones', 'v1')));
    });

    it('should write COMPLETED.md', () => {
      archiveMilestone(tmpDir, 'v1');
      const content = fs.readFileSync(path.join(tmpDir, '.milestones', 'v1', 'COMPLETED.md'), 'utf-8');
      assert.ok(content.includes('Completed'));
    });
  });

  // --- POST-WAVE UPDATE ---

  describe('postWaveUpdate', () => {
    it('should append to shared files', () => {
      const stateFile = path.join(tmpDir, 'STATE.md');
      fs.writeFileSync(stateFile, '# State\n');

      const result = postWaveUpdate(tmpDir, ['STATE.md'], {
        'STATE.md': { action: 'append', content: 'Task 1 done\n' }
      });

      assert.equal(result.success, true);
      const content = fs.readFileSync(stateFile, 'utf-8');
      assert.ok(content.includes('Task 1 done'));
    });

    it('should write new files', () => {
      const result = postWaveUpdate(tmpDir, ['new-file.md'], {
        'new-file.md': { action: 'write', content: '# New File\n' }
      });

      assert.equal(result.success, true);
      assert.ok(fs.existsSync(path.join(tmpDir, 'new-file.md')));
    });

    it('should merge progress tables', () => {
      const stateFile = path.join(tmpDir, 'STATE.md');
      fs.writeFileSync(stateFile, `# State
## Progress
| Task | Status |
|------|--------|
| task-1 | done |
`);

      const result = postWaveUpdate(tmpDir, ['STATE.md'], {
        'STATE.md': {
          action: 'merge-table',
          content: `| Task | Status |
|------|--------|
| task-2 | active |
`
        }
      });

      assert.equal(result.success, true);
      const content = fs.readFileSync(stateFile, 'utf-8');
      assert.ok(content.includes('task-1'));
      assert.ok(content.includes('task-2'));
    });
  });

  // --- WORKTREE SAFETY ---

  describe('stashCheck', () => {
    it('should detect no stash in non-git repo', () => {
      const result = stashCheck(tmpDir);
      assert.equal(result.hasStash, false);
    });
  });

  describe('cwdGuard', () => {
    it('should report OK when not in a worktree', () => {
      const result = cwdGuard(tmpDir);
      assert.equal(result.ok, true);
      assert.equal(result.isInWorktree, false);
    });
  });

  describe('merge-worktree command safety', () => {
    it('treats shell metacharacters in branch names as data', () => {
      const marker = path.join(tmpDir, 'injected');
      const branch = `missing;node -e "require('fs').writeFileSync('${marker.replace(/\\/g, '\\\\')}','x')"`;

      const result = spawnSync(process.execPath, [transitionScript, 'merge-worktree', tmpDir, branch], {
        encoding: 'utf8',
      });

      assert.notEqual(result.status, 0);
      assert.equal(fs.existsSync(marker), false);
    });
  });

  describe('getPhaseProgress', () => {
    it('should return 0 when no phases exist', () => {
      const result = getPhaseProgress(tmpDir);
      assert.deepEqual(result, { total: 0, complete: 0 });
    });

    it('should count phases correctly', () => {
      const phasesDir = path.join(tmpDir, 'tasks', 'phases');
      fs.mkdirSync(path.join(phasesDir, '01-setup'), { recursive: true });
      fs.writeFileSync(path.join(phasesDir, '01-setup', 'SUMMARY.md'), 'done');
      fs.mkdirSync(path.join(phasesDir, '02-build'), { recursive: true });

      const result = getPhaseProgress(tmpDir);
      assert.equal(result.total, 2);
      assert.equal(result.complete, 1);
    });
  });

  describe('getWorkstreamProgress', () => {
    it('should return null for non-existent workstream', () => {
      const result = getWorkstreamProgress(tmpDir, 'nope');
      assert.equal(result, null);
    });

    it('should report workstream progress', () => {
      const wsDir = path.join(tmpDir, '.workstreams', 'backend');
      fs.mkdirSync(path.join(wsDir, 'phases', '01-api'), { recursive: true });
      fs.writeFileSync(path.join(wsDir, 'phases', '01-api', 'SUMMARY.md'), 'done');
      fs.mkdirSync(path.join(wsDir, 'phases', '02-db'), { recursive: true });

      const result = getWorkstreamProgress(tmpDir, 'backend');
      assert.equal(result.name, 'backend');
      assert.equal(result.phases.complete, 1);
      assert.equal(result.phases.total, 2);
      assert.equal(result.progress, 50);
      assert.equal(result.isComplete, false);
    });
  });

  describe('listWorkstreams', () => {
    it('should return empty when none exist', () => {
      assert.deepEqual(listWorkstreams(tmpDir), []);
    });

    it('should list workstream directories', () => {
      fs.mkdirSync(path.join(tmpDir, '.workstreams', 'backend'), { recursive: true });
      fs.mkdirSync(path.join(tmpDir, '.workstreams', 'frontend'), { recursive: true });
      const result = listWorkstreams(tmpDir);
      assert.equal(result.length, 2);
      assert.ok(result.includes('backend'));
      assert.ok(result.includes('frontend'));
    });
  });

  describe('listMilestones', () => {
    it('should return empty when none exist', () => {
      assert.deepEqual(listMilestones(tmpDir), []);
    });

    it('should list milestone directories', () => {
      fs.mkdirSync(path.join(tmpDir, '.milestones', 'v1'), { recursive: true });
      const result = listMilestones(tmpDir);
      assert.equal(result.length, 1);
      assert.equal(result[0], 'v1');
    });
  });
});
