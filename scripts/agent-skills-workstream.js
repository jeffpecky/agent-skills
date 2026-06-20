#!/usr/bin/env node

/**
 * agent-skills-workstream.js
 *
 * Workstream management for multi-area projects (backend, frontend, infra).
 * Each workstream gets isolated planning state while sharing code.
 *
 * Usage:
 *   node agent-skills-workstream.js create <name> [--area <area>]
 *   node agent-skills-workstream.js list
 *   node agent-skills-workstream.js select <name>
 *   node agent-skills-workstream.js status [<name>]
 *   node agent-skills-workstream.js delete <name>
 *   node agent-skills-workstream.js cross-area-dependencies
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const TASKS_DIR = 'tasks';
const STATE_FILE = 'STATE.md';
const STALE_THRESHOLD_MS = 300000; // 5 minutes

class WorkstreamManager {
  constructor() {
    this.workstreamsDir = path.join(TASKS_DIR, 'workstreams');
    this.configFile = path.join(this.workstreamsDir, 'config.json');
  }

  /**
   * Get session identity for scoped pointers.
   * Uses same resolution as gsd-core: CLAUDE_SESSION_ID > TERM_SESSION_ID > WT_SESSION > TMUX_PANE > TTY
   */
  _getSessionId() {
    const candidates = [
      process.env.CLAUDE_SESSION_ID,
      process.env.CODEX_THREAD_ID,
      process.env.TERM_SESSION_ID,
      process.env.WT_SESSION,
      process.env.TMUX_PANE,
    ].filter(Boolean);

    if (candidates.length > 0) return candidates[0];

    // Fallback to TTY name
    try {
      if (process.stdin && process.stdin.isTTY) {
        return `tty-${process.stdin.fd}`;
      }
    } catch {}

    // Last resort: PID-based (unique per process, not per session)
    return `pid-${process.pid}`;
  }

  /**
   * Get path to session-scoped pointer file
   */
  _sessionPointerPath() {
    const sessionId = this._getSessionId();
    const safeId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(os.tmpdir(), `agent-skills-ws-${safeId}`);
  }

  /**
   * Read active workstream from session-scoped pointer
   */
  _readSessionPointer() {
    const pointerPath = this._sessionPointerPath();
    try {
      const name = fs.readFileSync(pointerPath, 'utf-8').trim();
      // Self-heal: if workstream doesn't exist, clear pointer
      if (name && !fs.existsSync(path.join(this.workstreamsDir, name))) {
        this._clearSessionPointer();
        return null;
      }
      return name || null;
    } catch {
      return null;
    }
  }

  /**
   * Write session-scoped pointer
   */
  _writeSessionPointer(name) {
    const pointerPath = this._sessionPointerPath();
    fs.writeFileSync(pointerPath, name);
  }

  /**
   * Clear session-scoped pointer
   */
  _clearSessionPointer() {
    const pointerPath = this._sessionPointerPath();
    try { fs.unlinkSync(pointerPath); } catch {}
  }

  /**
   * Read shared config (fallback for non-session-aware tools)
   */
  _readSharedConfig() {
    try {
      return JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
    } catch {
      return {};
    }
  }

  /**
   * Write shared config
   */
  _writeSharedConfig(config) {
    fs.writeFileSync(this.configFile, JSON.stringify(config, null, 2));
  }

  /**
   * Get all workstreams
   */
  list() {
    if (!fs.existsSync(this.workstreamsDir)) {
      return [];
    }

    const entries = fs.readdirSync(this.workstreamsDir, { withFileTypes: true });
    const workstreams = [];

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const workstreamPath = path.join(this.workstreamsDir, entry.name);
        const statePath = path.join(workstreamPath, STATE_FILE);

        let state = null;
        if (fs.existsSync(statePath)) {
          state = this.parseState(statePath);
        }

        workstreams.push({
          name: entry.name,
          path: workstreamPath,
          state: state,
          active: this.isActive(entry.name)
        });
      }
    }

    return workstreams;
  }

  /**
   * Create a new workstream
   */
  create(name, area = null) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name)) {
      throw new Error(`Invalid workstream name: ${name}. Use alphanumeric, dots, underscores, hyphens.`);
    }

    const workstreamPath = path.join(this.workstreamsDir, name);

    if (fs.existsSync(workstreamPath)) {
      throw new Error(`Workstream '${name}' already exists.`);
    }

    // Create directory structure
    fs.mkdirSync(workstreamPath, { recursive: true });

    // Create initial STATE.md
    const stateContent = `# Workstream State

## Current Phase
- Phase: plan
- Area: ${area || name}
- Started: ${new Date().toISOString()}

## Progress
| Task | Status | Commits | Notes |
|------|--------|---------|-------|
|      |        |         |       |

## Dependencies
- Depends on: none
- Blocked by: none

## Decisions
- Area: ${area || name}
`;

    fs.writeFileSync(path.join(workstreamPath, STATE_FILE), stateContent);

    // Create config file
    const config = {
      name: name,
      area: area || name,
      created: new Date().toISOString(),
      dependencies: [],
      sharedFiles: []
    };

    fs.writeFileSync(
      path.join(workstreamPath, 'config.json'),
      JSON.stringify(config, null, 2)
    );

    // Initialize as active if first workstream
    const workstreams = this.list();
    if (workstreams.length === 1) {
      this.select(name);
    }

    return { name, path: workstreamPath, area: area || name };
  }

  /**
   * Select a workstream as active (session-scoped + shared fallback)
   */
  select(name) {
    const workstreamPath = path.join(this.workstreamsDir, name);
    if (!fs.existsSync(workstreamPath)) {
      throw new Error(`Workstream '${name}' does not exist.`);
    }

    // Write session-scoped pointer (primary)
    this._writeSessionPointer(name);

    // Also update shared config (fallback for non-session-aware tools)
    const config = this._readSharedConfig();
    config.active = name;
    config.lastSelected = new Date().toISOString();
    this._writeSharedConfig(config);

    return { active: name, session: this._getSessionId() };
  }

  /**
   * Get active workstream (session-scoped > shared config)
   */
  getActive() {
    // 1. Session-scoped pointer (highest priority)
    const sessionName = this._readSessionPointer();
    if (sessionName) return sessionName;

    // 2. Shared config (fallback for non-session-aware tools)
    const config = this._readSharedConfig();
    return config.active || null;
  }

  /**
   * Check if a workstream is active
   */
  isActive(name) {
    return this.getActive() === name;
  }

  /**
   * Get workstream status with progress
   */
  status(name = null) {
    if (name) {
      return this.getWorkstreamStatus(name);
    }

    // Get status for all workstreams
    const workstreams = this.list();
    const active = this.getActive();
    const sessionId = this._getSessionId();

    // Calculate progress per workstream
    const workstreamStatuses = workstreams.map(ws => {
      const tasks = ws.state?.tasks || [];
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.status === 'done' || t.status === 'complete').length;
      const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      return {
        name: ws.name,
        active: ws.active,
        area: ws.state?.area || ws.name,
        phase: ws.state?.phase || 'unknown',
        tasks: tasks,
        progress: {
          total: totalTasks,
          completed: completedTasks,
          percent: progressPercent
        }
      };
    });

    // Aggregate progress
    const totalTasks = workstreamStatuses.reduce((sum, ws) => sum + ws.progress.total, 0);
    const completedTasks = workstreamStatuses.reduce((sum, ws) => sum + ws.progress.completed, 0);
    const overallPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      active,
      session: sessionId,
      overall: { total: totalTasks, completed: completedTasks, percent: overallPercent },
      workstreams: workstreamStatuses
    };
  }

  /**
   * Get detailed status for a specific workstream
   */
  getWorkstreamStatus(name) {
    const workstreamPath = path.join(this.workstreamsDir, name);
    if (!fs.existsSync(workstreamPath)) {
      throw new Error(`Workstream '${name}' does not exist.`);
    }

    const statePath = path.join(workstreamPath, STATE_FILE);
    const configPath = path.join(workstreamPath, 'config.json');

    let state = null;
    if (fs.existsSync(statePath)) {
      state = this.parseState(statePath);
    }

    let config = null;
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }

    return {
      name,
      path: workstreamPath,
      active: this.isActive(name),
      state,
      config
    };
  }

  /**
   * Delete a workstream
   */
  delete(name) {
    const workstreamPath = path.join(this.workstreamsDir, name);
    if (!fs.existsSync(workstreamPath)) {
      throw new Error(`Workstream '${name}' does not exist.`);
    }

    // Clear session pointer if this was the active workstream
    if (this.isActive(name)) {
      this._clearSessionPointer();

      // Also clear shared config
      const config = this._readSharedConfig();
      delete config.active;
      this._writeSharedConfig(config);
    }

    // Remove directory
    fs.rmSync(workstreamPath, { recursive: true, force: true });

    return { deleted: name };
  }

  /**
   * Check if other workstreams are active (collision detection).
   * Returns list of active workstreams excluding the given one.
   */
  getOtherActiveWorkstreams(currentName) {
    const workstreams = this.list();
    const others = [];

    for (const ws of workstreams) {
      if (ws.name !== currentName && ws.state && ws.state.phase !== 'done' && ws.state.phase !== 'complete') {
        others.push({
          name: ws.name,
          area: ws.state?.area || ws.name,
          phase: ws.state?.phase || 'unknown'
        });
      }
    }

    return others;
  }

  /**
   * Check if milestone completion is safe (no other active workstreams).
   * Returns { safe, others } where others is the list of active workstreams.
   */
  checkMilestoneCollision(currentName) {
    const others = this.getOtherActiveWorkstreams(currentName);
    return {
      safe: others.length === 0,
      others,
      message: others.length > 0
        ? `Other workstreams still active: ${others.map(o => o.name).join(', ')}. Complete them first or force with --force.`
        : 'No collisions. Safe to complete milestone.'
    };
  }

  /**
   * Add cross-area dependency
   */
  addDependency(workstreamName, dependsOn) {
    const workstreamPath = path.join(this.workstreamsDir, workstreamName);
    if (!fs.existsSync(workstreamPath)) {
      throw new Error(`Workstream '${workstreamName}' does not exist.`);
    }

    const configPath = path.join(workstreamPath, 'config.json');
    let config = {};
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }

    if (!config.dependencies) {
      config.dependencies = [];
    }

    if (!config.dependencies.includes(dependsOn)) {
      config.dependencies.push(dependsOn);
    }

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    return { workstream: workstreamName, dependsOn };
  }

  /**
   * Get cross-area dependencies
   */
  getCrossAreaDependencies() {
    const workstreams = this.list();
    const dependencies = [];

    for (const ws of workstreams) {
      const configPath = path.join(ws.path, 'config.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.dependencies && config.dependencies.length > 0) {
          for (const dep of config.dependencies) {
            dependencies.push({
              from: ws.name,
              to: dep,
              area: ws.state?.area || ws.name
            });
          }
        }
      }
    }

    return dependencies;
  }

  /**
   * Check if workstream can start (no unmet dependencies)
   */
  canStart(name) {
    const workstreamPath = path.join(this.workstreamsDir, name);
    if (!fs.existsSync(workstreamPath)) {
      throw new Error(`Workstream '${name}' does not exist.`);
    }

    const configPath = path.join(workstreamPath, 'config.json');
    if (!fs.existsSync(configPath)) {
      return { canStart: true, blockers: [] };
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (!config.dependencies || config.dependencies.length === 0) {
      return { canStart: true, blockers: [] };
    }

    const blockers = [];
    for (const dep of config.dependencies) {
      const depPath = path.join(this.workstreamsDir, dep);
      if (!fs.existsSync(depPath)) {
        blockers.push({ dependency: dep, reason: 'workstream does not exist' });
        continue;
      }

      const depStatePath = path.join(depPath, STATE_FILE);
      if (fs.existsSync(depStatePath)) {
        const depState = this.parseState(depStatePath);
        if (depState.phase !== 'done' && depState.phase !== 'complete') {
          blockers.push({ dependency: dep, reason: `not complete (phase: ${depState.phase})` });
        }
      }
    }

    return {
      canStart: blockers.length === 0,
      blockers
    };
  }

  /**
   * Parse STATE.md file
   */
  parseState(statePath) {
    const content = fs.readFileSync(statePath, 'utf8');
    const state = {};

    // Parse current phase
    const phaseMatch = content.match(/- Phase: (.+)/);
    if (phaseMatch) {
      state.phase = phaseMatch[1].trim();
    }

    const areaMatch = content.match(/- Area: (.+)/);
    if (areaMatch) {
      state.area = areaMatch[1].trim();
    }

    const startedMatch = content.match(/- Started: (.+)/);
    if (startedMatch) {
      state.started = startedMatch[1].trim();
    }

    // Parse tasks table
    const tasksMatch = content.match(/\| Task \| Status \|[\s\S]*?\n([\s\S]*?)(?=\n##|\n$)/);
    if (tasksMatch) {
      const rows = tasksMatch[1].trim().split('\n');
      state.tasks = rows.map(row => {
        const cols = row.split('|').map(c => c.trim());
        return {
          task: cols[1],
          status: cols[2],
          commits: cols[3],
          notes: cols[4]
        };
      }).filter(t => t.task && !t.task.startsWith('-'));
    }

    return state;
  }

  /**
   * Generate cross-area execution plan
   */
  generateExecutionPlan() {
    const workstreams = this.list();
    const dependencies = this.getCrossAreaDependencies();

    // Build dependency graph
    const graph = {};
    for (const ws of workstreams) {
      graph[ws.name] = [];
    }

    for (const dep of dependencies) {
      if (graph[dep.from]) {
        graph[dep.from].push(dep.to);
      }
    }

    // Topological sort for execution order
    const visited = new Set();
    const order = [];

    const visit = (name) => {
      if (visited.has(name)) return;
      visited.add(name);

      if (graph[name]) {
        for (const dep of graph[name]) {
          visit(dep);
        }
      }

      order.push(name);
    };

    for (const ws of workstreams) {
      visit(ws.name);
    }

    // Group into waves (parallel execution)
    const waves = [];
    const inDegree = {};

    for (const ws of workstreams) {
      inDegree[ws.name] = 0;
    }

    for (const dep of dependencies) {
      if (inDegree[dep.from] !== undefined) {
        inDegree[dep.from]++;
      }
    }

    // Find nodes with no incoming edges (can start immediately)
    const startable = workstreams.filter(ws => inDegree[ws.name] === 0);
    if (startable.length > 0) {
      waves.push(startable.map(ws => ws.name));
    }

    // Process remaining nodes
    const remaining = workstreams.filter(ws => inDegree[ws.name] > 0);
    while (remaining.length > 0) {
      const wave = remaining.filter(ws => {
        const deps = graph[ws.name] || [];
        return deps.every(d => !remaining.some(r => r.name === d));
      });

      if (wave.length === 0) {
        // Circular dependency or all remaining have dependencies
        waves.push(remaining.map(ws => ws.name));
        break;
      }

      waves.push(wave.map(ws => ws.name));

      for (const ws of wave) {
        const idx = remaining.indexOf(ws);
        if (idx > -1) {
          remaining.splice(idx, 1);
        }
      }
    }

    return {
      workstreams: workstreams.map(ws => ({
        name: ws.name,
        area: ws.state?.area || ws.name,
        phase: ws.state?.phase || 'unknown'
      })),
      dependencies,
      waves,
      executionOrder: order
    };
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  const name = args[1];

  const manager = new WorkstreamManager();

  try {
    switch (command) {
      case 'create':
        const area = args.includes('--area') ? args[args.indexOf('--area') + 1] : null;
        const result = manager.create(name, area);
        console.log(JSON.stringify(result, null, 2));
        break;

      case 'list':
        const workstreams = manager.list();
        console.log(JSON.stringify(workstreams, null, 2));
        break;

      case 'select':
        const selectResult = manager.select(name);
        console.log(JSON.stringify(selectResult, null, 2));
        break;

      case 'status':
        const statusResult = manager.status(name);
        console.log(JSON.stringify(statusResult, null, 2));
        break;

      case 'delete':
        const deleteResult = manager.delete(name);
        console.log(JSON.stringify(deleteResult, null, 2));
        break;

      case 'add-dependency':
        const dependsOn = args[2];
        const depResult = manager.addDependency(name, dependsOn);
        console.log(JSON.stringify(depResult, null, 2));
        break;

      case 'cross-area-dependencies':
        const deps = manager.getCrossAreaDependencies();
        console.log(JSON.stringify(deps, null, 2));
        break;

      case 'can-start':
        const canStartResult = manager.canStart(name);
        console.log(JSON.stringify(canStartResult, null, 2));
        break;

      case 'execution-plan':
        const plan = manager.generateExecutionPlan();
        console.log(JSON.stringify(plan, null, 2));
        break;

      case 'check-collision':
        const collisionResult = manager.checkMilestoneCollision(name);
        console.log(JSON.stringify(collisionResult, null, 2));
        process.exit(collisionResult.safe ? 0 : 1);
        break;

      case 'other-active':
        const others = manager.getOtherActiveWorkstreams(name || '');
        console.log(JSON.stringify(others, null, 2));
        break;

      case 'session':
        console.log(JSON.stringify({ sessionId: manager._getSessionId(), pointerPath: manager._sessionPointerPath() }, null, 2));
        break;

      default:
        console.error('Usage: node agent-skills-workstream.js <command> [args]');
        console.error('Commands: create, list, select, status, delete, add-dependency, cross-area-dependencies, can-start, execution-plan, check-collision, other-active, session');
        process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

module.exports = { WorkstreamManager };
