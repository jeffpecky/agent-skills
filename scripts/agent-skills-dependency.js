#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Dependency resolver for agent-skills tasks.
 * Implements topological sort (Kahn's algorithm) for wave computation.
 * Validates declared waves against computed waves (gsd-core compatible).
 */

const USAGE = `
Usage: node agent-skills-dependency.js <command> [options]

Commands:
  compute-waves <plan.md>      Compute wave assignments from plan
  detect-cycles <plan.md>      Detect dependency cycles
  check-overlap <plan.md>      Check files_modified overlap
  validate <plan.md>           Full validation (cycles + overlap + waves + declared vs computed)
  group-by-area <plan.md>      Group tasks by area (backend, frontend, infra)
  compute-area-waves <plan.md> Compute waves per area
  intra-wave-overlap <plan.md> Check file overlap within each wave (safety net)
  check-wiring <plan.md>       Cross-wave wiring check (dependencies satisfied)
`;

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const yaml = match[1];
  const result = {};
  let currentKey = null;
  let currentArray = null;

  for (const line of yaml.split('\n')) {
    // Check for block-style array item
    const arrayItem = line.match(/^\s+-\s+(.+)$/);
    if (arrayItem && currentKey && currentArray) {
      currentArray.push(arrayItem[1].trim());
      continue;
    }

    // If we were building an array and hit a non-array line, finalize it
    if (currentArray) {
      result[currentKey] = currentArray;
      currentArray = null;
      currentKey = null;
    }

    // Check for key: value
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) {
      const key = kv[1];
      let value = kv[2].trim();

      // Empty value = start of block-style array
      if (value === '') {
        currentKey = key;
        currentArray = [];
        continue;
      }

      // Parse inline arrays
      if (value.startsWith('[')) {
        try {
          value = JSON.parse(value);
        } catch {
          value = value.slice(1, -1).split(',').map(s => s.trim().replace(/"/g, ''));
        }
      }
      // Parse booleans
      else if (value === 'true') value = true;
      else if (value === 'false') value = false;
      // Parse numbers
      else if (/^\d+$/.test(value)) value = parseInt(value, 10);

      result[key] = value;
    }
  }

  // Finalize any trailing array
  if (currentArray) {
    result[currentKey] = currentArray;
  }

  return result;
}

function parsePlanTasks(planContent) {
  const tasks = [];

  // Find all frontmatter blocks and combine with following content
  const fmRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*?)(?=^---\n|$)/gm;
  let match;

  while ((match = fmRegex.exec(planContent)) !== null) {
    const fmContent = match[1];
    const afterFm = match[2];

    // Parse frontmatter
    const fm = {};
    let currentKey = null;
    let currentArray = null;

    for (const line of fmContent.split('\n')) {
      const arrayItem = line.match(/^\s+-\s+(.+)$/);
      if (arrayItem && currentKey && currentArray) {
        currentArray.push(arrayItem[1].trim());
        continue;
      }

      if (currentArray) {
        fm[currentKey] = currentArray;
        currentArray = null;
        currentKey = null;
      }

      const kv = line.match(/^(\w+):\s*(.*)$/);
      if (kv) {
        const key = kv[1];
        let value = kv[2].trim();

        if (value === '') {
          currentKey = key;
          currentArray = [];
          continue;
        }

        if (value.startsWith('[')) {
          try { value = JSON.parse(value); } catch {
            value = value.slice(1, -1).split(',').map(s => s.trim().replace(/"/g, ''));
          }
        } else if (value === 'true') value = true;
        else if (value === 'false') value = false;
        else if (/^\d+$/.test(value)) value = parseInt(value, 10);

        fm[key] = value;
      }
    }

    if (currentArray) fm[currentKey] = currentArray;

    if (!fm.id) continue;

    // Extract title from content after frontmatter
    const titleMatch = afterFm.match(/^###\s+(.+?)(?:\n|$)/m);

    tasks.push({
      id: fm.id,
      wave: fm.wave || null,
      deps: Array.isArray(fm.depends_on) ? fm.depends_on : [],
      files: Array.isArray(fm.files_modified) ? fm.files_modified : [],
      area: fm.area || null,
      skill: fm.skill || null,
      autonomous: fm.autonomous !== false,
      title: titleMatch ? titleMatch[1].trim() : fm.id
    });
  }

  // Fallback: parse old format if no frontmatter tasks found
  if (tasks.length === 0) {
    const taskBlocks = planContent.split(/### Task \d+:/);
    for (let i = 1; i < taskBlocks.length; i++) {
      const block = taskBlocks[i];
      const idMatch = block.match(/^(.+?)(?:\n|$)/);
      const id = idMatch ? idMatch[1].trim() : `task-${i}`;

      const depsMatch = block.match(/\*\*Dependencies:\*\*\s*(.+?)(?:\n|$)/);
      const deps = depsMatch
        ? depsMatch[1].split(',').map(d => d.trim()).filter(d => d && d !== 'None')
        : [];

      const filesMatch = block.match(/\*\*Files:\*\*\s*\n((?:- .+\n)+)/);
      const files = filesMatch
        ? filesMatch[1].split('\n').filter(l => l.startsWith('- ')).map(l => l.slice(2).trim())
        : [];

      const areaMatch = block.match(/\*\*Area:\*\*\s*(.+?)(?:\n|$)/);
      const area = areaMatch ? areaMatch[1].trim() : null;

      tasks.push({ id, wave: null, deps, files, area, skill: null, autonomous: true, title: id });
    }
  }

  return tasks;
}

function computeDependencyLevels(tasks) {
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const levels = new Map();
  const visited = new Set();

  function getLevel(taskId) {
    if (levels.has(taskId)) return levels.get(taskId);
    if (visited.has(taskId)) return -1; // Cycle detected

    visited.add(taskId);
    const task = taskMap.get(taskId);

    if (!task || task.deps.length === 0) {
      levels.set(taskId, 1);
      return 1;
    }

    let maxDepLevel = 0;
    for (const dep of task.deps) {
      const depLevel = getLevel(dep);
      if (depLevel === -1) return -1; // Cycle
      maxDepLevel = Math.max(maxDepLevel, depLevel);
    }

    const level = maxDepLevel + 1;
    levels.set(taskId, level);
    return level;
  }

  for (const task of tasks) {
    getLevel(task.id);
  }

  return levels;
}

function detectCycles(tasks) {
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const visited = new Set();
  const inStack = new Set();
  const cycles = [];

  function dfs(nodeId, path) {
    if (inStack.has(nodeId)) {
      const cycleStart = path.indexOf(nodeId);
      cycles.push(path.slice(cycleStart));
      return;
    }
    if (visited.has(nodeId)) return;

    visited.add(nodeId);
    inStack.add(nodeId);
    path.push(nodeId);

    const task = taskMap.get(nodeId);
    if (task) {
      for (const dep of task.deps) {
        dfs(dep, [...path]);
      }
    }

    inStack.delete(nodeId);
  }

  for (const task of tasks) {
    dfs(task.id, []);
  }

  return cycles;
}

function checkFileOverlap(tasks) {
  const overlaps = [];
  const fileToTask = new Map();

  for (const task of tasks) {
    for (const file of task.files) {
      if (fileToTask.has(file)) {
        overlaps.push({
          file,
          tasks: [fileToTask.get(file), task.id]
        });
      } else {
        fileToTask.set(file, task.id);
      }
    }
  }

  return overlaps;
}

function computeWaves(tasks) {
  const levels = computeDependencyLevels(tasks);
  const waves = {};

  for (const task of tasks) {
    const level = levels.get(task.id) || 1;
    if (!waves[level]) waves[level] = [];
    waves[level].push(task.id);
  }

  return waves;
}

function validateDeclaredVsComputed(tasks) {
  const computed = computeDependencyLevels(tasks);
  const mismatches = [];

  for (const task of tasks) {
    if (task.wave !== null) {
      const expected = computed.get(task.id);
      if (task.wave !== expected) {
        mismatches.push({
          id: task.id,
          declared: task.wave,
          computed: expected,
          error: `Declared wave ${task.wave} but DAG places it in wave ${expected}`
        });
      }
    }
  }

  return mismatches;
}

function checkIntraWaveOverlap(tasks) {
  const waves = computeWaves(tasks);
  const issues = [];

  for (const [waveNum, taskIds] of Object.entries(waves)) {
    const waveTasks = tasks.filter(t => taskIds.includes(t.id));
    const overlaps = checkFileOverlap(waveTasks);

    if (overlaps.length > 0) {
      for (const overlap of overlaps) {
        issues.push({
          wave: parseInt(waveNum),
          file: overlap.file,
          tasks: overlap.tasks,
          error: `Wave ${waveNum} tasks share file: ${overlap.file}`
        });
      }
    }
  }

  return issues;
}

function checkWiring(tasks) {
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const computed = computeDependencyLevels(tasks);
  const issues = [];

  for (const task of tasks) {
    for (const dep of task.deps) {
      const depTask = taskMap.get(dep);
      if (!depTask) {
        issues.push({
          task: task.id,
          missing_dependency: dep,
          error: `Task ${task.id} depends on unknown task ${dep}`
        });
      }
    }
  }

  return issues;
}

function groupTasksByArea(tasks) {
  const groups = {};

  for (const task of tasks) {
    const area = task.area || 'unassigned';
    if (!groups[area]) groups[area] = [];
    groups[area].push(task);
  }

  return groups;
}

function computeAreaWaves(tasks) {
  const groups = groupTasksByArea(tasks);
  const areaWaves = {};

  for (const [area, areaTasks] of Object.entries(groups)) {
    areaWaves[area] = computeWaves(areaTasks);
  }

  return areaWaves;
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const filePath = args[1];

  if (!command || !filePath) {
    console.log(USAGE);
    process.exit(1);
  }

  const planContent = fs.readFileSync(filePath, 'utf-8');
  const tasks = parsePlanTasks(planContent);

  switch (command) {
    case 'compute-waves': {
      const waves = computeWaves(tasks);
      console.log(JSON.stringify({ waves, taskCount: tasks.length }, null, 2));
      break;
    }

    case 'detect-cycles': {
      const cycles = detectCycles(tasks);
      if (cycles.length > 0) {
        console.error('Dependency cycles detected:');
        cycles.forEach(c => console.error(`  ${c.join(' -> ')}`));
        process.exit(1);
      }
      console.log('No dependency cycles detected.');
      break;
    }

    case 'check-overlap': {
      const overlaps = checkFileOverlap(tasks);
      if (overlaps.length > 0) {
        console.error('File overlap detected:');
        overlaps.forEach(o => console.error(`  ${o.file}: ${o.tasks.join(', ')}`));
        process.exit(1);
      }
      console.log('No file overlap detected.');
      break;
    }

    case 'validate': {
      const cycles = detectCycles(tasks);
      const overlaps = checkFileOverlap(tasks);
      const waves = computeWaves(tasks);
      const mismatches = validateDeclaredVsComputed(tasks);
      const intraWaveIssues = checkIntraWaveOverlap(tasks);
      const wiringIssues = checkWiring(tasks);

      const allIssues = [
        ...cycles.map(c => ({ type: 'cycle', error: c })),
        ...overlaps.map(o => ({ type: 'overlap', ...o })),
        ...mismatches.map(m => ({ type: 'wave_mismatch', ...m })),
        ...intraWaveIssues.map(i => ({ type: 'intra_wave_overlap', ...i })),
        ...wiringIssues.map(w => ({ type: 'wiring', ...w }))
      ];

      const result = {
        valid: allIssues.length === 0,
        taskCount: tasks.length,
        waveCount: Object.keys(waves).length,
        waves,
        issues: allIssues
      };

      console.log(JSON.stringify(result, null, 2));
      process.exit(result.valid ? 0 : 1);
    }

    case 'group-by-area': {
      const groups = groupTasksByArea(tasks);
      console.log(JSON.stringify({ groups, taskCount: tasks.length }, null, 2));
      break;
    }

    case 'compute-area-waves': {
      const areaWaves = computeAreaWaves(tasks);
      console.log(JSON.stringify({ areaWaves, taskCount: tasks.length }, null, 2));
      break;
    }

    case 'intra-wave-overlap': {
      const issues = checkIntraWaveOverlap(tasks);
      if (issues.length > 0) {
        console.error('Intra-wave overlap detected:');
        issues.forEach(i => console.error(`  Wave ${i.wave}: ${i.file} shared by ${i.tasks.join(', ')}`));
        process.exit(1);
      }
      console.log('No intra-wave overlap detected.');
      break;
    }

    case 'check-wiring': {
      const issues = checkWiring(tasks);
      if (issues.length > 0) {
        console.error('Wiring issues detected:');
        issues.forEach(i => console.error(`  ${i.error}`));
        process.exit(1);
      }
      console.log('No wiring issues detected.');
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

module.exports = {
  parsePlanTasks,
  parseFrontmatter,
  computeDependencyLevels,
  detectCycles,
  checkFileOverlap,
  computeWaves,
  validateDeclaredVsComputed,
  checkIntraWaveOverlap,
  checkWiring,
  groupTasksByArea,
  computeAreaWaves
};
