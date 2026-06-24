#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync, execSync } = require('child_process');

/**
 * Transition & Worktree Safety:
 * 1. Transition workflow routes (multi-milestone, multi-workstream)
 * 2. Post-wave shared artifact update (safe state writes after parallel tasks)
 * 3. Worktree merge strategy (branch merge, conflict resolution, cleanup)
 */

const USAGE = `
Usage: node agent-skills-transition.js <command> [options]

Commands:
  route <project-root>              Determine which transition route applies
  archive-milestone <project-root>  Archive completed milestone
  post-wave-update <dir> <files>    Safely update shared artifacts after wave
  merge-worktree <project-root> <branch>  Merge worktree branch into main
  clean-orphans <project-root>      Clean orphaned worktrees from crashed sessions
  stash-check <project-root>        Check for git stash (forbidden in worktrees)
  cwd-guard <project-root>          Verify CWD is primary worktree
`;

function git(projectRoot, args, options = {}) {
  return execFileSync('git', args, {
    cwd: projectRoot,
    stdio: 'pipe',
    timeout: 30000,
    ...options,
  });
}

// --- TRANSITION WORKFLOW ROUTES ---

function listWorkstreams(projectRoot) {
  const workspacesDir = path.join(projectRoot, '.workstreams');
  if (!fs.existsSync(workspacesDir)) return [];
  return fs.readdirSync(workspacesDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
}

function listMilestones(projectRoot) {
  const milestonesDir = path.join(projectRoot, '.milestones');
  if (!fs.existsSync(milestonesDir)) return [];
  return fs.readdirSync(milestonesDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
}

function getPhaseProgress(projectRoot, workstream) {
  const phasesDir = workstream
    ? path.join(projectRoot, '.workstreams', workstream, 'phases')
    : path.join(projectRoot, 'tasks', 'phases');

  if (!fs.existsSync(phasesDir)) return { total: 0, complete: 0 };

  const entries = fs.readdirSync(phasesDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && /^\d+-/.test(d.name));

  let total = entries.length;
  let complete = 0;

  for (const entry of entries) {
    const phaseDir = path.join(phasesDir, entry.name);
    if (fs.existsSync(path.join(phaseDir, 'SUMMARY.md'))) complete++;
  }

  return { total, complete };
}

function getWorkstreamProgress(projectRoot, workstream) {
  const wsDir = path.join(projectRoot, '.workstreams', workstream);
  if (!fs.existsSync(wsDir)) return null;

  const phases = getPhaseProgress(projectRoot, workstream);
  const isComplete = phases.total > 0 && phases.complete === phases.total;

  return {
    name: workstream,
    phases,
    isComplete,
    progress: phases.total > 0 ? Math.round((phases.complete / phases.total) * 100) : 0
  };
}

/**
 * Determine which transition route applies after a phase completes.
 * 
 * Routes:
 *   A  — More phases exist → advance to next phase
 *   B  — Last phase, no other workstreams → archive milestone
 *   B1 — Last phase, other workstreams still active → block, show progress
 *   C  — Multi-milestone: more milestones exist → advance to next milestone
 */
function determineRoute(projectRoot, completedWorkstream) {
  const workstreams = listWorkstreams(projectRoot);
  const milestones = listMilestones(projectRoot);

  // Check if this workstream has more phases
  const progress = getPhaseProgress(projectRoot, completedWorkstream);
  const hasMorePhases = progress.complete < progress.total;

  if (hasMorePhases) {
    return {
      route: 'A',
      action: 'advance_phase',
      detail: `Phase ${progress.complete + 1}/${progress.total} ready`,
      nextPhase: progress.complete + 1
    };
  }

  // Last phase — check other workstreams
  const otherActive = workstreams
    .filter(ws => ws !== completedWorkstream)
    .map(ws => getWorkstreamProgress(projectRoot, ws))
    .filter(p => p && !p.isComplete);

  if (otherActive.length > 0) {
    return {
      route: 'B1',
      action: 'block',
      detail: `${otherActive.length} other workstream(s) still active`,
      workstreams: otherActive.map(w => ({
        name: w.name,
        progress: w.progress
      }))
    };
  }

  // All workstreams complete — check milestones
  if (milestones.length > 0) {
    const currentMilestone = milestones[milestones.length - 1];
    const hasMoreMilestones = milestones.length > 1 ||
      fs.existsSync(path.join(projectRoot, '.milestones', currentMilestone, 'next-milestone.md'));

    if (hasMoreMilestones) {
      return {
        route: 'C',
        action: 'advance_milestone',
        detail: 'More milestones available',
        currentMilestone,
        nextMilestone: `${currentMilestone}-v2`
      };
    }
  }

  return {
    route: 'B',
    action: 'archive',
    detail: 'All workstreams complete, ready to archive',
    milestone: milestones[milestones.length - 1] || 'default'
  };
}

function archiveMilestone(projectRoot, milestoneName) {
  const milestonesDir = path.join(projectRoot, '.milestones');
  const milestoneDir = path.join(milestonesDir, milestoneName);

  if (!fs.existsSync(milestoneDir)) {
    fs.mkdirSync(milestoneDir, { recursive: true });
  }

  // Write completion marker
  const completionPath = path.join(milestoneDir, 'COMPLETED.md');
  const content = `# ${milestoneName} — Completed\n\nArchived at: ${new Date().toISOString()}\n`;
  fs.writeFileSync(completionPath, content);

  // Move workstream state into milestone
  const workspacesDir = path.join(projectRoot, '.workstreams');
  if (fs.existsSync(workspacesDir)) {
    const archivedDir = path.join(milestoneDir, 'workstreams');
    fs.mkdirSync(archivedDir, { recursive: true });
    const entries = fs.readdirSync(workspacesDir, { withFileTypes: true });
    for (const entry of entries) {
      const src = path.join(workspacesDir, entry.name);
      const dst = path.join(archivedDir, entry.name);
      fs.cpSync(src, dst, { recursive: true });
    }
  }

  return { success: true, milestone: milestoneName, archivedAt: new Date().toISOString() };
}

// --- POST-WAVE SHARED ARTIFACT UPDATE ---

/**
 * Safely update shared artifacts (STATE.md, config.json, ROADMAP.md) after
 * a wave of parallel tasks completes. Prevents last-writer-wins by having
 * the orchestrator (not executors) update shared state centrally.
 */
function postWaveUpdate(dir, files, updates) {
  const lock = require('./agent-skills-lock.js');
  const batch = lock.acquireBatchLock(dir, files);

  if (!batch.success) {
    return { success: false, error: `Could not acquire batch lock: ${batch.error}` };
  }

  try {
    const results = [];

    for (const file of files) {
      const filePath = path.join(dir, file);
      const update = updates[file];

      if (!update) continue;

      if (update.action === 'append') {
        // Append to existing content
        const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
        const newContent = existing + (existing.endsWith('\n') ? '' : '\n') + update.content;
        fs.writeFileSync(filePath, newContent);
        results.push({ file, action: 'appended', bytes: update.content.length });
      } else if (update.action === 'write') {
        // Overwrite (only for orchestrator-controlled updates)
        fs.writeFileSync(filePath, update.content);
        results.push({ file, action: 'written', bytes: update.content.length });
      } else if (update.action === 'merge-table') {
        // Merge progress table rows (dedup by task ID)
        const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
        const existingRows = existing.split('\n').filter(line => line.startsWith('|'));
        const newRows = update.content.split('\n').filter(line => line.startsWith('|'));

        // Dedup: keep latest row per task ID (first column)
        const rowMap = new Map();
        for (const row of [...existingRows, ...newRows]) {
          const cols = row.split('|').map(c => c.trim());
          if (cols[1] && !cols[1].startsWith('-')) {
            rowMap.set(cols[1], row);
          }
        }

        const header = newRows[0] || existingRows[0] || '| Task | Status | Commits | Notes |';
        const separator = newRows[1] || existingRows[1] || '|------|--------|---------|-------|';
        const dataRows = [...rowMap.values()].filter(r => !r.includes('------'));

        const merged = [header, separator, ...dataRows].join('\n');
        fs.writeFileSync(filePath, merged);
        results.push({ file, action: 'merged_table', rows: dataRows.length });
      }
    }

    return { success: true, results };
  } finally {
    lock.releaseBatchLock(dir);
  }
}

// --- WORKTREE MERGE STRATEGY ---

function isGitRepo(projectRoot) {
  try {
    git(projectRoot, ['rev-parse', '--is-inside-work-tree']);
    return true;
  } catch {
    return false;
  }
}

function getCurrentBranch(projectRoot) {
  try {
    return git(projectRoot, ['branch', '--show-current']).toString().trim();
  } catch {
    return null;
  }
}

function getWorktrees(projectRoot) {
  try {
    const output = git(projectRoot, ['worktree', 'list', '--porcelain']).toString();
    const trees = [];
    let current = {};

    for (const line of output.split('\n')) {
      if (line.startsWith('worktree ')) {
        if (current.path) trees.push(current);
        current = { path: line.slice(10) };
      } else if (line.startsWith('HEAD ')) {
        current.head = line.slice(5);
      } else if (line.startsWith('branch ')) {
        current.branch = line.slice(7);
      }
    }
    if (current.path) trees.push(current);
    return trees;
  } catch {
    return [];
  }
}

function stashCheck(projectRoot) {
  try {
    const output = git(projectRoot, ['stash', 'list']).toString().trim();
    const hasStash = output.length > 0;
    return {
      hasStash,
      stashCount: hasStash ? output.split('\n').length : 0,
      warning: hasStash ? 'Stash is shared across worktrees and will corrupt parallel work. Remove before proceeding.' : null
    };
  } catch {
    return { hasStash: false, stashCount: 0, warning: null };
  }
}

function cwdGuard(projectRoot) {
  const cwd = process.cwd();
  const isPrimary = cwd === projectRoot || cwd.startsWith(projectRoot + path.sep);
  const worktrees = getWorktrees(projectRoot);
  const isInWorktree = worktrees.some(wt => cwd === wt.path || cwd.startsWith(wt.path + path.sep));

  return {
    cwd,
    isPrimary,
    isInWorktree,
    ok: isPrimary || !isInWorktree,
    warning: isInWorktree && !isPrimary
      ? `CWD is inside worktree ${cwd}. Pin back to primary worktree (${projectRoot}) before merge.`
      : null
  };
}

/**
 * Merge a worktree branch into the main branch.
 * Follows gsd-core's merge strategy:
 * 1. Verify branch exists
 * 2. Check for deleted files on branch
 * 3. Attempt merge
 * 4. If conflict → fail-safe (don't default to editing main)
 * 5. Clean up worktree and branch
 */
function mergeWorktree(projectRoot, branch) {
  if (!isGitRepo(projectRoot)) {
    return { success: false, error: 'Not a git repository' };
  }

  const primaryBranch = getCurrentBranch(projectRoot) || 'main';
  const guard = cwdGuard(projectRoot);
  if (!guard.ok) {
    return { success: false, error: guard.warning };
  }

  // Check stash
  const stash = stashCheck(projectRoot);
  if (stash.hasStash) {
    return { success: false, error: stash.warning };
  }

  // Check branch exists
  try {
    git(projectRoot, ['rev-parse', '--verify', branch]);
  } catch {
    return { success: false, error: `Branch '${branch}' does not exist` };
  }

  // Check for deleted files on branch
  let deletedFiles = [];
  try {
    const diff = git(projectRoot, ['diff', '--name-status', `${primaryBranch}...${branch}`]).toString();
    deletedFiles = diff.split('\n')
      .filter(line => line.startsWith('D'))
      .map(line => line.slice(2).trim());
  } catch {}

  // Attempt merge
  try {
    git(projectRoot, ['merge', '--no-ff', branch, '-m', `Merge ${branch} into ${primaryBranch}`]);

    return {
      success: true,
      branch,
      mergedInto: primaryBranch,
      deletedFiles,
      commit: git(projectRoot, ['rev-parse', 'HEAD']).toString().trim()
    };
  } catch (err) {
    // Merge conflict — abort and report
    try {
      git(projectRoot, ['merge', '--abort']);
    } catch {}

    return {
      success: false,
      error: 'Merge conflict detected. Aborted merge.',
      hint: `Resolve conflicts manually in ${projectRoot}, then retry.`,
      branch
    };
  }
}

function cleanOrphans(projectRoot) {
  if (!isGitRepo(projectRoot)) {
    return { success: false, error: 'Not a git repository' };
  }

  const worktrees = getWorktrees(projectRoot);
  const primary = worktrees[0];
  const orphans = [];

  for (let i = 1; i < worktrees.length; i++) {
    const wt = worktrees[i];
    try {
      // Check if worktree directory exists and has a valid HEAD
      const head = git(wt.path, ['rev-parse', 'HEAD']).toString().trim();
      // Check if branch still exists
      if (wt.branch) {
        try {
          git(projectRoot, ['rev-parse', '--verify', wt.branch]);
        } catch {
          // Branch doesn't exist but worktree does — orphan
          orphans.push({ path: wt.path, branch: wt.branch, head });
          continue;
        }
      }
      // Check if worktree is stale (no recent commits)
      const status = git(wt.path, ['status', '--porcelain']).toString().trim();
      if (status.length === 0) {
        // Clean worktree with no uncommitted changes — safe to remove
        orphans.push({ path: wt.path, branch: wt.branch, head, clean: true });
      }
    } catch {
      orphans.push({ path: wt.path, branch: wt.branch, error: 'Cannot access worktree' });
    }
  }

  const removed = [];
  for (const orphan of orphans) {
    if (orphan.clean || orphan.error) {
      try {
        git(projectRoot, ['worktree', 'remove', '--force', orphan.path]);
        removed.push(orphan.path);
      } catch {}
    }
  }

  return {
    found: orphans.length,
    removed: removed.length,
    orphans: orphans.map(o => o.path),
    removedPaths: removed,
    remaining: orphans.length - removed.length
  };
}

// --- CLI ---

function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    console.log(USAGE);
    process.exit(1);
  }

  switch (command) {
    case 'route': {
      const root = args[1] || process.cwd();
      const ws = args[2];
      const result = determineRoute(root, ws);
      console.log(JSON.stringify(result, null, 2));
      break;
    }

    case 'archive-milestone': {
      const root = args[1] || process.cwd();
      const name = args[2];
      if (!name) {
        console.error('Error: milestone name required');
        process.exit(1);
      }
      const result = archiveMilestone(root, name);
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    }

    case 'post-wave-update': {
      const dir = args[1] || process.cwd();
      const files = (args[2] || '').split(',').filter(Boolean);
      // Read updates from stdin as JSON
      let updatesJson = '';
      process.stdin.setEncoding('utf-8');
      process.stdin.on('data', chunk => updatesJson += chunk);
      process.stdin.on('end', () => {
        let updates = {};
        try { updates = JSON.parse(updatesJson); } catch {}
        const result = postWaveUpdate(dir, files, updates);
        console.log(JSON.stringify(result, null, 2));
        process.exit(result.success ? 0 : 1);
      });
      break;
    }

    case 'merge-worktree': {
      const root = args[1] || process.cwd();
      const branch = args[2];
      if (!branch) {
        console.error('Error: branch name required');
        process.exit(1);
      }
      const result = mergeWorktree(root, branch);
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    }

    case 'clean-orphans': {
      const root = args[1] || process.cwd();
      const result = cleanOrphans(root);
      console.log(JSON.stringify(result, null, 2));
      break;
    }

    case 'stash-check': {
      const root = args[1] || process.cwd();
      const result = stashCheck(root);
      console.log(JSON.stringify(result, null, 2));
      break;
    }

    case 'cwd-guard': {
      const root = args[1] || process.cwd();
      const result = cwdGuard(root);
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

module.exports = {
  determineRoute,
  archiveMilestone,
  postWaveUpdate,
  mergeWorktree,
  cleanOrphans,
  stashCheck,
  cwdGuard,
  listWorkstreams,
  listMilestones,
  getPhaseProgress,
  getWorkstreamProgress
};
