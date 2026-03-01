# Phase 6A Implementation: Core Filter Types, Logic, and Unit Tests

## Status: COMPLETE

## What Was Implemented

Phase 6A delivers the pure filter logic module with full unit test coverage. No React or Electron dependencies -- pure TypeScript logic in `src/core/`.

### New Files

| File | Purpose |
|------|---------|
| `src/core/filter.ts` | `FilterEngine` static class + `Filter` discriminated union types |
| `tests/unit/core/filter.test.ts` | 27 BDD-style unit tests for filter logic |

### No Modified Files

Phase 6A is additive only. No existing files were modified.

## Design Decisions

### 1. Discriminated Union for Filter Types
Used `FieldFilter | RawFilter` discriminated union (per plan + review approval). Enforces at compile time that `field` is present when `type === 'field'`. Aligns with project principle: "compile-time checks over runtime."

### 2. Private Static ID Counter
Placed the filter ID counter as `private static nextId = 0` on `FilterEngine` class (per plan review point #5). Added `resetIdCounter()` method for test isolation.

### 3. Invalid Regex Handling
- `matchesFilter` returns `false` for filters with `regex === null` (invalid regex never matches).
- `matchesAllFilters` skips filters with `regex === null` (invalid filters do not block entries).
- This means an invalid filter is effectively inert -- it exists in the UI but does not affect results.

### 4. Field Value Coercion
Field filter extracts `String(entry.fields[field] ?? '')` -- coerces any field value to string before regex test. Missing fields become empty string. This is tested for numeric values (e.g., `status: 500` matches pattern `"500"`).

### 5. `as const` Pattern for Filter Types
Used `FILTER_TYPES = ['field', 'raw'] as const` with derived `FilterType` -- follows project convention (no enums).

## API Summary

```typescript
// Types
type Filter = FieldFilter | RawFilter

// Factory methods
FilterEngine.createFieldFilter(field: string, pattern: string): FieldFilter
FilterEngine.createRawFilter(pattern: string): RawFilter

// Operations
FilterEngine.toggleFilter(filter: Filter): Filter
FilterEngine.matchesFilter(entry: LogEntry, filter: Filter): boolean
FilterEngine.matchesAllFilters(entry: LogEntry, filters: readonly Filter[]): boolean

// Test utility
FilterEngine.resetIdCounter(): void
```

## Test Results

```
Test Files  15 passed (15)
     Tests  207 passed (207) -- including 27 new filter tests
  Duration  194ms
```

All existing tests continue to pass. Typecheck passes.

## Test Coverage (27 tests)

| Area | Count | Scenarios |
|------|-------|-----------|
| createRawFilter | 3 | valid regex, invalid regex, unique IDs |
| createFieldFilter | 2 | valid regex, invalid regex |
| toggleFilter | 3 | enable->disable, disable->enable, preserves properties |
| matchesFilter | 8 | raw match/no-match, field match/no-match, missing field, null regex, complex regex, numeric coercion |
| matchesAllFilters | 8 | vacuous truth, AND both match, AND one fails, disabled skipped, null regex skipped, all disabled, mixed types match, mixed types fail |
| resetIdCounter | 1 | resets to 0 |
