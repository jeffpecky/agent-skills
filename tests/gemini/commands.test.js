'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..', '..');
const commandsDir = path.join(repoRoot, '.gemini', 'commands');

function parseSimpleToml(content) {
  const result = {};
  for (const line of content.split(/\r?\n/)) {
    const clean = line.trim();
    if (!clean || clean.startsWith('#')) continue;
    const eq = clean.indexOf('=');
    if (eq === -1) continue;
    const key = clean.slice(0, eq).trim();
    const value = clean.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key) result[key] = value;
  }
  return result;
}

test('Gemini commands exist and have valid TOML schema', () => {
  assert.ok(fs.existsSync(commandsDir), 'gemini commands directory must exist');
  const files = fs.readdirSync(commandsDir).filter(name => name.endsWith('.toml'));
  assert.ok(files.length > 0, 'should have command toml files');

  for (const file of files) {
    const content = fs.readFileSync(path.join(commandsDir, file), 'utf8');
    const toml = parseSimpleToml(content);

    assert.ok(toml.description, `command file ${file} must have a description`);
    assert.ok(toml.description.length <= 1024, `command file ${file} description exceeds 1024 chars`);
  }
});
