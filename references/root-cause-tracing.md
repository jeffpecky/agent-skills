# Root Cause Tracing

## Overview

Bugs often manifest deep in the call stack (wrong directory, file created in wrong location, database opened with wrong path). Your instinct is to fix where the error appears, but that's treating a symptom.

**Core principle:** Trace backward through the call chain until you find the original trigger, then fix at the source.

## When to Use

- Error happens deep in execution (not at entry point)
- Stack trace shows long call chain
- Unclear where invalid data originated
- Need to find which test/code triggers the problem

## The Tracing Process

### 1. Observe the Symptom
```
Error: Cannot read property 'name' of undefined
  at UserService.getDisplayName (user.service.ts:45)
```

### 2. Find Immediate Cause
**What code directly causes this?**
```typescript
function getDisplayName(user: User): string {
  return user.name.toUpperCase(); // user is undefined
}
```

### 3. Ask: What Called This?
```typescript
ProfileComponent.render (profile.tsx:23)
  → called by React re-render
  → triggered by state update
  → state.user set in componentDidMount
  → data from API response
```

### 4. Keep Tracing Up
**What value was passed?**
- `user = undefined`
- Where does `this.state.user` get set?
- In componentDidMount, from API response

### 5. Find Original Trigger
**Where did undefined come from?**
```typescript
// API returns { data: { user: {...} } }
// But code expects { user: {...} }
const { user } = response; // user is undefined!
const { user } = response.data; // correct
```

**Root cause:** API response structure changed, component wasn't updated.

## Adding Stack Traces

When you can't trace manually, add instrumentation:

```typescript
// Before the problematic operation
async function processUser(userId: string) {
  const stack = new Error().stack;
  console.error('DEBUG processUser:', {
    userId,
    timestamp: new Date().toISOString(),
    stack,
  });

  const user = await userService.findById(userId);
  // ...
}
```

**Critical:** Use `console.error()` in tests (not logger — logger may be suppressed)

**Run and capture:**
```bash
npm test 2>&1 | grep 'DEBUG processUser'
```

**Analyze stack traces:**
- Look for test file names
- Find the line number triggering the call
- Identify the pattern (same test? same parameter?)

## Finding Which Test Causes Pollution

If something appears during tests but you don't know which test:

```bash
# Run tests one by one to find the polluter
npm test -- --runInBand --testPathPattern="specific-file"
```

## Common Data Flow Bugs

| Pattern | How to Trace |
|---------|-------------|
| API response shape changed | Compare API contract vs actual response |
| Null/undefined propagating | Add null checks at each layer, find first null |
| Type mismatch | Check what's passed vs what's expected at each boundary |
| Race condition | Add timestamps, check ordering of async operations |
| Stale closure | Check if function captures old value from previous render |
| Wrong default value | Check where default is set and if it's correct |

## Defense in Depth

After finding root cause, add validation at each layer:

```
Layer 1: Input validation (reject bad data early)
Layer 2: Business logic validation (check invariants)
Layer 3: Output validation (verify before returning)
Layer 4: Logging (capture state for debugging)
```

**Key Principle:**

```
Found immediate cause
    → Can trace one level up?
        → YES: Trace backwards
        → NO: Fix at source
    → Is this the source?
        → NO: Keep tracing
        → YES: Fix at source + add validation at each layer
```

**NEVER fix just where the error appears.** Trace back to find the original trigger.

## Stack Trace Tips

- **In tests:** Use `console.error()` not logger — logger may be suppressed
- **Before operation:** Log before the dangerous operation, not after it fails
- **Include context:** Directory, cwd, environment variables, timestamps
- **Capture stack:** `new Error().stack` shows complete call chain
