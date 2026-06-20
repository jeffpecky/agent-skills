#!/usr/bin/env node

/**
 * agent-skills-graph.js
 *
 * Graphify knowledge graph management for agent-skills.
 * Provides build, status, query, diff, snapshot, and auto-update.
 *
 * Usage:
 *   node agent-skills-graph.js status
 *   node agent-skills-graph.js build
 *   node agent-skills-graph.js query <term> [--budget N]
 *   node agent-skills-graph.js diff
 *   node agent-skills-graph.js snapshot
 *   node agent-skills-graph.js auto-update <commit|merge|pull|rebase|cherry-pick>
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class GraphifyManager {
  constructor(projectRoot = null) {
    this.projectRoot = projectRoot || process.cwd();
    this.configFile = path.join(this.projectRoot, 'tasks', 'config.json');
    this.graphsDir = path.join(this.projectRoot, 'tasks', 'graphs');
    this.graphFile = path.join(this.graphsDir, 'graph.json');
    this.snapshotFile = path.join(this.graphsDir, 'snapshot.json');
    this.statusFile = path.join(this.graphsDir, '.last-build-status.json');
    this.lockFile = path.join(this.graphsDir, '.auto-update.lock');
  }

  /**
   * Read project configuration
   */
  readConfig() {
    try {
      return JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
    } catch {
      return {};
    }
  }

  /**
   * Write project configuration
   */
  writeConfig(config) {
    fs.mkdirSync(path.dirname(this.configFile), { recursive: true });
    fs.writeFileSync(this.configFile, JSON.stringify(config, null, 2));
  }

  /**
   * Get graphify config with defaults
   */
  getGraphifyConfig() {
    const config = this.readConfig();
    return {
      enabled: false,
      auto_update: false,
      artifact_dir: 'tasks/graphs',
      stale_after_hours: 24,
      build_timeout_ms: 300000,
      ...(config.graphify || {})
    };
  }

  /**
   * Check if graphify CLI is available
   */
  isGraphifyAvailable() {
    try {
      execSync('graphify --version', { stdio: 'pipe', timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get graphify status
   */
  status() {
    const config = this.getGraphifyConfig();
    const available = config.enabled && this.isGraphifyAvailable();
    const graphExists = fs.existsSync(this.graphFile);
    const snapshotExists = fs.existsSync(this.snapshotFile);

    let lastBuild = null;
    try {
      lastBuild = JSON.parse(fs.readFileSync(this.statusFile, 'utf8'));
    } catch {}

    let stale = false;
    if (lastBuild && lastBuild.timestamp) {
      const ageMs = Date.now() - new Date(lastBuild.timestamp).getTime();
      const staleMs = (config.stale_after_hours || 24) * 60 * 60 * 1000;
      stale = ageMs > staleMs;
    }

    return {
      enabled: config.enabled,
      available,
      auto_update: config.auto_update,
      graph_exists: graphExists,
      snapshot_exists: snapshotExists,
      stale,
      last_build: lastBuild,
      graphs_dir: this.graphsDir
    };
  }

  /**
   * Build knowledge graph
   */
  build() {
    const config = this.getGraphifyConfig();
    if (!config.enabled) {
      return { status: 'disabled', message: 'Graphify is disabled in tasks/config.json' };
    }

    fs.mkdirSync(this.graphsDir, { recursive: true });

    if (!this.isGraphifyAvailable()) {
      return { status: 'not_found', message: 'graphify CLI not found on PATH' };
    }

    const startTime = Date.now();
    try {
      execSync('graphify update .', {
        cwd: this.projectRoot,
        timeout: config.build_timeout_ms,
        stdio: 'pipe'
      });

      const buildResult = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        duration_ms: Date.now() - startTime
      };

      fs.writeFileSync(this.statusFile, JSON.stringify(buildResult, null, 2));
      return buildResult;
    } catch (error) {
      const buildResult = {
        status: 'failed',
        timestamp: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        error: error.message
      };

      fs.writeFileSync(this.statusFile, JSON.stringify(buildResult, null, 2));
      return buildResult;
    }
  }

  /**
   * Query knowledge graph
   */
  query(term, options = {}) {
    const config = this.getGraphifyConfig();
    if (!config.enabled) {
      return { status: 'disabled', message: 'Graphify is disabled' };
    }

    if (!fs.existsSync(this.graphFile)) {
      return { status: 'not_found', message: 'Graph not built yet. Run graphify build first.' };
    }

    try {
      const graph = JSON.parse(fs.readFileSync(this.graphFile, 'utf8'));
      const budget = options.budget || 20;
      const termLower = term.toLowerCase();

      const matchingNodes = (graph.nodes || [])
        .filter(node => {
          const title = (node.properties?.title || node.title || '').toLowerCase();
          const desc = (node.properties?.description || node.description || '').toLowerCase();
          return title.includes(termLower) || desc.includes(termLower);
        })
        .slice(0, budget);

      const matchingNodeIds = new Set(matchingNodes.map(n => n.id));

      const relevantEdges = (graph.edges || []).filter(edge =>
        matchingNodeIds.has(edge.source) || matchingNodeIds.has(edge.target)
      );

      return {
        status: 'ok',
        query: term,
        budget,
        results: matchingNodes.map(node => ({
          id: node.id,
          type: node.type || node.properties?.type,
          title: node.properties?.title || node.title,
          description: node.properties?.description || node.description,
          edges: relevantEdges.filter(e => e.source === node.id || e.target === node.id)
        })),
        summary: {
          nodes_found: matchingNodes.length,
          total_nodes: (graph.nodes || []).length,
          edges_related: relevantEdges.length
        }
      };
    } catch (error) {
      return { status: 'error', message: `Failed to query graph: ${error.message}` };
    }
  }

  /**
   * Diff current graph against snapshot
   */
  diff() {
    const config = this.getGraphifyConfig();
    if (!config.enabled) {
      return { status: 'disabled', message: 'Graphify is disabled' };
    }

    if (!fs.existsSync(this.graphFile)) {
      return { status: 'not_found', message: 'Graph not built yet.' };
    }

    if (!fs.existsSync(this.snapshotFile)) {
      return { status: 'no_snapshot', message: 'No snapshot available. Create one with snapshot command.' };
    }

    try {
      const current = JSON.parse(fs.readFileSync(this.graphFile, 'utf8'));
      const previous = JSON.parse(fs.readFileSync(this.snapshotFile, 'utf8'));

      const currentNodeIds = new Set((current.nodes || []).map(n => n.id));
      const previousNodeIds = new Set((previous.nodes || []).map(n => n.id));

      const addedNodes = (current.nodes || []).filter(n => !previousNodeIds.has(n.id));
      const removedNodes = (previous.nodes || []).filter(n => !currentNodeIds.has(n.id));
      const unchangedNodes = (current.nodes || []).filter(n => previousNodeIds.has(n.id));

      return {
        status: 'ok',
        summary: {
          nodes_added: addedNodes.length,
          nodes_removed: removedNodes.length,
          nodes_unchanged: unchangedNodes.length,
          total_current: (current.nodes || []).length,
          total_previous: (previous.nodes || []).length
        },
        added: addedNodes.map(n => ({ id: n.id, type: n.type, title: n.properties?.title })),
        removed: removedNodes.map(n => ({ id: n.id, type: n.type, title: n.properties?.title })),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return { status: 'error', message: `Failed to diff: ${error.message}` };
    }
  }

  /**
   * Create snapshot of current graph
   */
  snapshot() {
    const config = this.getGraphifyConfig();
    if (!config.enabled) {
      return { status: 'disabled', message: 'Graphify is disabled' };
    }

    if (!fs.existsSync(this.graphFile)) {
      return { status: 'not_found', message: 'Graph not built yet.' };
    }

    try {
      const graph = JSON.parse(fs.readFileSync(this.graphFile, 'utf8'));
      fs.mkdirSync(this.graphsDir, { recursive: true });
      fs.writeFileSync(this.snapshotFile, JSON.stringify(graph, null, 2));

      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        nodes_snapshot: (graph.nodes || []).length,
        edges_snapshot: (graph.edges || []).length
      };
    } catch (error) {
      return { status: 'error', message: `Failed to create snapshot: ${error.message}` };
    }
  }

  /**
   * Auto-update after HEAD-advancing commands
   */
  autoUpdate(command, options = {}) {
    const config = this.getGraphifyConfig();
    if (!config.enabled || !config.auto_update) {
      return { status: 'disabled', message: 'Graphify auto-update is disabled' };
    }

    const headAdvancingCommands = ['commit', 'merge', 'pull', 'rebase', 'cherry-pick'];
    if (!headAdvancingCommands.includes(command)) {
      return { status: 'skipped', message: `Command '${command}' is not HEAD-advancing` };
    }

    // Check for lock
    if (fs.existsSync(this.lockFile)) {
      try {
        const lock = JSON.parse(fs.readFileSync(this.lockFile, 'utf8'));
        const lockAge = Date.now() - new Date(lock.timestamp).getTime();
        // Lock expires after 5 minutes
        if (lockAge < 300000) {
          return { status: 'skipped', message: 'Auto-update already in progress' };
        }
      } catch {}
    }

    // Create lock
    fs.mkdirSync(this.graphsDir, { recursive: true });
    fs.writeFileSync(this.lockFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      command
    }));

    // Run build in background (non-blocking) unless synchronous mode requested
    if (options.synchronous) {
      try {
        const result = this.build();
        fs.writeFileSync(this.statusFile, JSON.stringify({
          ...result,
          auto_update: true,
          triggered_by: command
        }, null, 2));
      } finally {
        try { fs.unlinkSync(this.lockFile); } catch {}
      }
      return { status: 'ok', message: `Auto-update completed for '${command}'` };
    } else {
      setTimeout(() => {
        try {
          const result = this.build();
          fs.writeFileSync(this.statusFile, JSON.stringify({
            ...result,
            auto_update: true,
            triggered_by: command
          }, null, 2));
        } finally {
          try { fs.unlinkSync(this.lockFile); } catch {}
        }
      }, 100);
      return { status: 'running', message: `Auto-update triggered by '${command}'` };
    }
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  const manager = new GraphifyManager();

  let result;
  switch (command) {
    case 'status':
      result = manager.status();
      break;
    case 'build':
      result = manager.build();
      break;
    case 'query':
      result = manager.query(args[1], { budget: parseInt(args[3]) || 20 });
      break;
    case 'diff':
      result = manager.diff();
      break;
    case 'snapshot':
      result = manager.snapshot();
      break;
    case 'auto-update':
      result = manager.autoUpdate(args[1]);
      break;
    default:
      result = { status: 'error', message: `Unknown command: ${command}` };
  }

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === 'error' ? 1 : 0);
}

module.exports = { GraphifyManager };
