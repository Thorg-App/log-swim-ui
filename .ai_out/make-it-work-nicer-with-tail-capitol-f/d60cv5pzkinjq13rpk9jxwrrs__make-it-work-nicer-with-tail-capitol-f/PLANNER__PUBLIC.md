# Implementation Plan: Line Filtering for `tail -F` Output

## Problem Statement

When using `tail -F some-file | log-swim-ui`, the output includes:
1. Valid JSONL lines (desired)
2. Separator lines like `==> vsc_client.2026_03_01.log <==` (should be ignored)
3. Empty lines (should be ignored)

Currently, these non-JSON lines are passed to `JsonParser.parse()`, which fails. For non-first lines, this is silently skipped. However, this creates unnecessary processing and could cause issues if the first line happens to be a separator.

## High-Level Architecture

```
stdin -> StdinReader.start() -> onLine(line)
  -> IpcBridge.handleLine(line)
    -> [NEW] shouldIgnoreLine(line) ? early return
    -> JsonParser.parse(line) -> process/send
```

**Implementation Location:** `IpcBridge.handleLine()` in `src/main/ipc-bridge.ts`

**Why IpcBridge?**
- It's the orchestration layer connecting reading -> parsing -> processing
- Single place to add filtering logic (KISS)
- Handles "first line is separator" case properly (won't cause false error)
- Does not violate SRP of `StdinReader` (generic utility) or `JsonParser` (JSON-specific)

## Implementation Phases

### Phase 1: Add Line Filtering Helper Function

**Goal:** Create a pure helper function to identify ignorable lines.

**Components Affected:** `src/main/ipc-bridge.ts`

**Key Steps:**
1. Add a private static method `shouldIgnoreLine(line: string): boolean` to `IpcBridge` class
2. Define the regex pattern for `tail -F` separators: `/^==> .+ <==$/`
3. Include logic for empty lines after trimming: `line.trim().length === 0`

**Code Changes:**

```typescript
// Add to IpcBridge class
/**
 * Filter out non-JSON lines that should be ignored.
 * - tail -F separator lines: "==> filename <=="
 * - Empty lines (after trimming whitespace)
 */
private static shouldIgnoreLine(line: string): boolean {
  // Empty line check
  if (line.trim().length === 0) {
    return true
  }

  // tail -F separator pattern: "==> filename <=="
  if (TAIL_SEPARATOR_PATTERN.test(line)) {
    return true
  }

  return false
}
```

```typescript
// Add constant at top of file (after imports)
const TAIL_SEPARATOR_PATTERN = /^==> .+ <==$/
```

### Phase 2: Integrate Filtering into handleLine()

**Goal:** Call the filter at the start of `handleLine()` before JSON parsing.

**Components Affected:** `src/main/ipc-bridge.ts`

**Key Steps:**
1. Add `shouldIgnoreLine()` check at the very beginning of `handleLine()`
2. Return early if the line should be ignored
3. This ensures ignored lines are never passed to `JsonParser.parse()`

**Code Changes:**

```typescript
private handleLine(line: string): void {
  // NEW: Filter out tail -F separators and empty lines
  if (IpcBridge.shouldIgnoreLine(line)) {
    return
  }

  const parsed = JsonParser.parse(line)
  // ... rest of existing logic
}
```

### Phase 3: Add Unit Tests

**Goal:** Verify the filtering logic with comprehensive test cases.

**Components Affected:** `tests/unit/main/ipc-bridge.test.ts` (new file)

**Key Steps:**
1. Create new test file for IpcBridge
2. Test the `shouldIgnoreLine` behavior through the public interface
3. Create a mock `IpcSender` and verify lines are filtered correctly

**Test Cases (BDD Style):**

```typescript
describe('IpcBridge', () => {
  describe('GIVEN a tail -F separator line', () => {
    describe('WHEN processed as the first line', () => {
      it('THEN it is silently ignored (no STREAM_ERROR)', () => {
        // Test: "==> somefile.log <==" as first line
        // Expect: no STREAM_ERROR sent, no LOG_LINE sent
      })
    })

    describe('WHEN processed as a non-first line', () => {
      it('THEN it is silently ignored (no LOG_LINE)', () => {
        // Test: valid JSON first, then separator
        // Expect: only the valid JSON line is sent
      })
    })

    describe('WHEN the separator has various filenames', () => {
      it('THEN all variations are ignored', () => {
        // Test: "==> file.log <==", "==> /path/to/file.log <==", etc.
      })
    })
  })

  describe('GIVEN an empty line', () => {
    describe('WHEN processed', () => {
      it('THEN it is silently ignored', () => {
        // Test: empty string ""
      })
    })

    describe('WHEN the line has only whitespace', () => {
      it('THEN it is silently ignored', () => {
        // Test: "   ", "\t", "  \n  "
      })
    })
  })

  describe('GIVEN a valid JSON line after ignored lines', () => {
    describe('WHEN processed', () => {
      it('THEN the valid JSON is processed correctly', () => {
        // Test: separator -> empty -> valid JSON
        // Expect: valid JSON is sent as LOG_LINE
      })
    })
  })
})
```

## Technical Considerations

### Regex Pattern
- Pattern: `/^==> .+ <==$/`
- `^==> ` - starts with literal `==> ` (note the space)
- `.+` - one or more of any character (the filename)
- ` <==$` - ends with literal ` <==` (note the space)
- No need for case-insensitive flag

### Edge Cases
1. **First line is a separator:** Should be ignored without triggering `STREAM_ERROR`
2. **Consecutive ignored lines:** All should be silently skipped
3. **Whitespace-only lines:** Should be treated as empty and ignored
4. **Lines that look like separators but aren't:** e.g., `==> test` (no trailing `<==`) - should NOT be ignored (will fail JSON parse and be silently skipped as non-first line)

### Performance
- The filtering check is O(1) - a simple regex test and trim
- This is a negligible overhead compared to JSON parsing
- Actually improves performance by avoiding unnecessary JSON parsing

## Testing Strategy

### Unit Tests
- Test `shouldIgnoreLine` behavior directly if made package-private for testing
- Test the full `handleLine` flow with a mock `IpcSender`

### Integration Test
- Manual test: `echo -e '==> test.log <==\n{"level":"info","message":"test"}' | log-swim-ui`
- Expected: Only the JSON line appears in the UI

## Acceptance Criteria

1. **AC1:** `tail -F` separator lines matching `^==> .+ <==$` are silently ignored
2. **AC2:** Empty lines (after trimming) are silently ignored
3. **AC3:** First line being a separator does NOT cause a stream error
4. **AC4:** Valid JSON lines after ignored lines are processed correctly
5. **AC5:** Unit tests pass with 100% coverage of new code paths
6. **AC6:** `npm run typecheck` passes with no errors
7. **AC7:** `npm run build` succeeds
8. **AC8:** Existing tests continue to pass

## Files Modified

| File | Change |
|------|--------|
| `src/main/ipc-bridge.ts` | Add `TAIL_SEPARATOR_PATTERN` constant, `shouldIgnoreLine()` method, early return in `handleLine()` |
| `tests/unit/main/ipc-bridge.test.ts` | New file - unit tests for filtering behavior |

## Estimated Complexity

**THINK** - Simple, well-understood problem. Estimated implementation time: 30-60 minutes.
