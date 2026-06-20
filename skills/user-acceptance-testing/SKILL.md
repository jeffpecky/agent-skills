# User Acceptance Testing

Conversational acceptance testing that validates the implementation meets the user's actual needs, not just technical specifications.

## When to Use

- After verification passes and the implementation is technically complete
- Before considering the task fully done
- When you need to confirm the user's intent was satisfied

## UAT Workflow

### 1. Prepare UAT Context

Before starting UAT, gather:

- The original SPEC.md (what was requested)
- The PLAN.md (what was planned)
- The verification results (what was verified)
- The actual implementation (what was built)

### 2. Conduct Conversational UAT

Ask the user targeted questions:

```
Let's verify the implementation meets your needs:

1. **Original Intent**: Does the implementation do what you originally asked for?
2. **Edge Cases**: Are there any scenarios you'd like me to test?
3. **Behavior**: Does the behavior match your expectations?
4. **Missing Features**: Is there anything you expected that isn't included?
5. **Approval**: Do you approve this implementation for use?
```

### 3. Record UAT Results

Create `tasks/reports/UAT.md`:

```markdown
# User Acceptance Testing Report

## Test Date
[Date]

## Original Request
[From SPEC.md]

## UAT Questions and Answers

### 1. Original Intent
**Question**: Does the implementation do what you originally asked for?
**Answer**: [User's response]
**Status**: PASS / FAIL

### 2. Edge Cases
**Question**: Are there any scenarios you'd like me to test?
**Answer**: [User's response]
**Status**: PASS / FAIL / N/A

### 3. Behavior
**Question**: Does the behavior match your expectations?
**Answer**: [User's response]
**Status**: PASS / FAIL

### 4. Missing Features
**Question**: Is there anything you expected that isn't included?
**Answer**: [User's response]
**Status**: PASS / FAIL

### 5. Approval
**Question**: Do you approve this implementation for use?
**Answer**: [User's response]
**Status**: APPROVED / REJECTED

## Overall Result
[PASS / FAIL]

## Action Items
- [Any items that need to be addressed before final approval]
```

### 4. Handle UAT Failures

If UAT fails:

1. Document the specific failures in the UAT report
2. Create action items to address the issues
3. Return to implementation phase to fix the issues
4. Re-run UAT after fixes are applied

### 5. Final Approval

Once UAT passes:

1. Update the UAT report with final approval
2. Mark the task as fully complete in STATE.md
3. Archive the implementation artifacts

## Integration with Pipeline

UAT is the final validation step before considering a task complete:

1. Planning → 2. Implementation → 3. Verification → 4. **UAT** → 5. Done

## UAT Template

Use this template for UAT sessions:

```markdown
# UAT Session: [Task Name]

## Context
- **Requested**: [Date]
- **Implemented**: [Date]
- **Verified**: [Date]

## Questions

1. Does this do what you asked?
2. Any edge cases to test?
3. Behavior as expected?
4. Missing anything?
5. Approved for use?

## Result
[PASS/FAIL]

## Notes
[Additional notes from the session]
```
