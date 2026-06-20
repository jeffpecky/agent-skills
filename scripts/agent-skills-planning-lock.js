#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { acquireLock, releaseLock } = require('./agent-skills-lock.js');

/**
 * Planning lock for multi-file atomic operations.
 * Wraps read-modify-write cycles in a single lock acquisition.
 *
 * Usage:
 *   const { withPlanningLock } = require('./agent-skills-planning-lock.js');
 *   await withPlanningLock(projectDir, async (ctx) => {
 *     const state = ctx.read('STATE.md');
 *     ctx.write('STATE.md', state.replace('build', 'verify'));
 *     ctx.write('progress.md', updatedProgress);
 *   });
 */

const LOCK_SUFFIX = '.planning.lock';
const STALE_THRESHOLD_MS = 30000; // 30 seconds

/**
 * Get all files that participate in planning state
 */
function getPlanningFiles(projectDir) {
  const tasksDir = path.join(projectDir, 'tasks');
  return [
    path.join(tasksDir, 'STATE.md'),
    path.join(tasksDir, 'progress.md'),
    path.join(tasksDir, 'plan.md'),
    path.join(tasksDir, 'trace.jsonl'),
  ];
}

/**
 * Create a planning context that reads/writes within a locked section
 */
function createPlanningContext(projectDir) {
  const tasksDir = path.join(projectDir, 'tasks');

  return {
    read(filename) {
      const filePath = path.join(tasksDir, filename);
      if (!fs.existsSync(filePath)) return null;
      return fs.readFileSync(filePath, 'utf-8');
    },

    write(filename, content) {
      const filePath = path.join(tasksDir, filename);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content, 'utf-8');
    },

    exists(filename) {
      const filePath = path.join(tasksDir, filename);
      return fs.existsSync(filePath);
    },

    readJson(filename) {
      const content = this.read(filename);
      if (!content) return null;
      try { return JSON.parse(content); } catch { return null; }
    },

    writeJson(filename, data) {
      this.write(filename, JSON.stringify(data, null, 2));
    }
  };
}

/**
 * Execute a function within a planning lock.
 * Ensures only one process can modify planning state at a time.
 */
async function withPlanningLock(projectDir, fn) {
  const lockFile = path.join(projectDir, 'tasks', 'STATE.md' + LOCK_SUFFIX);

  // Ensure tasks directory exists
  fs.mkdirSync(path.join(projectDir, 'tasks'), { recursive: true });

  const lockResult = acquireLock(lockFile, { maxWaitMs: 15000 });
  if (!lockResult.success) {
    throw new Error(`Could not acquire planning lock: ${lockResult.error}`);
  }

  try {
    const ctx = createPlanningContext(projectDir);
    return await fn(ctx);
  } finally {
    releaseLock(lockFile);
  }
}

/**
 * Synchronous version for simpler operations
 */
function withPlanningLockSync(projectDir, fn) {
  const lockFile = path.join(projectDir, 'tasks', 'STATE.md' + LOCK_SUFFIX);

  fs.mkdirSync(path.join(projectDir, 'tasks'), { recursive: true });

  const lockResult = acquireLock(lockFile, { maxWaitMs: 15000 });
  if (!lockResult.success) {
    throw new Error(`Could not acquire planning lock: ${lockResult.error}`);
  }

  try {
    const ctx = createPlanningContext(projectDir);
    return fn(ctx);
  } finally {
    releaseLock(lockFile);
  }
}

module.exports = {
  withPlanningLock,
  withPlanningLockSync,
  createPlanningContext,
  getPlanningFiles
};
