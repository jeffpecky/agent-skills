'use strict';
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

const { updateTaskStatus, getTaskStatus, getProgressSummary } = require('../../scripts/agent-skills-scheduler.js');

describe('Task Scheduler', () => {
  let tmpDir;
  let originalCwd;
  
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-skills-test-'));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
    
    // Create required directories
    fs.mkdirSync(path.join(tmpDir, 'tasks', 'progress'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'tasks', 'reports'), { recursive: true });
  });
  
  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
  
  describe('updateTaskStatus', () => {
    it('should create status file', () => {
      updateTaskStatus('task-1', 'running', null, tmpDir);
      const statusFile = path.join(tmpDir, 'tasks', 'progress', 'task-1.status');
      assert.ok(fs.existsSync(statusFile));
    });
    
    it('should write correct status', () => {
      updateTaskStatus('task-1', 'complete', null, tmpDir);
      const status = getTaskStatus('task-1', tmpDir);
      assert.equal(status.status, 'complete');
      assert.ok(status.updatedAt);
    });
    
    it('should include error when provided', () => {
      updateTaskStatus('task-1', 'failed', 'Test error', tmpDir);
      const status = getTaskStatus('task-1', tmpDir);
      assert.equal(status.error, 'Test error');
    });
  });
  
  describe('getTaskStatus', () => {
    it('should return pending for unknown task', () => {
      const status = getTaskStatus('unknown-task', tmpDir);
      assert.equal(status.status, 'pending');
    });
    
    it('should return stored status', () => {
      updateTaskStatus('task-1', 'running', null, tmpDir);
      const status = getTaskStatus('task-1', tmpDir);
      assert.equal(status.status, 'running');
    });
  });
  
  describe('getProgressSummary', () => {
    it('should count tasks by status', () => {
      updateTaskStatus('task-1', 'complete', null, tmpDir);
      updateTaskStatus('task-2', 'running', null, tmpDir);
      updateTaskStatus('task-3', 'failed', null, tmpDir);
      updateTaskStatus('task-4', 'complete', null, tmpDir);
      
      const summary = getProgressSummary(tmpDir);
      assert.equal(summary.summary.total, 4);
      assert.equal(summary.summary.complete, 2);
      assert.equal(summary.summary.running, 1);
      assert.equal(summary.summary.failed, 1);
    });
    
    it('should handle empty progress', () => {
      const summary = getProgressSummary(tmpDir);
      assert.equal(summary.summary.total, 0);
    });
  });
});
