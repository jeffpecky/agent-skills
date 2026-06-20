'use strict';
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

const { acquireLock, releaseLock, checkLock, cleanStaleLocks, acquireBatchLock, releaseBatchLock, checkBatchLock, withBatchLock } = require('../../scripts/agent-skills-lock.js');

describe('File Locker', () => {
  let tmpDir;
  let testFile;
  
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-skills-test-'));
    testFile = path.join(tmpDir, 'STATE.md');
    fs.writeFileSync(testFile, 'test content');
  });
  
  afterEach(() => {
    // Clean up any locks
    try {
      releaseLock(testFile);
    } catch {}
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
  
  describe('acquireLock', () => {
    it('should acquire lock successfully', () => {
      const result = acquireLock(testFile);
      assert.equal(result.success, true);
      assert.ok(result.lockPath);
    });
    
    it('should create lock file', () => {
      acquireLock(testFile);
      const lockPath = testFile + '.lock';
      assert.ok(fs.existsSync(lockPath));
    });
    
    it('should record PID in lock file', () => {
      acquireLock(testFile);
      const lockPath = testFile + '.lock';
      const content = fs.readFileSync(lockPath, 'utf-8');
      assert.equal(content.trim(), String(process.pid));
    });
    
    it('should fail when lock already exists', () => {
      acquireLock(testFile);
      const result = acquireLock(testFile, { maxWaitMs: 500 });
      assert.equal(result.success, false);
      assert.ok(result.lockBudgetExceeded);
    });
  });
  
  describe('releaseLock', () => {
    it('should release lock successfully', () => {
      acquireLock(testFile);
      const result = releaseLock(testFile);
      assert.equal(result.success, true);
    });
    
    it('should remove lock file', () => {
      acquireLock(testFile);
      releaseLock(testFile);
      const lockPath = testFile + '.lock';
      assert.ok(!fs.existsSync(lockPath));
    });
    
    it('should handle already released lock', () => {
      const result = releaseLock(testFile);
      assert.equal(result.success, true);
      assert.equal(result.alreadyReleased, true);
    });
  });
  
  describe('checkLock', () => {
    it('should detect no lock', () => {
      const result = checkLock(testFile);
      assert.equal(result.exists, false);
    });
    
    it('should detect existing lock', () => {
      acquireLock(testFile);
      const result = checkLock(testFile);
      assert.equal(result.exists, true);
      assert.equal(result.pid, String(process.pid));
      assert.equal(typeof result.age, 'number');
    });
  });
  
  describe('cleanStaleLocks', () => {
    it('should clean stale locks', () => {
      // Create a stale lock (older than threshold)
      const lockPath = testFile + '.lock';
      fs.writeFileSync(lockPath, '12345');
      
      // Modify mtime to be old
      const oldTime = Date.now() - 15000; // 15 seconds ago
      fs.utimesSync(lockPath, oldTime / 1000, oldTime / 1000);
      
      const cleaned = cleanStaleLocks(tmpDir);
      assert.equal(cleaned.length, 1);
      assert.ok(!fs.existsSync(lockPath));
    });
    
    it('should not clean fresh locks', () => {
      acquireLock(testFile);
      const cleaned = cleanStaleLocks(tmpDir);
      assert.equal(cleaned.length, 0);
      assert.ok(fs.existsSync(testFile + '.lock'));
    });
  });
  
  describe('Batch Lock', () => {
    let file1, file2;
    
    beforeEach(() => {
      file1 = path.join(tmpDir, 'config.json');
      file2 = path.join(tmpDir, 'STATE.md');
      fs.writeFileSync(file1, '{}');
      fs.writeFileSync(file2, 'state');
    });
    
    afterEach(() => {
      releaseBatchLock(tmpDir);
    });
    
    it('should acquire batch lock', () => {
      const result = acquireBatchLock(tmpDir, ['config.json', 'STATE.md']);
      assert.equal(result.success, true);
      assert.ok(Array.isArray(result.files));
      assert.equal(result.files.length, 2);
    });
    
    it('should create .batch.lock file', () => {
      acquireBatchLock(tmpDir, ['config.json']);
      assert.ok(fs.existsSync(path.join(tmpDir, '.batch.lock')));
    });
    
    it('should record metadata in batch lock', () => {
      acquireBatchLock(tmpDir, ['config.json', 'STATE.md']);
      const content = JSON.parse(fs.readFileSync(path.join(tmpDir, '.batch.lock'), 'utf-8'));
      assert.equal(content.pid, process.pid);
      assert.deepEqual(content.files, ['config.json', 'STATE.md']);
      assert.ok(typeof content.ts === 'number');
    });
    
    it('should fail when batch lock already exists', () => {
      acquireBatchLock(tmpDir, ['config.json']);
      const result = acquireBatchLock(tmpDir, ['STATE.md'], { maxWaitMs: 500 });
      assert.equal(result.success, false);
      assert.ok(result.lockBudgetExceeded);
    });
    
    it('should release batch lock', () => {
      acquireBatchLock(tmpDir, ['config.json']);
      const result = releaseBatchLock(tmpDir);
      assert.equal(result.success, true);
      assert.ok(!fs.existsSync(path.join(tmpDir, '.batch.lock')));
    });
    
    it('should handle already released batch lock', () => {
      const result = releaseBatchLock(tmpDir);
      assert.equal(result.success, true);
      assert.equal(result.alreadyReleased, true);
    });
    
    it('should check batch lock status', () => {
      const before = checkBatchLock(tmpDir);
      assert.equal(before.exists, false);
      
      acquireBatchLock(tmpDir, ['config.json', 'STATE.md']);
      const after = checkBatchLock(tmpDir);
      assert.equal(after.exists, true);
      assert.equal(after.pid, process.pid);
      assert.deepEqual(after.files, ['config.json', 'STATE.md']);
      assert.equal(typeof after.age, 'number');
    });
    
    it('should withBatchLock run callback and release', () => {
      let callbackRan = false;
      const result = withBatchLock(tmpDir, ['config.json'], () => {
        callbackRan = true;
        return 'done';
      });
      assert.equal(result.success, true);
      assert.equal(result.result, 'done');
      assert.ok(callbackRan);
      assert.ok(!fs.existsSync(path.join(tmpDir, '.batch.lock')));
    });
    
    it('should withBatchLock release on error', () => {
      const result = withBatchLock(tmpDir, ['config.json'], () => {
        throw new Error('test error');
      });
      assert.equal(result.success, false);
      assert.ok(result.error.includes('test error'));
      assert.ok(!fs.existsSync(path.join(tmpDir, '.batch.lock')));
    });
  });
});
