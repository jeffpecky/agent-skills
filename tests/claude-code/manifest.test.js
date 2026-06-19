'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..', '..');
const manifestPath = path.join(repoRoot, '.claude-plugin', 'plugin.json');

test('Claude plugin.json manifest exists and has valid JSON schema', () => {
  assert.ok(fs.existsSync(manifestPath), 'plugin.json must exist');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  assert.equal(typeof manifest.name, 'string', 'name must be a string');
  assert.equal(manifest.name, 'agent-skills', 'plugin name must be agent-skills');
  assert.equal(typeof manifest.description, 'string', 'description must be a string');
  assert.equal(manifest.commands, './.claude/commands', 'commands directory must be registered');
  assert.equal(manifest.skills, './skills', 'skills directory must be registered');
  assert.ok(Array.isArray(manifest.agents), 'agents must be an array');
});

test('Claude plugin.json declared agents exist on disk', () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  for (const agentPath of manifest.agents) {
    const fullPath = path.resolve(repoRoot, agentPath);
    assert.ok(fs.existsSync(fullPath), `declared agent file must exist: ${agentPath}`);
  }
});
