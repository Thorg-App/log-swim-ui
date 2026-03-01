# Phase 03: Core Data Pipeline -- Planning Complete

## Summary

The implementation plan for Phase 03 is ready at `PLAN.md`. It covers 7 modules in `src/core/` with full test coverage, ordered to minimize forward references.

## Implementation Order

```
A: types.ts              -- Foundation types, interfaces, constants
B: json-parser.ts        -- Parse raw JSON strings (static class)
C: timestamp-detector.ts -- Detect & lock ISO8601/epochMillis (stateful class)
D: lane-classifier.ts    -- First-match-wins regex classification (static class)
E: master-list.ts        -- Sorted array with binary-search insert + eviction (class)
F: log-buffer.ts         -- Timer-based accumulate and flush (class, owns timer)
G: stdin-reader.ts       -- Line-by-line reading from Readable stream (static class)
```

## Key Design Decisions Made

1. **StdinReader uses callback pattern** (not EventEmitter) -- simpler, type-safe, testable
2. **MasterList is a class** -- inherently stateful, owns sorted array
3. **LogBuffer owns its flush timer** -- encapsulates behavior cleanly, testable with fake timers
4. **TimestampDetector has two methods**: `detectAndLock()` (throws on first-line failure per spec) and `parse()` (returns ParseResult for subsequent lines)
5. **StdinReader accepts `Readable` parameter** -- dependency inversion for testability
6. **Free-floating functions avoided** -- static classes per CLAUDE.md, with one pragmatic exception for `createLaneDefinition()` factory in types.ts
7. **No batch insert optimization** -- 80/20: individual inserts in a loop, optimize later if needed

## Callouts

| WHAT | WHY |
|------|-----|
| `createLaneDefinition` is a free-floating function | types.ts is a types file; a class for one factory function is over-engineering |
| `TimestampDetector.detectAndLock()` throws | Spec explicitly requires throwing on first-line timestamp failure |
| `DEFAULT_APP_CONFIG` lives in types.ts | Closely coupled to AppConfig interface; can extract in Phase 04 if needed |

## No Open Questions

The spec is sufficiently detailed. All design decisions are resolved in the plan.

## Ready for Implementation

The plan is structured as 7 sequential phases (A through G) plus a final verification phase (H). Each phase creates one module with its test file. The implementor should follow the order strictly since later modules depend on types established in Phase A.
