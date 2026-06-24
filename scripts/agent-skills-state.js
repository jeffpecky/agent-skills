#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { acquireLock, releaseLock } = require('./agent-skills-lock.js');
const { atomicWriteFile, parseRoot } = require('./agent-skills-workspace.js');

const PHASES = ['none', 'spec', 'plan', 'build', 'verify', 'review', 'ship', 'done', 'blocked'];
const NEXT = {
  none: ['spec', 'blocked'],
  spec: ['plan', 'blocked'],
  plan: ['build', 'blocked'],
  build: ['verify', 'blocked'],
  verify: ['review', 'blocked'],
  review: ['ship', 'blocked'],
  ship: ['done', 'blocked'],
  done: [],
  blocked: ['spec', 'plan', 'build', 'verify', 'review', 'ship', 'done'],
};

function usage() {
  return [
    'Usage:',
    '  node scripts/agent-skills-state.js [--root <path>] init [--goal <text>]',
    '  node scripts/agent-skills-state.js [--root <path>] transition <phase>',
    '  node scripts/agent-skills-state.js [--root <path>] current [--json]',
    '  node scripts/agent-skills-state.js [--root <path>] validate',
  ].join('\n');
}

function statePath(cwd) {
  return path.join(cwd, 'tasks', 'STATE.md');
}

function parseFlag(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1) return null;
  return argv[index + 1] || '';
}

function readState(cwd) {
  const file = statePath(cwd);
  if (!fs.existsSync(file)) {
    return { current_phase: 'none', goal: '', target_root: path.resolve(cwd), last_activity: '' };
  }
  const text = fs.readFileSync(file, 'utf8');
  const state = { current_phase: 'none', goal: '', target_root: path.resolve(cwd), last_activity: '' };
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([a-z_]+):\s*(.*)$/);
    if (match) state[match[1]] = match[2];
  }
  return state;
}

function writeState(cwd, state) {
  const file = statePath(cwd);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const body = [
    '---',
    `current_phase: ${state.current_phase || 'none'}`,
    `goal: ${state.goal || ''}`,
    `target_root: ${path.resolve(cwd)}`,
    `last_activity: ${state.last_activity || new Date().toISOString()}`,
    '---',
    '',
    '# Project State',
    '',
    'This file is the lifecycle checkpoint for Agent Skills runs.',
    '',
    '## Resume',
    `- Current phase: ${state.current_phase || 'none'}`,
    `- Goal: ${state.goal || ''}`,
    `- Target root: ${path.resolve(cwd)}`,
    `- Last activity: ${state.last_activity || ''}`,
    '',
  ].join('\n');
  atomicWriteFile(file, body);
  return file;
}

function transition(cwd, nextPhase) {
  if (!PHASES.includes(nextPhase)) throw new Error(`Unknown phase: ${nextPhase}`);
  const state = readState(cwd);
  const current = state.current_phase || 'none';
  if (!(NEXT[current] || []).includes(nextPhase)) {
    throw new Error(`Invalid transition: ${current} -> ${nextPhase}`);
  }
  state.current_phase = nextPhase;
  state.last_activity = new Date().toISOString();
  return writeState(cwd, state);
}

function validate(cwd) {
  const state = readState(cwd);
  const errors = [];
  if (!PHASES.includes(state.current_phase)) errors.push(`Invalid current_phase: ${state.current_phase}`);
  if (path.resolve(state.target_root || '') !== path.resolve(cwd)) {
    errors.push(`STATE target_root does not match validation root: ${state.target_root || '(missing)'}`);
  }
  return errors;
}

function main() {
  const { root, args } = parseRoot(process.argv.slice(2), usage, { walkUp: commandlessWalkUp(process.argv.slice(2)) });
  const [command, ...rest] = args;
  if (!command) throw new Error(usage());

  if (command === 'init') {
    const cwd = root;
    // Ensure tasks directory exists before locking
    fs.mkdirSync(path.join(cwd, 'tasks'), { recursive: true });
    const file = statePath(cwd);
    const lockResult = acquireLock(file);
    if (!lockResult.success) {
      console.error('Error: Could not acquire lock:', lockResult.error);
      process.exit(1);
    }
    try {
      const result = writeState(cwd, {
        current_phase: 'none',
        goal: parseFlag(rest, '--goal') || '',
        last_activity: new Date().toISOString(),
      });
      process.stdout.write(`${result}\n`);
    } finally {
      releaseLock(file);
    }
    return;
  }

  if (command === 'transition') {
    const phase = rest[0];
    if (!phase) throw new Error(usage());
    const cwd = root;
    const file = statePath(cwd);
    const lockResult = acquireLock(file);
    if (!lockResult.success) {
      console.error('Error: Could not acquire lock:', lockResult.error);
      process.exit(1);
    }
    try {
      const result = transition(cwd, phase);
      process.stdout.write(`${result}\n`);
    } finally {
      releaseLock(file);
    }
    return;
  }

  if (command === 'current') {
    const state = readState(root);
    process.stdout.write(rest.includes('--json') ? `${JSON.stringify(state)}\n` : `${state.current_phase}\n`);
    return;
  }

  if (command === 'validate') {
    const errors = validate(root);
    if (errors.length) {
      process.stderr.write(errors.map(error => `ERROR: ${error}`).join('\n') + '\n');
      process.exit(1);
    }
    process.stdout.write('state validation passed\n');
    return;
  }

  throw new Error(usage());
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  }
}

function commandlessWalkUp(argv) {
  const command = argv.filter((arg, index) => {
    const prev = argv[index - 1];
    return arg !== '--root' && prev !== '--root';
  })[0];
  return command !== 'init';
}

module.exports = { readState, transition, validate, writeState };
