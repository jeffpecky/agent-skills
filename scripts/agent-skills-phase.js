#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Phase Manager: per-phase directory tracking.
 * Adds optional phase directories under tasks/ for projects with multiple phases.
 * Flat tasks/ workflow still works unchanged.
 *
 * Structure:
 *   tasks/
 *     phases/
 *       01-setup/
 *         PLAN.md      # Phase plan (existence = started)
 *         SUMMARY.md   # Phase summary (existence = complete)
 *         tasks/       # Phase-specific task files
 *       02-build/
 *         PLAN.md
 *         SUMMARY.md
 *     plan.md          # Overall plan (still exists)
 *     STATE.md         # Overall state (still exists)
 */

const USAGE = `
Usage: node agent-skills-phase.js <command> [options]

Commands:
  init <project-root>              Initialize phase directory structure
  list <project-root>              List all phases and their status
  create <project-root> <name>     Create a new phase directory
  activate <project-root> <name>   Set a phase as active
  complete <project-root> <name>   Mark a phase as complete (writes SUMMARY.md)
  progress <project-root>          Show progress across all phases
  current <project-root>           Show current active phase
`;

function getPhasesDir(projectRoot) {
  return path.join(projectRoot, 'tasks', 'phases');
}

function ensurePhasesDir(projectRoot) {
  const phasesDir = getPhasesDir(projectRoot);
  if (!fs.existsSync(phasesDir)) {
    fs.mkdirSync(phasesDir, { recursive: true });
  }
  return phasesDir;
}

function parsePhaseDirName(name) {
  // "01-setup" → { order: 1, name: "setup" }
  const match = name.match(/^(\d+)-(.+)$/);
  if (!match) return null;
  return { order: parseInt(match[1], 10), name: match[2] };
}

function formatPhaseDirName(order, name) {
  return `${String(order).padStart(2, '0')}-${name}`;
}

function listPhases(projectRoot) {
  const phasesDir = getPhasesDir(projectRoot);
  if (!fs.existsSync(phasesDir)) return [];

  const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
  const phases = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const parsed = parsePhaseDirName(entry.name);
    if (!parsed) continue;

    const phaseDir = path.join(phasesDir, entry.name);
    const hasPlan = fs.existsSync(path.join(phaseDir, 'PLAN.md'));
    const hasSummary = fs.existsSync(path.join(phaseDir, 'SUMMARY.md'));

    let status = 'pending';
    if (hasSummary) status = 'complete';
    else if (hasPlan) status = 'in_progress';

    // Count tasks in phase
    let taskCount = 0;
    let completedCount = 0;
    const tasksDir = path.join(phaseDir, 'tasks');
    if (fs.existsSync(tasksDir)) {
      const taskFiles = fs.readdirSync(tasksDir).filter(f => f.endsWith('.md'));
      taskCount = taskFiles.length;
      // Count completed tasks (from status files)
      for (const tf of taskFiles) {
        const statusPath = path.join(phaseDir, 'tasks', tf.replace(/\.\w+$/, '.status.json'));
        if (fs.existsSync(statusPath)) {
          try {
            const statusData = JSON.parse(fs.readFileSync(statusPath, 'utf-8'));
            if (statusData.status === 'done' || statusData.status === 'passed') completedCount++;
          } catch {}
        }
      }
    }

    phases.push({
      name: entry.name,
      order: parsed.order,
      shortName: parsed.name,
      status,
      hasPlan,
      hasSummary,
      taskCount,
      completedCount,
      progress: taskCount > 0 ? Math.round((completedCount / taskCount) * 100) : (status === 'complete' ? 100 : 0)
    });
  }

  return phases.sort((a, b) => a.order - b.order);
}

function createPhase(projectRoot, name, order) {
  const phasesDir = ensurePhasesDir(projectRoot);

  // Auto-assign order if not provided
  if (order === undefined) {
    const existing = listPhases(projectRoot);
    order = existing.length > 0 ? Math.max(...existing.map(p => p.order)) + 1 : 1;
  }

  const dirName = formatPhaseDirName(order, name);
  const phaseDir = path.join(phasesDir, dirName);

  if (fs.existsSync(phaseDir)) {
    return { success: false, error: `Phase '${dirName}' already exists` };
  }

  fs.mkdirSync(phaseDir, { recursive: true });
  fs.mkdirSync(path.join(phaseDir, 'tasks'), { recursive: true });

  return { success: true, name: dirName, path: phaseDir };
}

function activatePhase(projectRoot, name) {
  const phasesDir = getPhasesDir(projectRoot);
  const phaseDir = path.join(phasesDir, name);

  if (!fs.existsSync(phaseDir)) {
    return { success: false, error: `Phase '${name}' does not exist` };
  }

  // Write ACTIVe marker
  const markerPath = path.join(phasesDir, '.active');
  fs.writeFileSync(markerPath, name);

  return { success: true, active: name };
}

function completePhase(projectRoot, name, summary) {
  const phasesDir = getPhasesDir(projectRoot);
  const phaseDir = path.join(phasesDir, name);

  if (!fs.existsSync(phaseDir)) {
    return { success: false, error: `Phase '${name}' does not exist` };
  }

  const summaryPath = path.join(phaseDir, 'SUMMARY.md');
  const content = summary || `# ${name} Summary\n\nPhase completed.\n`;
  fs.writeFileSync(summaryPath, content);

  return { success: true, name };
}

function getCurrentPhase(projectRoot) {
  const phasesDir = getPhasesDir(projectRoot);
  const markerPath = path.join(phasesDir, '.active');

  if (!fs.existsSync(markerPath)) return null;

  const active = fs.readFileSync(markerPath, 'utf-8').trim();
  const phaseDir = path.join(phasesDir, active);

  if (!fs.existsSync(phaseDir)) return null;

  return active;
}

function getProgress(projectRoot) {
  const phases = listPhases(projectRoot);
  if (phases.length === 0) {
    return { phases: [], overall: { total: 0, complete: 0, percent: 0 } };
  }

  const complete = phases.filter(p => p.status === 'complete').length;
  const total = phases.length;

  return {
    phases: phases.map(p => ({
      name: p.name,
      status: p.status,
      progress: p.progress,
      taskCount: p.taskCount,
      completedCount: p.completedCount
    })),
    overall: {
      total,
      complete,
      percent: Math.round((complete / total) * 100)
    }
  };
}

function initPhaseStructure(projectRoot) {
  ensurePhasesDir(projectRoot);

  // Create a default first phase if none exist
  const phases = listPhases(projectRoot);
  if (phases.length === 0) {
    createPhase(projectRoot, 'setup', 1);
    activatePhase(projectRoot, '01-setup');
  }

  return { success: true, phasesDir: getPhasesDir(projectRoot) };
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    console.log(USAGE);
    process.exit(1);
  }

  switch (command) {
    case 'init': {
      const root = args[1] || process.cwd();
      const result = initPhaseStructure(root);
      console.log(JSON.stringify(result, null, 2));
      break;
    }

    case 'list': {
      const root = args[1] || process.cwd();
      const phases = listPhases(root);
      console.log(JSON.stringify(phases, null, 2));
      break;
    }

    case 'create': {
      const root = args[1] || process.cwd();
      const name = args[2];
      const order = args[3] ? parseInt(args[3], 10) : undefined;
      if (!name) {
        console.error('Error: phase name required');
        process.exit(1);
      }
      const result = createPhase(root, name, order);
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    }

    case 'activate': {
      const root = args[1] || process.cwd();
      const name = args[2];
      if (!name) {
        console.error('Error: phase name required');
        process.exit(1);
      }
      const result = activatePhase(root, name);
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    }

    case 'complete': {
      const root = args[1] || process.cwd();
      const name = args[2];
      if (!name) {
        console.error('Error: phase name required');
        process.exit(1);
      }
      const result = completePhase(root, name);
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    }

    case 'progress': {
      const root = args[1] || process.cwd();
      const progress = getProgress(root);
      console.log(JSON.stringify(progress, null, 2));
      break;
    }

    case 'current': {
      const root = args[1] || process.cwd();
      const current = getCurrentPhase(root);
      console.log(JSON.stringify({ current }, null, 2));
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

module.exports = { listPhases, createPhase, activatePhase, completePhase, getCurrentPhase, getProgress, initPhaseStructure, parsePhaseDirName, formatPhaseDirName };
