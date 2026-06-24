#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function isRootMarker(dir) {
  return fs.existsSync(path.join(dir, 'tasks', 'STATE.md'))
    || fs.existsSync(path.join(dir, 'tasks', 'trace.jsonl'))
    || fs.existsSync(path.join(dir, 'SPEC.md'));
}

function findWorkspaceRoot(startDir = process.cwd()) {
  let current = path.resolve(startDir);
  while (true) {
    if (isRootMarker(current)) return current;
    const parent = path.dirname(current);
    if (parent === current) return path.resolve(startDir);
    current = parent;
  }
}

function parseRoot(argv, usage, options = {}) {
  const rootIdx = argv.indexOf('--root');
  if (rootIdx !== -1) {
    const root = argv[rootIdx + 1];
    if (!root) throw new Error(usage());
    return {
      root: path.resolve(root),
      args: argv.filter((_, index) => index !== rootIdx && index !== rootIdx + 1),
    };
  }

  const base = options.walkUp === false ? process.cwd() : findWorkspaceRoot(process.cwd());
  return { root: base, args: argv };
}

function atomicWriteFile(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, filePath);
}

module.exports = { atomicWriteFile, findWorkspaceRoot, parseRoot };
