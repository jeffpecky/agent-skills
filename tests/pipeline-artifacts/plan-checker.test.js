'use strict';
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

const { validatePlan, formatReport, DIMENSIONS } = require('../../scripts/agent-skills-plan-checker.js');

describe('Plan Checker', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-checker-test-'));
    fs.mkdirSync(path.join(tmpDir, 'tasks'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('validatePlan', () => {
    it('should fail when no plan exists', () => {
      const result = validatePlan(tmpDir);
      assert.equal(result.valid, false);
      assert.equal(result.error, 'No plan found');
    });

    it('should pass a comprehensive plan', () => {
      const plan = `# Goal
Implement a user authentication system with JWT tokens.

## Files
- \`src/auth.js\` - Authentication logic
- \`src/routes.js\` - API routes
- \`tests/auth.test.js\` - Tests

## Architecture Decisions
We chose JWT over session-based auth because:
- Stateless, scales horizontally
- No server-side storage needed

## Shared Data
Uses \`tasks/STATE.md\` for pipeline state and \`config.json\` for settings.

## Conventions
Follows project CLAUDE.md conventions for error handling.

## Dependencies
- Step 1: Implement auth.js (no dependencies)
- Step 2: Add routes (depends on Step 1)
- Step 3: Write tests (depends on Steps 1-2)

## Risks
- Edge case: expired refresh tokens
- Gotcha: CORS configuration for cross-origin requests

## Acceptance Criteria
- [ ] Login returns JWT token
- [ ] Protected routes reject unauthenticated requests
- [ ] Token refresh works correctly

## Verification
Run \`node --test tests/auth.test.js\` to verify all tests pass.

## Waves
Wave 1: auth.js
Wave 2: routes.js (parallel with tests)
Wave 3: integration verification

## Checkpoints
After Step 2: Human review of route design
After all: Final verification gate

## Cross-Phase Wiring
This phase builds on the existing database schema from Phase 1.
`;

      fs.writeFileSync(path.join(tmpDir, 'tasks', 'plan.md'), plan);
      const result = validatePlan(tmpDir);
      assert.equal(result.valid, true);
      assert.ok(result.score >= 70);
      assert.equal(result.highFailCount, 0);
    });

    it('should detect missing objective', () => {
      const plan = `# Tasks
- Do stuff
- Do more stuff
`;
      fs.writeFileSync(path.join(tmpDir, 'tasks', 'plan.md'), plan);
      const result = validatePlan(tmpDir);
      const objDim = result.dimensions.find(d => d.id === 'objective');
      assert.equal(objDim.pass, false);
    });

    it('should detect missing tests', () => {
      const plan = `# Goal
Build something cool.

## Steps
1. Write code
2. Deploy
`;
      fs.writeFileSync(path.join(tmpDir, 'tasks', 'plan.md'), plan);
      const result = validatePlan(tmpDir);
      const testDim = result.dimensions.find(d => d.id === 'test_coverage');
      assert.equal(testDim.pass, false);
    });

    it('should detect missing acceptance criteria', () => {
      const plan = `# Goal
Build something.

## Steps
1. Code it
`;
      fs.writeFileSync(path.join(tmpDir, 'tasks', 'plan.md'), plan);
      const result = validatePlan(tmpDir);
      const accDim = result.dimensions.find(d => d.id === 'acceptance');
      assert.equal(accDim.pass, false);
    });

    it('should detect missing dependencies', () => {
      const plan = `# Goal
Build something.

## Steps
Do task A, do task B, do task C.
`;
      fs.writeFileSync(path.join(tmpDir, 'tasks', 'plan.md'), plan);
      const result = validatePlan(tmpDir);
      const depDim = result.dimensions.find(d => d.id === 'dependencies');
      assert.equal(depDim.pass, false);
    });

    it('should fail when HIGH severity dimensions fail', () => {
      const plan = `# Goal
Build something.

## Steps
Do stuff
`;
      fs.writeFileSync(path.join(tmpDir, 'tasks', 'plan.md'), plan);
      const result = validatePlan(tmpDir);
      assert.equal(result.valid, false);
      assert.ok(result.highFailCount > 0);
    });

    it('should return all 12 dimensions', () => {
      const plan = `# Goal
Test plan.
`;
      fs.writeFileSync(path.join(tmpDir, 'tasks', 'plan.md'), plan);
      const result = validatePlan(tmpDir);
      assert.equal(result.dimensions.length, 12);
      assert.equal(DIMENSIONS.length, 12);
    });

    it('should handle old format plans without frontmatter', () => {
      const plan = `# Goal
Old format plan.

## Files
- src/foo.js

## Dependencies
- Task 1 after Task 2

## Verification
Run tests.
`;
      fs.writeFileSync(path.join(tmpDir, 'tasks', 'plan.md'), plan);
      const result = validatePlan(tmpDir);
      assert.ok(result.score > 0);
    });
  });

  describe('formatReport', () => {
    it('should format a passing report', () => {
      const result = {
        valid: true,
        score: 83,
        passCount: 10,
        totalDimensions: 12,
        highFailCount: 0,
        dimensions: [
          { id: 'objective', name: 'Objective Clarity', severity: 'high', pass: true, detail: 'Goal defined' },
          { id: 'risks', name: 'Risk Identification', severity: 'low', pass: false, detail: 'No risks found' }
        ]
      };
      const report = formatReport(result);
      assert.ok(report.includes('PASS'));
      assert.ok(report.includes('83%'));
      assert.ok(report.includes('✓'));
      assert.ok(report.includes('~'));
    });

    it('should format a failing report', () => {
      const result = {
        valid: false,
        score: 33,
        passCount: 4,
        totalDimensions: 12,
        highFailCount: 2,
        dimensions: [
          { id: 'objective', name: 'Objective Clarity', severity: 'high', pass: false, detail: 'No goal' },
          { id: 'tests', name: 'Test Coverage', severity: 'high', pass: false, detail: 'No tests' }
        ]
      };
      const report = formatReport(result);
      assert.ok(report.includes('FAIL'));
      assert.ok(report.includes('2 HIGH'));
      assert.ok(report.includes('✗'));
    });
  });
});
