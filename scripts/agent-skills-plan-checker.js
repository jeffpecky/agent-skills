#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Plan Checker: semantic validation of plans across 12 dimensions.
 * Goes beyond "file exists" to validate "plan makes sense".
 */

const DIMENSIONS = [
  {
    id: 'objective',
    name: 'Objective Clarity',
    description: 'Does the plan have a clear goal or objective?',
    severity: 'high',
    check: (plan) => {
      const hasObjective = /(?:# Goal|# Objective|## Goal|## Objective|## What|## Summary)/i.test(plan);
      const hasContent = /(?:Goal|Objective|Summary)[:\s].{20,}/i.test(plan);
      return { pass: hasObjective && hasContent, detail: hasObjective ? (hasContent ? 'Goal defined with detail' : 'Goal section exists but lacks detail') : 'No goal/objective section found' };
    }
  },
  {
    id: 'file_scope',
    name: 'File Scope',
    description: 'Are all files that will be modified listed?',
    severity: 'medium',
    check: (plan) => {
      const hasFiles = /(?:files?|touches?|modifies?|creates?|updates?):/i.test(plan);
      const fileList = plan.match(/(?:^- `?[a-zA-Z0-9_/]+\.\w+`?\s*$)/gm);
      const fileCount = fileList ? fileList.length : 0;
      return { pass: hasFiles || fileCount > 0, detail: hasFiles ? `File references found (${fileCount} files listed)` : 'No file scope declared', fileCount };
    }
  },
  {
    id: 'decisions',
    name: 'Decision Coverage',
    description: 'Are architectural decisions acknowledged?',
    severity: 'medium',
    check: (plan) => {
      const hasDecisions = /(?:decision|choice|trade-?off|alternatives?|approach|rationale)/i.test(plan);
      return { pass: hasDecisions, detail: hasDecisions ? 'Architecture decisions acknowledged' : 'No decision rationale found' };
    }
  },
  {
    id: 'shared_data',
    name: 'Shared Data Paths',
    description: 'Does the plan reference correct shared data locations?',
    severity: 'medium',
    check: (plan) => {
      const hasDataRefs = /(?:tasks\/|\.planning\/|config\.json|STATE\.md|PLAN\.md)/i.test(plan);
      return { pass: hasDataRefs, detail: hasDataRefs ? 'Shared data paths referenced' : 'No shared data path references found' };
    }
  },
  {
    id: 'conventions',
    name: 'Convention Compliance',
    description: 'Does the plan follow project conventions?',
    severity: 'low',
    check: (plan) => {
      const hasConventions = /(?:convention|standard|pattern|style|guideline|CLAUDE\.md|AGENTS\.md)/i.test(plan);
      return { pass: hasConventions, detail: hasConventions ? 'Project conventions acknowledged' : 'No convention references found' };
    }
  },
  {
    id: 'test_coverage',
    name: 'Test Coverage',
    description: 'Does the plan include verification steps?',
    severity: 'high',
    check: (plan) => {
      const hasTests = /(?:test|verify|validate|assert|check|lint|typecheck)/i.test(plan);
      const hasTestCommand = /(?:npm run test|node --test|jest|vitest|pytest|cargo test)/i.test(plan);
      return { pass: hasTests, detail: hasTests ? (hasTestCommand ? 'Test commands specified' : 'Test steps mentioned but no commands') : 'No test/verification steps found' };
    }
  },
  {
    id: 'dependencies',
    name: 'Dependency Correctness',
    description: 'Are all dependencies between tasks declared?',
    severity: 'high',
    check: (plan) => {
      const hasDeps = /(?:depends?|dependency|prerequisite|after|requires?|blocked by)/i.test(plan);
      const hasOrdering = /(?:step \d|phase \d|first|then|next|finally)/i.test(plan);
      return { pass: hasDeps || hasOrdering, detail: hasDeps ? 'Dependencies explicitly declared' : (hasOrdering ? 'Ordering implied but not explicit' : 'No dependency information found') };
    }
  },
  {
    id: 'risks',
    name: 'Risk Identification',
    description: 'Are risks acknowledged?',
    severity: 'low',
    check: (plan) => {
      const hasRisks = /(?:risk|caveat|warning|edge case|gotcha|limitation|trade-?off)/i.test(plan);
      return { pass: hasRisks, detail: hasRisks ? 'Risks acknowledged' : 'No risk identification found' };
    }
  },
  {
    id: 'acceptance',
    name: 'Acceptance Criteria',
    description: 'Are success conditions explicit?',
    severity: 'high',
    check: (plan) => {
      const hasAcceptance = /(?:acceptance|success|done when|passes?|completes?| criteria)/i.test(plan);
      const hasChecklist = /(?:^- \[[ x]\])/m.test(plan);
      return { pass: hasAcceptance || hasChecklist, detail: hasAcceptance ? 'Acceptance criteria defined' : (hasChecklist ? 'Checklist found' : 'No acceptance criteria found') };
    }
  },
  {
    id: 'waves',
    name: 'Wave Assignment',
    description: 'Are parallel tasks correctly grouped?',
    severity: 'medium',
    check: (plan) => {
      const hasWaves = /(?:wave|parallel|concurrent|simultaneous)/i.test(plan);
      const hasFrontmatter = /^---\n[\s\S]*?wave:[\s\S]*?---/m.test(plan);
      return { pass: hasWaves || hasFrontmatter, detail: hasWaves ? 'Wave/parallel strategy defined' : 'No wave assignment found', hasFrontmatter };
    }
  },
  {
    id: 'checkpoints',
    name: 'Checkpoint Placement',
    description: 'Are stopping points appropriate?',
    severity: 'medium',
    check: (plan) => {
      const hasCheckpoints = /(?:checkpoint|stop|pause|review|gate|human review)/i.test(plan);
      return { pass: hasCheckpoints, detail: hasCheckpoints ? 'Checkpoints defined' : 'No checkpoint/stop points found' };
    }
  },
  {
    id: 'wiring',
    name: 'Cross-Phase Wiring',
    description: 'Does this phase connect to previous/next phases?',
    severity: 'low',
    check: (plan) => {
      const hasWiring = /(?:previous|next|handoff|carry.?over|inherits?|continues?|builds? on)/i.test(plan);
      return { pass: hasWiring, detail: hasWiring ? 'Cross-phase wiring found' : 'No cross-phase references found' };
    }
  }
];

function loadPlan(projectRoot) {
  const candidates = [
    path.join(projectRoot, 'tasks', 'plan.md'),
    path.join(projectRoot, 'tasks', 'PLAN.md')
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return { path: p, content: fs.readFileSync(p, 'utf-8') };
    }
  }
  return null;
}

function loadSpec(projectRoot) {
  const candidates = [
    path.join(projectRoot, 'tasks', 'spec.md'),
    path.join(projectRoot, 'tasks', 'SPEC.md'),
    path.join(projectRoot, 'spec.md')
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return { path: p, content: fs.readFileSync(p, 'utf-8') };
    }
  }
  return null;
}

function validatePlan(projectRoot) {
  const plan = loadPlan(projectRoot);
  if (!plan) {
    return { valid: false, error: 'No plan found', dimensions: [] };
  }

  const spec = loadSpec(projectRoot);
  const results = [];
  let passCount = 0;
  let highFailCount = 0;

  for (const dim of DIMENSIONS) {
    const result = dim.check(plan.content, spec ? spec.content : null);
    results.push({
      id: dim.id,
      name: dim.name,
      severity: dim.severity,
      pass: result.pass,
      detail: result.detail,
      ...(result.fileCount !== undefined && { fileCount: result.fileCount }),
      ...(result.hasFrontmatter !== undefined && { hasFrontmatter: result.hasFrontmatter })
    });
    if (result.pass) passCount++;
    if (!result.pass && dim.severity === 'high') highFailCount++;
  }

  const score = Math.round((passCount / DIMENSIONS.length) * 100);
  const valid = highFailCount === 0 && score >= 60;

  return {
    valid,
    score,
    passCount,
    totalDimensions: DIMENSIONS.length,
    highFailCount,
    dimensions: results,
    planPath: plan.path
  };
}

function formatReport(result) {
  const lines = [];
  lines.push(`Plan Validation: ${result.valid ? 'PASS' : 'FAIL'} (${result.score}%)`);
  lines.push(`${result.passCount}/${result.totalDimensions} dimensions pass`);
  if (result.highFailCount > 0) {
    lines.push(`${result.highFailCount} HIGH severity failures`);
  }
  lines.push('');

  for (const dim of result.dimensions) {
    const icon = dim.pass ? '✓' : (dim.severity === 'high' ? '✗' : '~');
    const sev = dim.severity.toUpperCase();
    lines.push(`  ${icon} [${sev}] ${dim.name}: ${dim.detail}`);
  }

  return lines.join('\n');
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const projectRoot = args[1] || process.cwd();

  if (!command) {
    console.log('Usage: node agent-skills-plan-checker.js <command> [project-root]');
    console.log('Commands: validate, report');
    process.exit(1);
  }

  switch (command) {
    case 'validate': {
      const result = validatePlan(projectRoot);
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.valid ? 0 : 1);
    }
    case 'report': {
      const result = validatePlan(projectRoot);
      console.log(formatReport(result));
      process.exit(result.valid ? 0 : 1);
    }
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { validatePlan, formatReport, DIMENSIONS };
