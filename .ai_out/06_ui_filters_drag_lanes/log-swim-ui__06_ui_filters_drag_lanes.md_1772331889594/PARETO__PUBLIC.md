# Pareto Complexity Assessment: Phase 06 -- UI Filters, Drag & Lane Management

## Verdict: COMPLEXITY_JUSTIFIED

**Value Delivered:** Global filter bar (field + raw, AND logic, toggle/remove), ad-hoc lane addition, drag-and-drop lane reordering with re-classification, and E2E test infrastructure (11 tests).

**Complexity Cost:** ~1,845 lines across 12 files (production + test). All unit tests pass (207), typecheck clean, E2E: 11 tests pass.

**Ratio:** High

---

## 1. FilterEngine (`src/core/filter.ts`) -- 139 lines

**Assessment: RIGHT-SIZED**

The discriminated union `FieldFilter | RawFilter` is the minimal type-safe representation of two filter kinds. The `FilterEngine` static class follows the established codebase pattern (`LaneClassifier`, `JsonParser`, `CliParser` are all static classes). Each method does exactly one thing:

- `createFieldFilter` / `createRawFilter`: factory + safe regex compilation
- `toggleFilter`: immutable toggle
- `matchesFilter`: single-filter evaluation with exhaustive switch
- `matchesAllFilters`: AND composition with early-exit loop

The `tryCompileRegex` returning `null` for invalid patterns is a good choice -- it avoids exceptions in a hot path and keeps the "invalid filter = skip" behavior explicit. The `resetIdCounter()` for test isolation is a minor pragmatic concession that costs nothing.

No over-engineering detected. The spec required field + raw filter types, and the implementation delivers exactly that.

## 2. Filtered Index Mapping (`SwimLaneGrid.tsx`, lines 87-102)

**Assessment: JUSTIFIED**

The question was whether `filteredIndices` (an array of master-list indices that pass all filters) is worth the complexity vs simpler alternatives.

The approach is sound for three reasons:
1. **Fast path when no filters active:** returns `null`, meaning zero overhead in the common case (no filtering). This is the 80/20 optimization.
2. **Decouples filtering from data:** filtering is a render-time projection, not a mutation. The master list stays intact. This avoids the complexity of maintaining two data structures or re-inserting entries when filters change.
3. **Works naturally with virtualization:** `@tanstack/virtual` needs a count and an index lookup. The `filteredIndices` array provides both without copying log entries.

Alternative considered: filtering inside `MasterList` itself. This would couple filtering into the data layer, create lifecycle complexity (what happens when entries arrive while a filter is active?), and violate the current clean separation where `MasterList` is a pure sorted collection.

The `useMemo` with `version` dependency triggers recomputation when new entries arrive. The `eslint-disable` comment is properly explained with a WHY comment.

## 3. State Management: `lanesRef` + `bumpVersion` Pattern

**Assessment: JUSTIFIED -- Pragmatic React Pattern**

The `lanesRef` pattern in `App.tsx` / `useLogIngestion.ts` solves a real React problem: the IPC `onLogLine` callback needs the latest lane definitions for classification, but re-creating the IPC subscription on every lane change would cause message loss. Using a ref that is read at invocation time is the standard React escape hatch for this.

The `bumpVersion` callback (increments a counter to trigger re-render) is the minimal mechanism to inform the UI that data changed. It avoids putting the entire master list into React state (which would be a performance disaster with 20K entries).

This is not over-engineered. It is the simplest pattern that works correctly with React's render cycle + external mutable data.

## 4. E2E Test Seam in `main/index.ts`

**Assessment: JUSTIFIED -- Proportionate to Value**

The E2E test seam adds ~25 lines of conditional logic guarded by `E2E_TEST=1`. It handles four concerns:

| Concern | Lines | Justification |
|---------|-------|---------------|
| TTY check bypass | 1 | stdin is Playwright's pipe, not user terminal |
| Offscreen rendering | 2 | Required for headless ozone platform |
| Chromium flag filtering | 8 | `extractAppArgs()` filters Playwright-injected argv |
| IpcBridge skip | 3 | Test data injected via IPC, not stdin |

The `extractAppArgs()` function is the most complex piece. It finds the first known app flag and takes everything from there. This is a practical solution to a real problem: Playwright injects Chromium flags and an app entry path into `process.argv` that would confuse `CliParser`. The function is 8 lines, tested implicitly by E2E tests passing, and isolated.

The alternative (modifying `CliParser` to ignore unknown flags) would violate OCP and weaken CLI validation for production users.

**Value delivered:** 11 E2E tests covering core user flows, running headless on Linux without X display. This is high-value infrastructure that will catch regressions across all future phases.

## 5. Drag-and-Drop (`LaneHeader.tsx` + `SwimLaneGrid.tsx`)

**Assessment: RIGHT-SIZED**

Uses native HTML5 drag-and-drop. No third-party library. Four event handlers (`dragStart`, `dragOver`, `drop`, `dragEnd`) totaling ~30 lines across both components. Visual feedback via `lane-header--drag-over` CSS class.

The "unmatched lane is not draggable and not a drop target" constraint is cleanly handled: drag props are optional on `LaneHeader`, and `SwimLaneGrid` passes them only for non-unmatched lanes.

`handleReorderLanes` in `App.tsx` does splice + `LaneClassifier.reclassifyAll()` + `bumpVersion()`. The `reclassifyAll` is a 4-line loop. For 20K entries x 10 lanes, this is sub-millisecond.

No over-engineering. HTML5 drag-and-drop is the spec's recommendation, and the implementation is minimal.

## 6. Component Breakdown (FilterBar, FilterChip, LaneAddInput)

**Assessment: RIGHT-SIZED**

| Component | Lines | Responsibility |
|-----------|-------|---------------|
| `FilterBar.tsx` | 149 | Form state, add/cancel, delegates to FilterChip |
| `FilterChip.tsx` | 44 | Display + toggle/remove click handlers |
| `LaneAddInput.tsx` | 55 | Text input + submit on Enter |

Each component has a single responsibility. `FilterBar` is the largest at 149 lines, which includes the inline `FilterTypeToggle` sub-component (15 lines). This is appropriate -- extracting it to a separate file would add import overhead for a component used in exactly one place.

The `FilterChip` uses `stopPropagation` for the remove button (so clicking X does not toggle the filter). This is documented with a WHY comment. Standard pattern.

## 7. Test Coverage

**Assessment: STRONG**

| Test Suite | Count | Coverage |
|-----------|-------|----------|
| `filter.test.ts` (unit) | 27 | Creates, toggles, matches (field/raw/invalid/disabled), AND logic, vacuous truth, edge cases |
| `app.spec.ts` (E2E) | 11 | Lane headers, log rows, expand/collapse, filtering, lane addition, mode toggle, stream-end |

The unit tests follow BDD style with GIVEN/WHEN/THEN. One assert per test. Edge cases covered (invalid regex, non-existent fields, numeric field values, disabled filters, empty filter list).

The E2E tests cover the full Electron lifecycle. The `IpcLogLine` type duplication in `electron-app.ts` is documented with a WHY comment -- Playwright's TS compilation does not support Vite path aliases. This is a pragmatic DRY exception.

## 8. Minor Observations (Not Blocking)

### 8a. `FILTER_TYPES` constant is exported but only used internally by `FilterTypeToggle`

The `FILTER_TYPES` constant and `FilterType` type are exported from `filter.ts` and used in `FilterBar.tsx` for the type toggle buttons. This is correct usage -- the rendering needs to iterate over available filter types. No issue.

### 8b. `void unparseableCount` in `useLogIngestion.ts` (line 102)

This `void` expression exists to trigger React re-reads of the ref when unparseable entries are pushed. It is documented. Slightly unusual but valid -- the alternative would be putting the full array into state, which would copy on every push. Pragmatic.

### 8c. IpcLogLine duplication in E2E helpers

Documented with WHY comment. The interface is 5 fields. The cost of maintaining a duplicate is near-zero. The cost of fixing it (tsconfig gymnastics for Playwright) would be disproportionate. Correct 80/20 call.

---

## Summary

| Dimension | Rating |
|-----------|--------|
| Value/Complexity Ratio | **High** |
| Scope Creep | **None** -- delivers exactly what the spec requires |
| Premature Abstraction | **None** -- no "we might need this" patterns |
| Integration Cost | **Low** -- changes are additive, no existing behavior modified |
| Test Quality | **Strong** -- 27 unit + 11 E2E covering edge cases |
| Code Size | **Right-sized** -- 1,845 lines for 4 features + E2E infra |

## Verdict: COMPLEXITY_JUSTIFIED

Every abstraction serves a concrete need. The filtered index mapping, `lanesRef` pattern, and E2E test seam are all the simplest approaches that solve their respective problems. No simplification would remove meaningful complexity without sacrificing functionality or correctness.
