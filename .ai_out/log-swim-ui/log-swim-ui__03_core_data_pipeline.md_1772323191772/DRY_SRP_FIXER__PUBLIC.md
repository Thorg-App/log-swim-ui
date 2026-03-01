# DRY/SRP Review: Phase 03 Core Data Pipeline

## Summary

One DRY violation found and fixed. No SRP violations found. The codebase is well-structured with clean separation of concerns.

## DRY Analysis

### FIXED: Duplicated timestamp validation knowledge in `TimestampDetector`

**File**: `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/core/timestamp-detector.ts`

**Problem**: Two pieces of business knowledge were expressed twice -- once in `detectAndLock()` and once in `parse()`:

1. **"What is a valid epoch millis value?"** -- The range check `value > 0 && value < EPOCH_MILLIS_UPPER_BOUND` appeared in `detectAndLock()` and its logical inverse `value <= 0 || value >= EPOCH_MILLIS_UPPER_BOUND` appeared in `parse()`. If the valid range changed (e.g., adding a lower bound for reasonable timestamps), both locations would need updating.

2. **"How to parse an ISO 8601 string into a Date?"** -- The pattern `const time = Date.parse(value); if (!Number.isNaN(time)) { return new Date(time) }` appeared in both methods. If the parsing strategy changed (e.g., using a stricter ISO 8601 parser instead of `Date.parse`), both locations would need updating.

**Fix**: Extracted two private static methods as single sources of truth:

- `TimestampDetector.isValidEpochMillis(value: number): boolean` -- authoritative definition of valid epoch millis range
- `TimestampDetector.tryParseIso8601(value: string): Date | null` -- authoritative definition of ISO 8601 parsing

Both `detectAndLock()` and `parse()` now delegate to these methods. The knowledge lives in exactly one place.

### No other DRY violations found

Reviewed all cross-module knowledge:

| Candidate | Verdict |
|-----------|---------|
| `EPOCH_MILLIS_UPPER_BOUND` constant | Already single source in `timestamp-detector.ts` -- clean |
| `makeEntry()` test helpers across 3 test files | Different knowledge per test context (different parameters, different defaults) -- not a DRY violation |
| `ParseResult<T>` generic vs `ParsedLine` discriminated union | Different knowledge: generic result type vs JSON-parse-specific result -- not a DRY violation |
| Lane regex compilation in `createLaneDefinition` | Single location in `types.ts` -- clean |

## SRP Analysis

### No SRP violations found

Each module has exactly one reason to change:

| Module | Single Responsibility | Verdict |
|--------|----------------------|---------|
| `types.ts` | Domain model definitions | Clean -- types and their factory function are cohesive |
| `json-parser.ts` | Raw JSON string parsing | Clean -- one static class, one method, one concern |
| `timestamp-detector.ts` | Timestamp format detection and parsing | Clean -- two-phase lifecycle (detect then parse) is one cohesive concern |
| `lane-classifier.ts` | Entry-to-lane classification | Clean -- classify + reclassifyAll serve the same axis of change |
| `master-list.ts` | Sorted bounded collection | Clean -- insert, evict, and access are all part of sorted storage semantics |
| `log-buffer.ts` | Timer-based batching | Clean -- buffer, flush, and close lifecycle are one concern |
| `stdin-reader.ts` | Line-by-line stream reading | Clean -- thin wrapper around readline, single purpose |

No mixed responsibilities (modules doing unrelated things). No scattered responsibilities (one concept spread across multiple modules).

## Verification

| Check | Result |
|-------|--------|
| `npm test` | 75/75 tests passing (8 test files) |
| `npm run typecheck` | Clean, no errors |

## Files Modified

- `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/core/timestamp-detector.ts` -- Extracted `isValidEpochMillis()` and `tryParseIso8601()` private static methods
