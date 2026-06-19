#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function usage() {
  return 'Usage: node tests/pipeline-artifacts/trace-event.js <event> [key=value ...]';
}

function parseValue(raw) {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw !== '' && /^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  return raw;
}

function parseArgs(argv) {
  const [event, ...pairs] = argv;
  if (!event) {
    throw new Error(usage());
  }

  const record = {
    ts: new Date().toISOString(),
    event,
  };

  for (const pair of pairs) {
    const eq = pair.indexOf('=');
    if (eq === -1 || eq === 0) {
      throw new Error(`Invalid key=value argument: ${pair}`);
    }
    const key = pair.slice(0, eq);
    const value = pair.slice(eq + 1);
    if (key === 'ts' || key === 'event') {
      throw new Error(`Reserved trace field cannot be set: ${key}`);
    }
    record[key] = parseValue(value);
  }

  return record;
}

function appendTrace(cwd, record) {
  const tasksDir = path.join(cwd, 'tasks');
  fs.mkdirSync(tasksDir, { recursive: true });
  const tracePath = path.join(tasksDir, 'trace.jsonl');
  fs.appendFileSync(tracePath, `${JSON.stringify(record)}\n`, 'utf8');
  return tracePath;
}

function main() {
  const record = parseArgs(process.argv.slice(2));
  const tracePath = appendTrace(process.cwd(), record);
  process.stdout.write(`${tracePath}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  }
}

module.exports = { appendTrace, parseArgs };
