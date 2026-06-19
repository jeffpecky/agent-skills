'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..', '..');
const commandsDir = path.join(repoRoot, '.claude', 'commands');

function parseFrontmatter(content) {
  const match = content.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n/);
  if (!match) return null;

  const result = {};
  for (const line of match[1].split(/\r?\n/)) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key   = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key) result[key] = value;
  }
  return result;
}

test('Claude commands have valid description frontmatter', () => {
  assert.ok(fs.existsSync(commandsDir), 'commands directory must exist');
  const files = fs.readdirSync(commandsDir).filter(name => name.endsWith('.md'));
  assert.ok(files.length > 0, 'should have command markdown files');

  for (const file of files) {
    const content = fs.readFileSync(path.join(commandsDir, file), 'utf8');
    const fm = parseFrontmatter(content);
    assert.ok(fm, `command file ${file} must have frontmatter`);
    assert.ok(fm.description, `command file ${file} missing description`);
    assert.ok(fm.description.length <= 1024, `command file ${file} description exceeds 1024 chars`);
  }
});
