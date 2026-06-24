'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..', '..');
const skillPath = path.join(repoRoot, 'skills', 'using-agent-skills', 'SKILL.md');
const readmePath = path.join(repoRoot, 'README.md');
const skillsDir = path.join(repoRoot, 'skills');

test('using-agent-skills owns commandless orchestration', () => {
  const content = fs.readFileSync(skillPath, 'utf8');

  assert.match(content, /commandless orchestrator/i);
  assert.match(content, /The user should not need to run `\/spec`, `\/plan`, `\/build`, `\/test`, `\/review`, or `\/ship`/);
  assert.match(content, /Commandless Kernel Protocol/);
  assert.match(content, /agent-skills-state\.js init/);
  assert.match(content, /agent-skills-trace\.js pipeline\.started/);
  assert.match(content, /agent-skills-pipeline\.js validate/);
});

test('using-agent-skills defines conditional skill checkpoints', () => {
  const content = fs.readFileSync(skillPath, 'utf8');

  assert.match(content, /Conditional Skill Checkpoints/);
  assert.match(content, /debugging-and-error-recovery/);
  assert.match(content, /api-and-interface-design/);
  assert.match(content, /frontend-ui-engineering/);
  assert.match(content, /browser-testing-with-devtools/);
  assert.match(content, /security-and-hardening/);
  assert.match(content, /performance-optimization/);
});

test('README presents commandless mode before optional commands', () => {
  const content = fs.readFileSync(readmePath, 'utf8');
  const commandlessIndex = content.indexOf('## Commandless by Default');
  const commandsIndex = content.indexOf('## Optional Commands');

  assert.ok(commandlessIndex !== -1, 'README must document commandless mode');
  assert.ok(commandsIndex !== -1, 'README must mark commands as optional');
  assert.ok(commandlessIndex < commandsIndex, 'commandless mode should be documented before optional commands');
});

test('README skill count matches shipped skills', () => {
  const content = fs.readFileSync(readmePath, 'utf8');
  const skillCount = fs.readdirSync(skillsDir)
    .filter(name => fs.existsSync(path.join(skillsDir, name, 'SKILL.md')))
    .length;

  assert.match(content, new RegExp(`## All ${skillCount} Skills`));
  assert.match(content, new RegExp(`The pack includes ${skillCount} skills total`));
});

test('README does not link to missing skills', () => {
  const content = fs.readFileSync(readmePath, 'utf8');
  const links = [...content.matchAll(/\]\(skills\/([^/)]+)\/SKILL\.md\)/g)].map(match => match[1]);

  for (const skill of links) {
    assert.ok(
      fs.existsSync(path.join(skillsDir, skill, 'SKILL.md')),
      `README links to missing skill: ${skill}`
    );
  }
});

test('research is the single external research workflow', () => {
  const usingSkill = fs.readFileSync(skillPath, 'utf8');
  const researchSkill = fs.readFileSync(path.join(skillsDir, 'research', 'SKILL.md'), 'utf8');

  assert.equal(fs.existsSync(path.join(skillsDir, 'external-research', 'SKILL.md')), false);
  assert.doesNotMatch(usingSkill, /`external-research`/);
  assert.match(usingSkill, /research` with mode `external`/);
  assert.match(researchSkill, /Internal and external research are modes of this skill/);
});
