# Plan Review: Line Filtering for `tail -F` Output

## Executive Summary

The plan is **well-structured and sound**. It correctly identifies `IpcBridge.handleLine()` as the optimal insertion point, uses a simple regex pattern for filtering, and proposes comprehensive test coverage. The approach follows KISS and SRP principles. I have **one minor concern** about test file placement and **one suggestion** for the regex pattern edge case. Overall, the plan is ready for implementation with minor adjustments.

## Critical Issues (BLOCKERS)

None identified.

## Major Concerns

### 1. Test File Location May Need Adjustment

**Concern:** The plan proposes creating `tests/unit/main/ipc-bridge.test.ts`, but the existing test structure shows tests colocated with their corresponding source files in some cases (e.g., `tests/unit/core/json-parser.test.ts` tests `src/core/json-parser.ts`).

**Why:** The project has an established pattern: `tests/unit/{domain}/*.test.ts` mirrors `src/{domain}/*.ts`. However, looking at the existing tests:
- `tests/unit/main/cli-parser.test.ts` exists
- `tests/unit/main/config-manager.test.ts` exists

So `tests/unit/main/ipc-bridge.test.ts` is actually **consistent** with the existing pattern.

**Verdict:** No change needed - the proposed location is correct.

## Simplification Opportunities (PARETO)

### 1. Consider: Inline the helper function

**Current:** Create a private static method `shouldIgnoreLine()`.

**Alternative:** Inline the check directly in `handleLine()`:
```typescript
private handleLine(line: string): void {
  // Filter empty lines and tail -F separators
  const trimmed = line.trim()
  if (trimmed.length === 0 || TAIL_SEPARATOR_PATTERN.test(line)) {
    return
  }
  // ... rest
}
```

**Trade-off:** The named method provides documentation value and testability. Given the project's emphasis on explicit code and SRP, the named method is the better choice. **No change recommended.**

## Minor Suggestions

### 1. Regex Pattern Edge Case: Empty Filename

**Observation:** The pattern `/^==> .+ <==$/` requires at least one character between `==> ` and ` <==` (due to `.+`). This is correct behavior - `tail -F` will never output `==>  <==` (empty filename).

**Suggestion:** Add a comment explaining this is intentional:
```typescript
// tail -F separator: "==> filename <==" (.+ ensures filename is non-empty)
const TAIL_SEPARATOR_PATTERN = /^==> .+ <==$/
```

### 2. Test Coverage: Add a "valid JSON that looks like separator" Test

**Observation:** The edge case section mentions `==> test` (no trailing `<==`) should NOT be ignored. Consider adding an explicit test case for this to document the expected behavior.

**Suggested test:**
```typescript
describe('GIVEN a line that partially matches separator pattern', () => {
  describe('WHEN the line is "==> test" (no trailing <==)', () => {
    it('THEN it is NOT ignored (goes to JSON parser)', () => {
      // This line should reach JsonParser.parse(), not be filtered
    })
  })
})
```

### 3. Consider Exporting Pattern for Testing (Optional)

If you want to test the regex pattern directly (without going through `handleLine`), consider exporting the constant or making it package-private:
```typescript
/** @internal */
export const TAIL_SEPARATOR_PATTERN = /^==> .+$/
```

This is optional - testing through `handleLine` with a mock `IpcSender` is sufficient.

## Strengths

1. **Correct Architecture Decision:** Adding filtering to `IpcBridge.handleLine()` is the right choice - it's the orchestration layer and avoids polluting generic utilities.

2. **Clear Phase Breakdown:** The implementation phases are logical and sequential: helper function -> integration -> tests.

3. **Comprehensive Test Cases:** The BDD-style test structure covers all key scenarios:
   - First line separator (critical edge case)
   - Non-first line separator
   - Various filename formats
   - Empty/whitespace-only lines
   - Valid JSON after ignored lines

4. **Proper SRP Adherence:** The plan correctly identifies that `StdinReader` and `JsonParser` should remain generic and not include `tail -F` specific logic.

5. **Performance Consideration:** The O(1) filtering overhead note is appropriate and demonstrates awareness of the performance impact (actually improves performance by avoiding unnecessary JSON parsing).

6. **Clear Acceptance Criteria:** The 8 acceptance criteria are testable and complete.

7. **Regex Pattern is Correct:** The pattern `/^==> .+ <==$/` accurately matches `tail -F` separator output.

## Verdict

- [x] APPROVED WITH MINOR REVISIONS

**Recommendation:** The plan is ready for implementation. The suggested additions are minor documentation/test enhancements that can be incorporated during implementation without requiring a full plan iteration.

**PLAN_ITERATION:** Can be **skipped** - proceed directly to implementation. The plan is sound and the minor suggestions can be addressed inline during the coding phase.
