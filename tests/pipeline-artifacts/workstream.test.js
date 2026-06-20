const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { WorkstreamManager } = require('../../scripts/agent-skills-workstream');

describe('WorkstreamManager', () => {
  const testDir = path.join(__dirname, '../../test-workstreams');
  let manager;

  before(() => {
    // Create test directory
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  after(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    // Clean up before each test
    const workstreamsDir = path.join(testDir, 'tasks/workstreams');
    if (fs.existsSync(workstreamsDir)) {
      fs.rmSync(workstreamsDir, { recursive: true, force: true });
    }
    
    manager = new WorkstreamManager();
    manager.workstreamsDir = workstreamsDir;
    manager.configFile = path.join(workstreamsDir, 'config.json');
  });

  describe('create', () => {
    it('should create a workstream with valid name', () => {
      const result = manager.create('backend-api', 'backend');
      
      assert.strictEqual(result.name, 'backend-api');
      assert.strictEqual(result.area, 'backend');
      assert.ok(fs.existsSync(result.path));
      assert.ok(fs.existsSync(path.join(result.path, 'STATE.md')));
      assert.ok(fs.existsSync(path.join(result.path, 'config.json')));
    });

    it('should reject invalid workstream names', () => {
      assert.throws(() => manager.create('invalid name'), /Invalid workstream name/);
      assert.throws(() => manager.create('..'), /Invalid workstream name/);
      assert.throws(() => manager.create('a/b'), /Invalid workstream name/);
    });

    it('should not allow duplicate workstreams', () => {
      manager.create('backend-api');
      assert.throws(() => manager.create('backend-api'), /already exists/);
    });
  });

  describe('list', () => {
    it('should list all workstreams', () => {
      manager.create('backend-api', 'backend');
      manager.create('frontend-dash', 'frontend');
      
      const workstreams = manager.list();
      assert.strictEqual(workstreams.length, 2);
      assert.ok(workstreams.some(ws => ws.name === 'backend-api'));
      assert.ok(workstreams.some(ws => ws.name === 'frontend-dash'));
    });

    it('should return empty array when no workstreams exist', () => {
      const workstreams = manager.list();
      assert.strictEqual(workstreams.length, 0);
    });
  });

  describe('select', () => {
    it('should select a workstream as active', () => {
      manager.create('backend-api');
      manager.create('frontend-dash');
      
      manager.select('frontend-dash');
      assert.strictEqual(manager.getActive(), 'frontend-dash');
    });

    it('should reject selecting non-existent workstream', () => {
      assert.throws(() => manager.select('non-existent'), /does not exist/);
    });
  });

  describe('status', () => {
    it('should return status for all workstreams', () => {
      manager.create('backend-api', 'backend');
      manager.create('frontend-dash', 'frontend');
      manager.select('backend-api');
      
      const status = manager.status();
      assert.strictEqual(status.active, 'backend-api');
      assert.strictEqual(status.workstreams.length, 2);
    });

    it('should return status for specific workstream', () => {
      manager.create('backend-api', 'backend');
      
      const status = manager.status('backend-api');
      assert.strictEqual(status.name, 'backend-api');
      assert.ok(status.state);
    });
  });

  describe('delete', () => {
    it('should delete a workstream', () => {
      manager.create('backend-api');
      manager.select('backend-api');
      
      manager.delete('backend-api');
      assert.strictEqual(manager.list().length, 0);
      assert.strictEqual(manager.getActive(), null);
    });

    it('should reject deleting non-existent workstream', () => {
      assert.throws(() => manager.delete('non-existent'), /does not exist/);
    });
  });

  describe('dependencies', () => {
    it('should add cross-area dependency', () => {
      manager.create('backend-api');
      manager.create('frontend-dash');
      
      manager.addDependency('backend-api', 'frontend-dash');
      const deps = manager.getCrossAreaDependencies();
      
      assert.strictEqual(deps.length, 1);
      assert.strictEqual(deps[0].from, 'backend-api');
      assert.strictEqual(deps[0].to, 'frontend-dash');
    });

    it('should check if workstream can start', () => {
      manager.create('backend-api');
      manager.create('frontend-dash');
      
      manager.addDependency('backend-api', 'frontend-dash');
      
      // backend-api cannot start because frontend-dash is not complete
      const canStart = manager.canStart('backend-api');
      assert.strictEqual(canStart.canStart, false);
      assert.ok(canStart.blockers.length > 0);
    });

    it('should allow workstream with no dependencies', () => {
      manager.create('frontend-dash');
      
      const canStart = manager.canStart('frontend-dash');
      assert.strictEqual(canStart.canStart, true);
      assert.strictEqual(canStart.blockers.length, 0);
    });
  });

  describe('execution plan', () => {
    it('should generate execution plan with waves', () => {
      manager.create('backend-api');
      manager.create('frontend-dash');
      manager.create('infrastructure');
      
      manager.addDependency('backend-api', 'frontend-dash');
      
      const plan = manager.generateExecutionPlan();
      
      assert.ok(plan.waves.length > 0);
      assert.ok(plan.workstreams.length === 3);
      assert.ok(plan.dependencies.length === 1);
    });

    it('should handle complex dependency chains', () => {
      manager.create('backend-api');
      manager.create('frontend-dash');
      manager.create('infrastructure');
      
      // frontend depends on infra, backend depends on frontend
      manager.addDependency('frontend-dash', 'infrastructure');
      manager.addDependency('backend-api', 'frontend-dash');
      
      const plan = manager.generateExecutionPlan();
      
      // Should have 3 waves: infra, then frontend, then backend
      assert.ok(plan.waves.length >= 2);
    });
  });

  describe('session-scoped pointers', () => {
    it('should use session-scoped pointer for select/getActive', () => {
      manager.create('backend-api');
      manager.create('frontend-dash');
      
      manager.select('backend-api');
      assert.strictEqual(manager.getActive(), 'backend-api');
      
      // Session pointer should exist
      const pointerPath = manager._sessionPointerPath();
      assert.ok(fs.existsSync(pointerPath));
      assert.strictEqual(fs.readFileSync(pointerPath, 'utf-8'), 'backend-api');
    });

    it('should self-heal when workstream is deleted', () => {
      manager.create('backend-api');
      manager.select('backend-api');
      assert.strictEqual(manager.getActive(), 'backend-api');
      
      // Delete the active workstream
      manager.delete('backend-api');
      
      // getActive should self-heal and return null
      assert.strictEqual(manager.getActive(), null);
    });

    it('should clear session pointer on delete', () => {
      manager.create('backend-api');
      manager.select('backend-api');
      
      const pointerPath = manager._sessionPointerPath();
      assert.ok(fs.existsSync(pointerPath));
      
      manager.delete('backend-api');
      assert.ok(!fs.existsSync(pointerPath));
    });
  });

  describe('collision detection', () => {
    it('should detect other active workstreams', () => {
      manager.create('backend-api');
      manager.create('frontend-dash');
      manager.create('infrastructure');
      
      const others = manager.getOtherActiveWorkstreams('backend-api');
      // All are in 'plan' phase, so both others should be active
      assert.strictEqual(others.length, 2);
    });

    it('should return empty when no other workstreams active', () => {
      manager.create('backend-api');
      
      const others = manager.getOtherActiveWorkstreams('backend-api');
      assert.strictEqual(others.length, 0);
    });

    it('should check milestone collision', () => {
      manager.create('backend-api');
      manager.create('frontend-dash');
      
      const collision = manager.checkMilestoneCollision('backend-api');
      assert.strictEqual(collision.safe, false);
      assert.ok(collision.others.length > 0);
      assert.ok(collision.message.includes('frontend-dash'));
    });

    it('should report safe when no collisions', () => {
      manager.create('backend-api');
      
      const collision = manager.checkMilestoneCollision('backend-api');
      assert.strictEqual(collision.safe, true);
      assert.strictEqual(collision.others.length, 0);
    });
  });

  describe('progress tracking', () => {
    it('should calculate progress per workstream via status()', () => {
      manager.create('backend-api');
      
      // Write STATE.md with some completed tasks
      const stateContent = `# Workstream State

## Current Phase
- Phase: build
- Area: backend

## Progress
| Task | Status | Commits | Notes |
|------|--------|---------|-------|
| 1 | done | abc1234 | — |
| 2 | done | def5678 | — |
| 3 | active | — | in progress |
`;
      fs.writeFileSync(path.join(manager.workstreamsDir, 'backend-api', 'STATE.md'), stateContent);
      
      const status = manager.status('backend-api');
      // status(name) returns { state: { tasks: [...] } }
      const tasks = status.state.tasks;
      const total = tasks.length;
      const completed = tasks.filter(t => t.status === 'done' || t.status === 'complete').length;
      assert.strictEqual(total, 3);
      assert.strictEqual(completed, 2);
      assert.strictEqual(Math.round((completed / total) * 100), 67);
    });

    it('should calculate overall progress across workstreams', () => {
      manager.create('backend-api');
      manager.create('frontend-dash');
      
      // Backend: 2/3 tasks done
      const backendState = `# Workstream State

## Current Phase
- Phase: build

## Progress
| Task | Status | Commits | Notes |
|------|--------|---------|-------|
| 1 | done | abc1234 | — |
| 2 | done | def5678 | — |
| 3 | active | — | in progress |
`;
      fs.writeFileSync(path.join(manager.workstreamsDir, 'backend-api', 'STATE.md'), backendState);
      
      // Frontend: 1/2 tasks done
      const frontendState = `# Workstream State

## Current Phase
- Phase: build

## Progress
| Task | Status | Commits | Notes |
|------|--------|---------|-------|
| 1 | done | abc1234 | — |
| 2 | active | — | in progress |
`;
      fs.writeFileSync(path.join(manager.workstreamsDir, 'frontend-dash', 'STATE.md'), frontendState);
      
      const status = manager.status();
      // status() returns { overall: { total, completed, percent } }
      assert.strictEqual(status.overall.total, 5);
      assert.strictEqual(status.overall.completed, 3);
      assert.strictEqual(status.overall.percent, 60);
    });
  });
});
