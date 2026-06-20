#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

/**
 * File locker for agent-skills.
 * Single-file O_EXCL-based atomic locking with stale lock detection.
 * Multi-file batch locking for atomic read-modify-write across files.
 */

const USAGE = `
Usage: node agent-skills-lock.js <command> [options]

Commands:
  acquire <file>              Acquire lock for file
  release <file>              Release lock for file
  check <file>                Check if lock exists
  clean <file>                Clean stale locks
  batch-acquire <dir> <f1,f2> Acquire batch lock covering multiple files
  batch-release <dir>         Release batch lock
  batch-check <dir>           Check if batch lock exists
`;

const LOCK_SUFFIX = '.lock';
const STALE_THRESHOLD_MS = 10000; // 10 seconds
const MAX_WAIT_MS = 30000; // 30 seconds
const RETRY_DELAY_MS = 200;

function getLockPath(filePath) {
  return filePath + LOCK_SUFFIX;
}

function isStale(lockPath) {
  try {
    const stat = fs.statSync(lockPath);
    const age = Date.now() - stat.mtimeMs;
    return age > STALE_THRESHOLD_MS;
  } catch {
    return false;
  }
}

function acquireLock(filePath, options = {}) {
  const lockPath = getLockPath(filePath);
  const startTime = Date.now();
  const maxWait = options.maxWaitMs || MAX_WAIT_MS;
  
  while (true) {
    try {
      // Try to create lock file atomically
      const fd = fs.openSync(lockPath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY);
      fs.writeSync(fd, String(process.pid));
      fs.closeSync(fd);
      return { success: true, lockPath };
    } catch (err) {
      if (err.code !== 'EEXIST') {
        throw err;
      }
      
      // Lock exists, check if stale
      if (isStale(lockPath)) {
        try {
          fs.unlinkSync(lockPath);
          // Retry immediately after removing stale lock
          continue;
        } catch {
          // Removal failed, continue to wait
        }
      }
      
      // Check budget
      const elapsed = Date.now() - startTime;
      if (elapsed >= maxWait) {
        return { 
          success: false, 
          error: 'Lock budget exceeded',
          lockBudgetExceeded: true 
        };
      }
      
      // Wait with jitter
      const jitter = Math.random() * 50;
      const delay = RETRY_DELAY_MS + jitter;
      const remaining = maxWait - elapsed;
      const sleepMs = Math.min(delay, remaining);
      
      // Busy wait (could use setTimeout in async version)
      const end = Date.now() + sleepMs;
      while (Date.now() < end) {
        // busy wait
      }
    }
  }
}

function releaseLock(filePath) {
  const lockPath = getLockPath(filePath);
  try {
    fs.unlinkSync(lockPath);
    return { success: true };
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { success: true, alreadyReleased: true };
    }
    return { success: false, error: err.message };
  }
}

function checkLock(filePath) {
  const lockPath = getLockPath(filePath);
  try {
    const stat = fs.statSync(lockPath);
    const content = fs.readFileSync(lockPath, 'utf-8');
    return {
      exists: true,
      pid: content.trim(),
      age: Date.now() - stat.mtimeMs,
      stale: isStale(lockPath)
    };
  } catch {
    return { exists: false };
  }
}

function cleanStaleLocks(directory) {
  const cleaned = [];
  
  try {
    const files = fs.readdirSync(directory);
    for (const file of files) {
      if (file.endsWith(LOCK_SUFFIX)) {
        const lockPath = path.join(directory, file);
        if (isStale(lockPath)) {
          try {
            fs.unlinkSync(lockPath);
            cleaned.push(file);
          } catch {
            // Skip files we can't remove
          }
        }
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }
  
  return cleaned;
}

/**
 * Batch lock: acquires a single meta-lock that covers multiple files.
 * Prevents any session from reading partially-updated state across files.
 * 
 * Usage:
 *   const batch = acquireBatchLock('/path/to/project', ['config.json', 'STATE.md']);
 *   if (batch.success) {
 *     // safe to read-modify-write config.json and STATE.md
 *     releaseBatchLock('/path/to/project');
 *   }
 */
function acquireBatchLock(dir, files, options = {}) {
  const metaLockPath = path.join(dir, '.batch.lock');
  const startTime = Date.now();
  const maxWait = options.maxWaitMs || MAX_WAIT_MS;
  const metadata = JSON.stringify({ files, pid: process.pid, ts: Date.now() });

  while (true) {
    try {
      const fd = fs.openSync(metaLockPath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY);
      fs.writeSync(fd, metadata);
      fs.closeSync(fd);
      return { success: true, lockPath: metaLockPath, files };
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;

      if (isStale(metaLockPath)) {
        try { fs.unlinkSync(metaLockPath); continue; } catch {}
      }

      const elapsed = Date.now() - startTime;
      if (elapsed >= maxWait) {
        return { success: false, error: 'Batch lock budget exceeded', lockBudgetExceeded: true };
      }

      const jitter = Math.random() * 50;
      const sleepMs = Math.min(RETRY_DELAY_MS + jitter, maxWait - elapsed);
      const end = Date.now() + sleepMs;
      while (Date.now() < end) {}
    }
  }
}

function releaseBatchLock(dir) {
  const metaLockPath = path.join(dir, '.batch.lock');
  try {
    fs.unlinkSync(metaLockPath);
    return { success: true };
  } catch (err) {
    if (err.code === 'ENOENT') return { success: true, alreadyReleased: true };
    return { success: false, error: err.message };
  }
}

function checkBatchLock(dir) {
  const metaLockPath = path.join(dir, '.batch.lock');
  try {
    const stat = fs.statSync(metaLockPath);
    const content = JSON.parse(fs.readFileSync(metaLockPath, 'utf-8'));
    return {
      exists: true,
      pid: content.pid,
      files: content.files,
      age: Date.now() - stat.mtimeMs,
      stale: isStale(metaLockPath)
    };
  } catch {
    return { exists: false };
  }
}

/**
 * withBatchLock: wraps a multi-file read-modify-write in a batch lock.
 * Acquires lock, runs callback, releases lock (even on error).
 * 
 * Example:
 *   await withBatchLock(dir, ['config.json', 'STATE.md'], () => {
 *     const config = readFileSync('config.json');
 *     const state = readFileSync('STATE.md');
 *     // modify both...
 *     writeFileSync('config.json', newConfig);
 *     writeFileSync('STATE.md', newState);
 *   });
 */
function withBatchLock(dir, files, fn) {
  const lock = acquireBatchLock(dir, files);
  if (!lock.success) {
    throw new Error(`Batch lock failed: ${lock.error}`);
  }
  try {
    const result = fn();
    return { success: true, result };
  } catch (err) {
    return { success: false, error: err.message, thrown: err };
  } finally {
    releaseBatchLock(dir);
  }
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const filePath = args[1];
  
  if (!command) {
    console.log(USAGE);
    process.exit(1);
  }
  
  switch (command) {
    case 'acquire': {
      if (!filePath) {
        console.error('Error: file path required');
        process.exit(1);
      }
      const result = acquireLock(filePath);
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    }
    
    case 'release': {
      if (!filePath) {
        console.error('Error: file path required');
        process.exit(1);
      }
      const result = releaseLock(filePath);
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    }
    
    case 'check': {
      if (!filePath) {
        console.error('Error: file path required');
        process.exit(1);
      }
      const result = checkLock(filePath);
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    
    case 'clean': {
      const dir = filePath || process.cwd();
      const cleaned = cleanStaleLocks(dir);
      console.log(JSON.stringify({ cleaned, count: cleaned.length }, null, 2));
      break;
    }

    case 'batch-acquire': {
      const dir = filePath;
      const files = (args[2] || '').split(',').filter(Boolean);
      if (!dir || !files.length) {
        console.error('Error: directory and file list required');
        console.error('Usage: batch-acquire <dir> <file1,file2,...>');
        process.exit(1);
      }
      const result = acquireBatchLock(dir, files);
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    }

    case 'batch-release': {
      if (!filePath) {
        console.error('Error: directory required');
        process.exit(1);
      }
      const result = releaseBatchLock(filePath);
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    }

    case 'batch-check': {
      if (!filePath) {
        console.error('Error: directory required');
        process.exit(1);
      }
      const result = checkBatchLock(filePath);
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    
    default:
      console.error(`Unknown command: ${command}`);
      console.log(USAGE);
      process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { acquireLock, releaseLock, checkLock, cleanStaleLocks, acquireBatchLock, releaseBatchLock, checkBatchLock, withBatchLock };
