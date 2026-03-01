# DRY_SRP_FIXER Private State

## Analysis Approach

Read all 7 source files in `src/core/` and all 7 test files in `tests/unit/core/`. Mapped axes of change across all modules. Looked for:

1. **Knowledge duplication** (DRY) -- same business rule expressed in multiple places
2. **Mixed responsibilities** (SRP) -- one module with multiple reasons to change
3. **Scattered responsibilities** (SRP) -- one concept spread across multiple modules

## Detailed Findings

### DRY: TimestampDetector had duplicated validation knowledge

The `detectAndLock()` and `parse()` methods both contained inline implementations of:
- ISO 8601 parsing: `Date.parse(value)` + `Number.isNaN(time)` check + `new Date(time)` construction
- Epoch millis validation: range check against `(0, EPOCH_MILLIS_UPPER_BOUND)`

These are the same knowledge expressed differently for different control flow. Extracted to `tryParseIso8601()` and `isValidEpochMillis()` private static methods.

### DRY: `makeEntry` test helpers -- NOT a violation

Three test files have `makeEntry` helpers with different signatures:
- `lane-classifier.test.ts`: `makeEntry(rawJson, laneIndex)` -- needs specific rawJson for regex matching
- `master-list.test.ts`: `makeEntry(timestampMs, label)` -- needs specific timestamps for sort testing
- `log-buffer.test.ts`: `makeEntry(label)` -- just needs identifiable entries

These represent different test contexts with different needs. If the `LogEntry` interface changes, yes they all change -- but extracting a shared helper would require a kitchen-sink parameter signature that is worse than the duplication. The shared knowledge here is the `LogEntry` shape, which is already defined once in `types.ts`.

### SRP: All modules clean

No module had mixed or scattered responsibilities. The module boundaries align well with axes of change.

## Status

- Fix applied: 1 (TimestampDetector DRY fix)
- Tests: 75/75 passing
- Typecheck: Clean
