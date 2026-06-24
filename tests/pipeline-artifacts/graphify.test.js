const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { GraphifyManager } = require('../../scripts/agent-skills-graph');

describe('GraphifyManager', () => {
  const testDir = path.join(__dirname, '../../test-graphify');
  let manager;

  before(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  after(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    const graphsDir = path.join(testDir, 'tasks/graphs');
    if (fs.existsSync(graphsDir)) {
      fs.rmSync(graphsDir, { recursive: true, force: true });
    }
    const configFile = path.join(testDir, 'tasks', 'config.json');
    if (fs.existsSync(configFile)) {
      fs.unlinkSync(configFile);
    }
    manager = new GraphifyManager(testDir);
  });

  describe('status', () => {
    it('should return disabled status when graphify.enabled is false', () => {
      const status = manager.status();
      assert.strictEqual(status.enabled, false);
      assert.strictEqual(status.available, false);
    });

    it('should return enabled status when config has graphify.enabled true', () => {
      manager.writeConfig({ graphify: { enabled: true } });
      const status = manager.status();
      assert.strictEqual(status.enabled, true);
    });

    it('should return available false when graphify CLI is not installed', () => {
      manager.writeConfig({ graphify: { enabled: true } });
      const status = manager.status();
      assert.strictEqual(status.available, false);
    });
  });

  describe('build', () => {
    it('should return disabled result when graphify.enabled is false', () => {
      const result = manager.build();
      assert.strictEqual(result.status, 'disabled');
      assert.ok(result.message.includes('disabled'));
    });

    it('should return not_found when graphify CLI is not installed', () => {
      manager.writeConfig({ graphify: { enabled: true } });
      const result = manager.build();
      assert.strictEqual(result.status, 'not_found');
      assert.ok(result.message.includes('not found'));
    });

    it('should create graphs directory on build attempt', () => {
      manager.writeConfig({ graphify: { enabled: true } });
      manager.build();
      const graphsDir = path.join(testDir, 'tasks/graphs');
      assert.ok(fs.existsSync(graphsDir));
    });

    it('should honor configured artifact_dir', () => {
      manager.writeConfig({ graphify: { enabled: true, artifact_dir: 'tasks/custom-graphs' } });
      manager.build();
      const graphsDir = path.join(testDir, 'tasks/custom-graphs');
      const status = manager.status();

      assert.ok(fs.existsSync(graphsDir));
      assert.strictEqual(status.graphs_dir, graphsDir);
    });
  });

  describe('query', () => {
    it('should return disabled when graphify is not enabled', () => {
      const result = manager.query('test-term');
      assert.strictEqual(result.status, 'disabled');
    });

    it('should return not_found when graph.json does not exist', () => {
      manager.writeConfig({ graphify: { enabled: true } });
      const result = manager.query('test-term');
      assert.strictEqual(result.status, 'not_found');
    });

    it('should query graph when graph.json exists', () => {
      manager.writeConfig({ graphify: { enabled: true } });
      const graphsDir = path.join(testDir, 'tasks/graphs');
      fs.mkdirSync(graphsDir, { recursive: true });
      const graph = {
        nodes: [
          { id: 'n1', type: 'concept', properties: { title: 'Test Concept' } },
          { id: 'n2', type: 'concept', properties: { title: 'Another Concept' } }
        ],
        edges: [
          { source: 'n1', target: 'n2', type: 'related_to' }
        ]
      };
      fs.writeFileSync(path.join(graphsDir, 'graph.json'), JSON.stringify(graph));
      const result = manager.query('Test', { budget: 10 });
      assert.strictEqual(result.status, 'ok');
      assert.ok(result.results.length > 0);
    });
  });

  describe('diff', () => {
    it('should return disabled when graphify is not enabled', () => {
      const result = manager.diff();
      assert.strictEqual(result.status, 'disabled');
    });

    it('should return no_snapshot when no snapshot exists', () => {
      manager.writeConfig({ graphify: { enabled: true } });
      const graphsDir = path.join(testDir, 'tasks/graphs');
      fs.mkdirSync(graphsDir, { recursive: true });
      const graph = { nodes: [{ id: 'n1' }], edges: [] };
      fs.writeFileSync(path.join(graphsDir, 'graph.json'), JSON.stringify(graph));
      const result = manager.diff();
      assert.strictEqual(result.status, 'no_snapshot');
    });
  });

  describe('snapshot', () => {
    it('should return disabled when graphify is not enabled', () => {
      const result = manager.snapshot();
      assert.strictEqual(result.status, 'disabled');
    });

    it('should create snapshot from graph', () => {
      manager.writeConfig({ graphify: { enabled: true } });
      const graphsDir = path.join(testDir, 'tasks/graphs');
      fs.mkdirSync(graphsDir, { recursive: true });
      const graph = { nodes: [{ id: 'n1' }], edges: [] };
      fs.writeFileSync(path.join(graphsDir, 'graph.json'), JSON.stringify(graph));
      const result = manager.snapshot();
      assert.strictEqual(result.status, 'ok');
      assert.ok(fs.existsSync(path.join(graphsDir, 'snapshot.json')));
    });
  });

  describe('auto_update', () => {
    it('should return disabled when both graphify.enabled and auto_update are false', () => {
      const result = manager.autoUpdate('commit');
      assert.strictEqual(result.status, 'disabled');
    });

    it('should return disabled when graphify.auto_update is false', () => {
      manager.writeConfig({ graphify: { enabled: true, auto_update: false } });
      const result = manager.autoUpdate('commit');
      assert.strictEqual(result.status, 'disabled');
    });

    it('should return skipped for non-HEAD-advancing command', () => {
      manager.writeConfig({ graphify: { enabled: true, auto_update: true } });
      const result = manager.autoUpdate('push');
      assert.strictEqual(result.status, 'skipped');
    });

    it('should return running for HEAD-advancing command when enabled', () => {
      manager.writeConfig({ graphify: { enabled: true, auto_update: true } });
      const result = manager.autoUpdate('commit', { synchronous: true });
      assert.strictEqual(result.status, 'ok');
    });
  });
});
