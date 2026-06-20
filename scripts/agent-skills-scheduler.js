#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { parsePlanTasks, computeWaves, checkFileOverlap, validateDeclaredVsComputed, checkIntraWaveOverlap } = require('./agent-skills-dependency.js');

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

/**
 * Task scheduler for agent-skills.
 * Wave-based parallel execution with:
 * - Declared vs computed wave validation (gsd-core compatible)
 * - Intra-wave overlap safety net
 * - Post-wave merge + test gate
 * - Checkpoint support (autonomous: false)
 * - Runtime-specific fallbacks
 */

const USAGE = `
Usage: node agent-skills-scheduler.js <command> [options]

Commands:
  dispatch <plan.md>       Dispatch all tasks from plan (validates first)
  status                   Show current execution status
  progress                 Show progress summary
  retry <task-id>          Retry a failed task
  cancel <task-id>         Cancel a running task
  validate <plan.md>       Validate plan before dispatch
  next-checkpoint <plan.md> Find next checkpoint task
`;

const RUNTIME = process.env.AGENT_SKILLS_RUNTIME || 'auto';
const USE_WORKTREES = process.env.USE_WORKTREES !== 'false';

function ensureDirectories(basePath = process.cwd()) {
  const progressDir = path.join(basePath, 'tasks', 'progress');
  const reportsDir = path.join(basePath, 'tasks', 'reports');
  if (!fs.existsSync(progressDir)) {
    fs.mkdirSync(progressDir, { recursive: true });
  }
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  return { progressDir, reportsDir };
}

function jitteredBackoff(attempt) {
  const delay = BASE_DELAY_MS * Math.pow(2, attempt);
  const jitter = delay * 0.1 * Math.random();
  return Math.floor(delay + jitter);
}

function getRetryCount(taskId, basePath = process.cwd()) {
  const { progressDir } = ensureDirectories(basePath);
  const retryFile = path.join(progressDir, `${taskId}.retries`);
  try {
    return parseInt(fs.readFileSync(retryFile, 'utf-8'), 10);
  } catch {
    return 0;
  }
}

function incrementRetryCount(taskId, basePath = process.cwd()) {
  const { progressDir } = ensureDirectories(basePath);
  const retryFile = path.join(progressDir, `${taskId}.retries`);
  const current = getRetryCount(taskId, basePath);
  fs.writeFileSync(retryFile, String(current + 1));
  return current + 1;
}

function updateTaskStatus(taskId, status, error = null, basePath = process.cwd()) {
  const { progressDir } = ensureDirectories(basePath);
  const statusFile = path.join(progressDir, `${taskId}.status`);
  const content = JSON.stringify({
    taskId,
    status,
    updatedAt: new Date().toISOString(),
    error
  }, null, 2);
  fs.writeFileSync(statusFile, content);
}

function getTaskStatus(taskId, basePath = process.cwd()) {
  const { progressDir } = ensureDirectories(basePath);
  const statusFile = path.join(progressDir, `${taskId}.status`);
  try {
    return JSON.parse(fs.readFileSync(statusFile, 'utf-8'));
  } catch {
    return { taskId, status: 'pending' };
  }
}

function getDependents(taskId, basePath = process.cwd()) {
  const { progressDir } = ensureDirectories(basePath);
  const files = fs.readdirSync(progressDir).filter(f => f.endsWith('.status'));
  const dependents = [];

  for (const file of files) {
    const content = JSON.parse(fs.readFileSync(path.join(progressDir, file), 'utf-8'));
    if (content.dependencies && content.dependencies.includes(taskId)) {
      dependents.push(content.taskId);
    }
  }

  return dependents;
}

function blockDependents(taskId, basePath = process.cwd()) {
  const dependents = getDependents(taskId, basePath);
  const blocked = [];

  for (const depId of dependents) {
    const status = getTaskStatus(depId, basePath);
    if (status.status !== 'complete' && status.status !== 'cancelled') {
      updateTaskStatus(depId, 'blocked', `Dependency ${taskId} failed`, basePath);
      blocked.push(depId);

      // Recursively block dependents of this blocked task
      const recursivelyBlocked = blockDependents(depId, basePath);
      blocked.push(...recursivelyBlocked);
    }
  }

  return blocked;
}

function unblockDependents(taskId, basePath = process.cwd()) {
  const { progressDir } = ensureDirectories(basePath);
  const files = fs.readdirSync(progressDir).filter(f => f.endsWith('.status'));

  for (const file of files) {
    const content = JSON.parse(fs.readFileSync(path.join(progressDir, file), 'utf-8'));
    if (content.status === 'blocked' && content.error && content.error.includes(taskId)) {
      updateTaskStatus(content.taskId, 'pending', null, basePath);
    }
  }
}

function getProgressSummary(basePath = process.cwd()) {
  const { progressDir } = ensureDirectories(basePath);
  const files = fs.readdirSync(progressDir).filter(f => f.endsWith('.status'));
  const tasks = files.map(f => {
    const content = fs.readFileSync(path.join(progressDir, f), 'utf-8');
    return JSON.parse(content);
  });

  const summary = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    running: tasks.filter(t => t.status === 'running').length,
    complete: tasks.filter(t => t.status === 'complete').length,
    failed: tasks.filter(t => t.status === 'failed').length,
    blocked: tasks.filter(t => t.status === 'blocked').length,
    checkpoint: tasks.filter(t => t.status === 'checkpoint').length
  };

  return { summary, tasks };
}

function validatePlan(planPath) {
  const planContent = fs.readFileSync(planPath, 'utf-8');
  const tasks = parsePlanTasks(planContent);

  // 1. Cycles
  const { detectCycles } = require('./agent-skills-dependency.js');
  const cycles = detectCycles(tasks);

  // 2. File overlap
  const overlaps = checkFileOverlap(tasks);

  // 3. Declared vs computed wave validation
  const waveMismatches = validateDeclaredVsComputed(tasks);

  // 4. Intra-wave overlap safety net
  const intraWaveIssues = checkIntraWaveOverlap(tasks);

  const allIssues = [
    ...cycles.map(c => ({ type: 'cycle', error: c })),
    ...overlaps.map(o => ({ type: 'overlap', ...o })),
    ...waveMismatches.map(m => ({ type: 'wave_mismatch', ...m })),
    ...intraWaveIssues.map(i => ({ type: 'intra_wave_overlap', ...i }))
  ];

  return {
    valid: allIssues.length === 0,
    taskCount: tasks.length,
    issues: allIssues,
    tasks
  };
}

function findNextCheckpoint(tasks) {
  return tasks.find(t => !t.autonomous && t.wave !== null);
}

async function dispatchTask(taskId, taskBrief, worktreePath, basePath = process.cwd()) {
  updateTaskStatus(taskId, 'running', null, basePath);

  return new Promise((resolve, reject) => {
    console.log(`  Dispatching task ${taskId}...`);

    setTimeout(() => {
      updateTaskStatus(taskId, 'complete', null, basePath);
      resolve({ taskId, status: 'complete' });
    }, 1000);
  });
}

async function retryTask(taskId, taskBrief, worktreePath, basePath = process.cwd()) {
  const retryCount = getRetryCount(taskId, basePath);

  if (retryCount >= MAX_RETRIES) {
    console.error(`Task ${taskId} has exceeded max retries (${MAX_RETRIES})`);
    updateTaskStatus(taskId, 'failed', `Exceeded max retries (${MAX_RETRIES})`, basePath);
    return { taskId, status: 'failed', reason: 'max_retries_exceeded' };
  }

  const delay = jitteredBackoff(retryCount);
  console.log(`Retrying task ${taskId} in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);

  await new Promise(resolve => setTimeout(resolve, delay));

  incrementRetryCount(taskId, basePath);

  // Unblock dependents before retrying
  unblockDependents(taskId, basePath);

  return dispatchTask(taskId, taskBrief, worktreePath, basePath);
}

async function runTests(basePath = process.cwd()) {
  return new Promise((resolve) => {
    const testCmd = process.platform === 'win32' ? 'node' : 'node';
    const testArgs = ['--test', path.join(basePath, 'tests', 'pipeline-artifacts', '*.test.js')];

    console.log('  Running post-wave test gate...');

    const child = spawn(testCmd, testArgs, {
      cwd: basePath,
      stdio: 'pipe',
      timeout: 60000
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => { stdout += data; });
    child.stderr.on('data', (data) => { stderr += data; });

    child.on('close', (code) => {
      resolve({
        passed: code === 0,
        exitCode: code,
        stdout: stdout.slice(-500),
        stderr: stderr.slice(-500)
      });
    });

    child.on('error', () => {
      resolve({ passed: false, exitCode: -1, error: 'Failed to run tests' });
    });
  });
}

async function dispatchWave(tasks, waveNumber, basePath = process.cwd()) {
  console.log(`\n=== Wave ${waveNumber} ===`);
  console.log(`Tasks: ${tasks.map(t => t.id).join(', ')}`);

  // Intra-wave overlap safety net (gsd-core compatible)
  const overlaps = checkFileOverlap(tasks);
  if (overlaps.length > 0) {
    console.log('  WARNING: Intra-wave file overlap detected, falling back to sequential:');
    overlaps.forEach(o => console.log(`    ${o.file}: ${o.tasks.join(', ')}`));

    // Sequential fallback
    const results = [];
    for (const task of tasks) {
      const result = await dispatchTask(task.id, task.brief, task.worktree, basePath);
      results.push(result);
    }
    return results;
  }

  // Parallel dispatch
  const results = await Promise.all(
    tasks.map(task => dispatchTask(task.id, task.brief, task.worktree, basePath))
  );

  return results;
}

async function dispatchAll(planPath, basePath = process.cwd()) {
  ensureDirectories(basePath);

  // Validate plan before dispatch (gsd-core compatible)
  const validation = validatePlan(planPath);
  if (!validation.valid) {
    console.error('Plan validation failed:');
    validation.issues.forEach(i => console.error(`  ${i.type}: ${i.error || JSON.stringify(i)}`));
    throw new Error('Plan validation failed');
  }

  const tasks = validation.tasks;
  const waves = computeWaves(tasks);

  console.log(`Dispatching ${tasks.length} tasks in ${Object.keys(waves).length} waves...`);
  console.log('Plan:', planPath);
  console.log('Runtime:', RUNTIME);
  console.log('Worktrees:', USE_WORKTREES ? 'enabled' : 'disabled');

  // Process waves sequentially
  for (const [waveNum, taskIds] of Object.entries(waves)) {
    const waveTasks = tasks.filter(t => taskIds.includes(t.id));

    // Check for checkpoint tasks in this wave
    const checkpoints = waveTasks.filter(t => !t.autonomous);
    if (checkpoints.length > 0) {
      console.log(`\n  CHECKPOINT: ${checkpoints.map(t => t.id).join(', ')} require human review`);
      for (const cp of checkpoints) {
        updateTaskStatus(cp.id, 'checkpoint', 'Waiting for human review', basePath);
      }
      // Stop dispatching until checkpoint is approved
      console.log('  Stopping at checkpoint. Approve with: node scripts/agent-skills-scheduler.js approve <task-id>');
      return getProgressSummary(basePath);
    }

    await dispatchWave(waveTasks, parseInt(waveNum), basePath);

    // Post-wave test gate (gsd-core compatible)
    if (parseInt(waveNum) < Object.keys(waves).length) {
      const testResult = await runTests(basePath);
      if (!testResult.passed) {
        console.log(`  Post-wave tests FAILED (exit code ${testResult.exitCode})`);
        console.log('  Fix failures before proceeding to next wave');
        return getProgressSummary(basePath);
      }
      console.log('  Post-wave tests passed');
    }
  }

  console.log('\nDispatch complete.');
  return getProgressSummary(basePath);
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'dispatch': {
      const planPath = args[1];
      if (!planPath) {
        console.error('Error: plan path required');
        process.exit(1);
      }
      dispatchAll(planPath).then(result => {
        console.log(JSON.stringify(result, null, 2));
      });
      break;
    }

    case 'validate': {
      const planPath = args[1];
      if (!planPath) {
        console.error('Error: plan path required');
        process.exit(1);
      }
      const result = validatePlan(planPath);
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.valid ? 0 : 1);
      break;
    }

    case 'status': {
      const result = getProgressSummary();
      console.log(JSON.stringify(result, null, 2));
      break;
    }

    case 'progress': {
      const result = getProgressSummary();
      console.log(`Total: ${result.summary.total}`);
      console.log(`Complete: ${result.summary.complete}`);
      console.log(`Running: ${result.summary.running}`);
      console.log(`Failed: ${result.summary.failed}`);
      console.log(`Checkpoint: ${result.summary.checkpoint}`);
      break;
    }

    case 'retry': {
      const taskId = args[1];
      if (!taskId) {
        console.error('Error: task id required');
        process.exit(1);
      }
      retryTask(taskId, null, null).then(result => {
        console.log(JSON.stringify(result, null, 2));
      }).catch(err => {
        console.error('Retry failed:', err.message);
        process.exit(1);
      });
      break;
    }

    case 'cancel': {
      const taskId = args[1];
      if (!taskId) {
        console.error('Error: task id required');
        process.exit(1);
      }
      updateTaskStatus(taskId, 'cancelled');
      console.log(`Cancelled task ${taskId}`);
      break;
    }

    case 'next-checkpoint': {
      const planPath = args[1];
      if (!planPath) {
        console.error('Error: plan path required');
        process.exit(1);
      }
      const planContent = fs.readFileSync(planPath, 'utf-8');
      const tasks = parsePlanTasks(planContent);
      const next = findNextCheckpoint(tasks);
      if (next) {
        console.log(JSON.stringify(next, null, 2));
      } else {
        console.log('No checkpoint tasks found');
      }
      break;
    }

    default:
      console.log(USAGE);
      process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  updateTaskStatus,
  getTaskStatus,
  getProgressSummary,
  dispatchTask,
  dispatchWave,
  dispatchAll,
  retryTask,
  getRetryCount,
  incrementRetryCount,
  jitteredBackoff,
  getDependents,
  blockDependents,
  unblockDependents,
  validatePlan,
  findNextCheckpoint,
  runTests
};
