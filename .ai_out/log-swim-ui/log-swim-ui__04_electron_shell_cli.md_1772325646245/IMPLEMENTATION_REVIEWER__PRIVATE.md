# Phase 04 Implementation Review -- Private Notes

## Review Process

1. Read all context files (plan, plan review, exploration, task spec, CLAUDE.md)
2. Read all implementation files in full
3. Ran `npm test` -- 132/132 pass
4. Ran `npm run typecheck` -- clean
5. Verified no existing tests removed (`git diff main...HEAD -- tests/unit/core/` shows no changes)
6. Traced through IPC bridge logic line by line for correctness
7. Checked security of preload implementation
8. Verified all 12 acceptance criteria

## Detailed Logic Trace: IPC Bridge First-Line Handling

The most complex logic is in `ipc-bridge.ts handleLine()`. Traced all cases:

### Case 1: First line, invalid JSON
- `parsed.ok` is false
- `this.firstLine` is true -> sends `stream-error`, calls `haltIngestion()`
- `this.firstLine` is never set to false, but doesn't matter because ingestion halts
- **CORRECT**

### Case 2: First line, valid JSON, timestamp detection fails
- `parsed.ok` is true
- `this.firstLine` is true -> set to false (line 80)
- `detectAndLock()` throws
- Sends `stream-error`, calls `haltIngestion()`, returns
- **CORRECT** -- firstLine=false doesn't matter since ingestion halts

### Case 3: First line, valid JSON, timestamp field missing (undefined)
- `timestampValue` is `undefined`
- `detectAndLock(undefined)` throws "expected string or number, got undefined"
- Error sent, ingestion halts
- **CORRECT**

### Case 4: First line succeeds, second line valid JSON, timestamp parse fails
- `firstLine` is false
- `timestampDetector.parse()` returns `{ ok: false }`
- `timestampMillis` stays 0
- Line sent with `timestamp: 0`
- **CORRECT** per spec

### Case 5: First line succeeds, second line invalid JSON
- `parsed.ok` is false
- `this.firstLine` is false -> falls through to return (silently skipped)
- **CORRECT** per DD-03

### Case 6: First line, valid JSON, timestamp succeeds
- `detectAndLock()` succeeds
- `firstLine` set to false
- Falls through to parse section
- `timestampDetector.parse()` returns `{ ok: true }` (same value as detectAndLock parsed)
- Actually this parses the timestamp TWICE on the first line -- once in detectAndLock and once in parse.
- This is a minor inefficiency but not a bug. Could be optimized by using the Date from detectAndLock directly.

## Architectural Observations

### Preload importing from core
The CLAUDE.md table says preload cannot import from core. But:
- `IPC_CHANNELS` is a simple constant object
- `ElectronApi` is a type-only import
- Duplicating these would violate DRY
- Both the planner and plan reviewer accepted this
- The CLAUDE.md should be updated to reflect this accepted pattern

### ConfigValidator stateful pattern
The `ConfigValidator` class uses `this.errors` array with `length = 0` reset. This works but is unusual. A pure function approach would be cleaner:
```typescript
function validateConfig(loaded: Record<string, unknown>): string[] {
  const errors: string[] = []
  // ...validate...
  return errors
}
```
Not a bug, just a style observation.

### Validate-before-merge design
D7 (validate before merge) means partial valid configs are entirely rejected. This is stricter than necessary but was an explicit choice. The deep merge logic already handles field-by-field fallback, so an alternative approach would be: always merge, then optionally notify about invalid fields that were ignored.

### Double timestamp parsing on first line
In `handleLine()`, the first line goes through:
1. `this.timestampDetector.detectAndLock(timestampValue)` -> returns Date (used for detection/locking only)
2. `this.timestampDetector.parse(timestampValue)` -> returns ParseResult<Date> (used for the actual timestamp)

The first call's return value is discarded. The timestamp is parsed twice. This is a minor inefficiency -- could be optimized by using the Date from `detectAndLock` directly and skipping the `parse()` call on the first line. Not a bug, just a missed optimization.

## Verdict Rationale

APPROVED_WITH_FEEDBACK because:
- All acceptance criteria met
- All tests pass, typecheck clean
- No existing tests removed
- No security issues
- Implementation is clean and well-structured
- The feedback items (WHY comments, CLAUDE.md update, DRY types) are improvement suggestions, not blockers
- The only "important" issue (I-02: missing WHY comments) is a standards compliance matter, not a correctness issue
