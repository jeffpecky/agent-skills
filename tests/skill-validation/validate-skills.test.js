'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { spawnSync } = require('node:child_process');

const script = path.resolve(__dirname, '..', '..', 'scripts', 'validate-skills.js');

test('scripts/validate-skills.js runs successfully against the repository skills', () => {
  const result = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /skills checked/i);
});
