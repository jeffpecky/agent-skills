'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

const { parsePlanTasks, parseFrontmatter, computeDependencyLevels, detectCycles, checkFileOverlap, computeWaves, validateDeclaredVsComputed, checkIntraWaveOverlap, checkWiring } = require('../../scripts/agent-skills-dependency.js');

describe('Dependency Resolver', () => {
  describe('parseFrontmatter', () => {
    it('should parse YAML frontmatter with arrays', () => {
      const content = `---
id: task-1
wave: 1
depends_on: []
files_modified:
  - src/a.ts
  - src/b.ts
autonomous: true
---
### Task 1: Test`;
      const fm = parseFrontmatter(content);
      assert.equal(fm.id, 'task-1');
      assert.equal(fm.wave, 1);
      assert.deepEqual(fm.depends_on, []);
      assert.deepEqual(fm.files_modified, ['src/a.ts', 'src/b.ts']);
      assert.equal(fm.autonomous, true);
    });

    it('should parse frontmatter with dependencies', () => {
      const content = `---
id: task-2
wave: 2
depends_on: [task-1, task-3]
files_modified: ["src/c.ts"]
autonomous: false
---
### Task 2: Test`;
      const fm = parseFrontmatter(content);
      assert.equal(fm.id, 'task-2');
      assert.equal(fm.wave, 2);
      assert.deepEqual(fm.depends_on, ['task-1', 'task-3']);
      assert.equal(fm.autonomous, false);
    });

    it('should return null for content without frontmatter', () => {
      const fm = parseFrontmatter('### Task 1: No frontmatter');
      assert.equal(fm, null);
    });
  });

  describe('parsePlanTasks', () => {
    it('should parse tasks from plan markdown with frontmatter', () => {
      const plan = `---
id: task-1
wave: 1
depends_on: []
files_modified:
  - src/schema.sql
autonomous: true
---
### Task 1: Database Schema

---
id: task-2
wave: 2
depends_on: [task-1]
files_modified:
  - src/models/user.ts
autonomous: true
---
### Task 2: API Models`;
      const tasks = parsePlanTasks(plan);
      assert.equal(tasks.length, 2);
      assert.equal(tasks[0].id, 'task-1');
      assert.equal(tasks[0].wave, 1);
      assert.deepEqual(tasks[0].deps, []);
      assert.equal(tasks[1].id, 'task-2');
      assert.equal(tasks[1].wave, 2);
      assert.deepEqual(tasks[1].deps, ['task-1']);
    });

    it('should parse tasks from old format (no frontmatter)', () => {
      const plan = `
### Task 1: Database Schema
**Dependencies:** None
**Files:**
- src/schema.sql

### Task 2: API Models
**Dependencies:** Task 1
**Files:**
- src/models/user.ts`;
      const tasks = parsePlanTasks(plan);
      assert.equal(tasks.length, 2);
      assert.equal(tasks[0].id, 'Database Schema');
      assert.deepEqual(tasks[0].deps, []);
    });
  });

  describe('validateDeclaredVsComputed', () => {
    it('should detect wave mismatches', () => {
      const tasks = [
        { id: 'a', wave: 3, deps: [], files: [] },  // declared 3, computed 1
        { id: 'b', wave: 1, deps: ['a'], files: [] }, // declared 1, computed 2
      ];
      const mismatches = validateDeclaredVsComputed(tasks);
      assert.equal(mismatches.length, 2);
      assert.equal(mismatches[0].declared, 3);
      assert.equal(mismatches[0].computed, 1);
    });

    it('should pass when waves are correct', () => {
      const tasks = [
        { id: 'a', wave: 1, deps: [], files: [] },
        { id: 'b', wave: 2, deps: ['a'], files: [] },
      ];
      const mismatches = validateDeclaredVsComputed(tasks);
      assert.equal(mismatches.length, 0);
    });

    it('should skip tasks without declared waves', () => {
      const tasks = [
        { id: 'a', wave: null, deps: [], files: [] },
        { id: 'b', wave: null, deps: ['a'], files: [] },
      ];
      const mismatches = validateDeclaredVsComputed(tasks);
      assert.equal(mismatches.length, 0);
    });
  });

  describe('checkIntraWaveOverlap', () => {
    it('should detect file overlap within same wave', () => {
      const tasks = [
        { id: 'a', wave: 1, deps: [], files: ['src/shared.ts'] },
        { id: 'b', wave: 1, deps: [], files: ['src/shared.ts'] },
      ];
      const issues = checkIntraWaveOverlap(tasks);
      assert.equal(issues.length, 1);
      assert.equal(issues[0].wave, 1);
    });

    it('should pass when no overlap within waves', () => {
      const tasks = [
        { id: 'a', wave: 1, deps: [], files: ['src/a.ts'] },
        { id: 'b', wave: 1, deps: [], files: ['src/b.ts'] },
      ];
      const issues = checkIntraWaveOverlap(tasks);
      assert.equal(issues.length, 0);
    });
  });

  describe('checkWiring', () => {
    it('should detect missing dependencies', () => {
      const tasks = [
        { id: 'a', wave: 1, deps: ['nonexistent'], files: [] },
      ];
      const issues = checkWiring(tasks);
      assert.equal(issues.length, 1);
      assert.equal(issues[0].missing_dependency, 'nonexistent');
    });

    it('should pass with valid dependencies', () => {
      const tasks = [
        { id: 'a', wave: 1, deps: [], files: [] },
        { id: 'b', wave: 2, deps: ['a'], files: [] },
      ];
      const issues = checkWiring(tasks);
      assert.equal(issues.length, 0);
    });
  });

  describe('computeDependencyLevels', () => {
    it('should compute correct levels for linear chain', () => {
      const tasks = [
        { id: 'a', deps: [], files: [] },
        { id: 'b', deps: ['a'], files: [] },
        { id: 'c', deps: ['b'], files: [] },
      ];
      const levels = computeDependencyLevels(tasks);
      assert.equal(levels.get('a'), 1);
      assert.equal(levels.get('b'), 2);
      assert.equal(levels.get('c'), 3);
    });

    it('should compute correct levels for diamond', () => {
      const tasks = [
        { id: 'a', deps: [], files: [] },
        { id: 'b', deps: ['a'], files: [] },
        { id: 'c', deps: ['a'], files: [] },
        { id: 'd', deps: ['b', 'c'], files: [] },
      ];
      const levels = computeDependencyLevels(tasks);
      assert.equal(levels.get('a'), 1);
      assert.equal(levels.get('b'), 2);
      assert.equal(levels.get('c'), 2);
      assert.equal(levels.get('d'), 3);
    });

    it('should handle tasks with no dependencies', () => {
      const tasks = [
        { id: 'a', deps: [], files: [] },
        { id: 'b', deps: [], files: [] },
        { id: 'c', deps: [], files: [] },
      ];
      const levels = computeDependencyLevels(tasks);
      assert.equal(levels.get('a'), 1);
      assert.equal(levels.get('b'), 1);
      assert.equal(levels.get('c'), 1);
    });
  });

  describe('detectCycles', () => {
    it('should detect simple cycle', () => {
      const tasks = [
        { id: 'a', deps: ['b'], files: [] },
        { id: 'b', deps: ['a'], files: [] },
      ];
      const cycles = detectCycles(tasks);
      assert.equal(cycles.length > 0, true);
    });

    it('should detect no cycles in valid graph', () => {
      const tasks = [
        { id: 'a', deps: [], files: [] },
        { id: 'b', deps: ['a'], files: [] },
        { id: 'c', deps: ['b'], files: [] },
      ];
      const cycles = detectCycles(tasks);
      assert.equal(cycles.length, 0);
    });
  });

  describe('checkFileOverlap', () => {
    it('should detect file overlap', () => {
      const tasks = [
        { id: 'a', deps: [], files: ['src/shared.ts'] },
        { id: 'b', deps: [], files: ['src/shared.ts'] },
      ];
      const overlaps = checkFileOverlap(tasks);
      assert.equal(overlaps.length, 1);
      assert.equal(overlaps[0].file, 'src/shared.ts');
    });

    it('should detect no overlap', () => {
      const tasks = [
        { id: 'a', deps: [], files: ['src/a.ts'] },
        { id: 'b', deps: [], files: ['src/b.ts'] },
      ];
      const overlaps = checkFileOverlap(tasks);
      assert.equal(overlaps.length, 0);
    });
  });

  describe('computeWaves', () => {
    it('should group tasks into waves', () => {
      const tasks = [
        { id: 'a', deps: [], files: [] },
        { id: 'b', deps: [], files: [] },
        { id: 'c', deps: ['a'], files: [] },
        { id: 'd', deps: ['a', 'b'], files: [] },
      ];
      const waves = computeWaves(tasks);
      assert.deepEqual(waves[1], ['a', 'b']);
      assert.deepEqual(waves[2], ['c', 'd']);
    });
  });
});
