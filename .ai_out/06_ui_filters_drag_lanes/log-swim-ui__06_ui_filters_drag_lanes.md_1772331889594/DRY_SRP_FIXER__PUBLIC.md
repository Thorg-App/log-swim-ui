# Phase 06: DRY/SRP Analysis and Fixes

## Status: COMPLETE

## Summary

Analyzed all Phase 06 source files for DRY and SRP violations. Found **3 genuine DRY violations** (all fixed) and **no SRP violations** requiring action. Several items were evaluated and determined to be acceptable.

## DRY Violations Found and Fixed

### Fix 1: CSS text input styles duplicated (FIXED)

**File:** `src/renderer/theme/components.css`

**Problem:** `.filter-bar__input` and `.lane-add-input__field` had **identical** CSS rules (9 properties, plus `:focus` and `::placeholder` pseudo-selectors). These represent the same knowledge: "how mono text inputs look in this app." If the input styling changes, both would need to change together.

**Fix:** Unified into a single multi-selector rule block. The `.filter-bar__input, .lane-add-input__field` selector now defines the shared input style once. The duplicate `.lane-add-input__field` block was replaced with a comment pointing to the shared definition.

**Before (2 identical blocks):**
```css
.filter-bar__input { padding: ...; background-color: ...; /* 7 more */ }
.filter-bar__input:focus { border-color: ...; }
.filter-bar__input::placeholder { color: ...; }
/* ... 200 lines later ... */
.lane-add-input__field { padding: ...; background-color: ...; /* same 7 */ }
.lane-add-input__field:focus { border-color: ...; }
.lane-add-input__field::placeholder { color: ...; }
```

**After (1 shared block):**
```css
.filter-bar__input,
.lane-add-input__field { padding: ...; background-color: ...; /* 7 more */ }
.filter-bar__input:focus,
.lane-add-input__field:focus { border-color: ...; }
.filter-bar__input::placeholder,
.lane-add-input__field::placeholder { color: ...; }
```

### Fix 2: CSS drag handle cursor rules duplicated (FIXED)

**File:** `src/renderer/theme/components.css`

**Problem:** `.lane-header__drag-handle` base rule set `cursor: grab` and its `:active` set `cursor: grabbing`. Then `.lane-header__drag-handle[draggable="true"]` repeated `cursor: grab` and its `:active` repeated `cursor: grabbing`. This is the same knowledge expressed twice. Worse, the base rule incorrectly applied `cursor: grab` to the hidden placeholder span used by the unmatched lane.

**Fix:** Removed `cursor: grab` from the base `.lane-header__drag-handle` rule and removed the base `:active` pseudo-selector. Cursor behavior now lives exclusively in the `[draggable="true"]` selector, which only targets actually-draggable handles.

**Before:**
```css
.lane-header__drag-handle { cursor: grab; color: ...; flex-shrink: 0; }
.lane-header__drag-handle:active { cursor: grabbing; }
/* ... later ... */
.lane-header__drag-handle[draggable="true"] { cursor: grab; user-select: none; }
.lane-header__drag-handle[draggable="true"]:active { cursor: grabbing; }
```

**After:**
```css
.lane-header__drag-handle { color: ...; flex-shrink: 0; }
/* cursor rules only on [draggable="true"] -- single source of truth */
.lane-header__drag-handle[draggable="true"] { cursor: grab; user-select: none; }
.lane-header__drag-handle[draggable="true"]:active { cursor: grabbing; }
```

### Fix 3: `reclassifyAll + bumpVersion` pattern duplicated in App.tsx (FIXED)

**File:** `src/renderer/src/App.tsx`

**Problem:** Both `handleAddLane` and `handleReorderLanes` ended with the same three-step sequence: `setLanes(newLanes)`, `LaneClassifier.reclassifyAll(masterList.entries, newLanes)`, `bumpVersion()`. This is one piece of knowledge -- "how to apply a lane change" -- duplicated across two handlers. If the lane-change protocol evolves (e.g., adding analytics, persistence), both handlers would need coordinated changes.

**Fix:** Extracted `applyLaneChange(newLanes)` helper that captures the three-step mutation protocol. Both handlers now call this single function after computing their respective `newLanes`.

**Before:**
```typescript
const handleAddLane = useCallback((pattern: string) => {
  const newLane = createLaneDefinition(pattern)
  const newLanes = [...lanes, newLane]
  setLanes(newLanes)
  LaneClassifier.reclassifyAll(masterList.entries, newLanes)
  bumpVersion()
}, [lanes, masterList, bumpVersion])

const handleReorderLanes = useCallback((fromIndex: number, toIndex: number) => {
  // ...compute newLanes...
  setLanes(newLanes)
  LaneClassifier.reclassifyAll(masterList.entries, newLanes)
  bumpVersion()
}, [lanes, masterList, bumpVersion])
```

**After:**
```typescript
const applyLaneChange = useCallback((newLanes: LaneDefinition[]) => {
  setLanes(newLanes)
  LaneClassifier.reclassifyAll(masterList.entries, newLanes)
  bumpVersion()
}, [masterList, bumpVersion])

const handleAddLane = useCallback((pattern: string) => {
  const newLane = createLaneDefinition(pattern)
  applyLaneChange([...lanes, newLane])
}, [lanes, applyLaneChange])

const handleReorderLanes = useCallback((fromIndex: number, toIndex: number) => {
  // ...compute newLanes...
  applyLaneChange(newLanes)
}, [lanes, applyLaneChange])
```

## Items Evaluated -- No Violation

### 1. IpcLogLine duplication in E2E test helpers (NOT A VIOLATION)

**File:** `tests/e2e/helpers/electron-app.ts` vs `src/core/types.ts`

**Assessment:** The `IpcLogLine` interface is duplicated in the E2E test helper. This IS technically knowledge duplication -- both definitions must stay in sync. However, the IMPLEMENTOR correctly documented the justification: E2E tests run under Playwright's own TS compilation, which does not have access to Vite's `@core/*` path aliases. Fixing this would require complex tsconfig changes that add more maintenance burden than the duplication itself.

**Decision:** Acceptable tradeoff per 80/20 principle. The interface is small (4 fields), stable, and unlikely to change. The WHY comment in the E2E file documents the reasoning.

### 2. `createLaneDefinition` vs `FilterEngine.tryCompileRegex` (NOT A VIOLATION)

**Files:** `src/core/types.ts` vs `src/core/filter.ts`

**Assessment:** Both wrap `new RegExp(pattern)` in try/catch. However, they return **different types** with **different semantics**: `createLaneDefinition` returns a `LaneDefinition` with `isError` flag, while `tryCompileRegex` returns `RegExp | null`. These represent different knowledge (lane creation vs regex compilation). They have different reasons to change and serve different domains.

### 3. Filter handlers in App.tsx (NOT A VIOLATION)

**Assessment:** `handleAddFilter`, `handleRemoveFilter`, and `handleToggleFilter` look structurally similar (each calls `setFilters` with a transformation), but they represent **different operations** with different logic. This is not knowledge duplication -- it is three distinct operations that happen to use the same state setter. Extracting a "generic filter updater" would add abstraction without reducing knowledge duplication.

### 4. AppShell responsibility load (NO SRP VIOLATION)

**Assessment:** AppShell now has ~5 handlers (2 lane + 3 filter), but they all serve a **single responsibility**: orchestrating the application's top-level state and wiring child components. This is what a top-level shell component is supposed to do. The handlers are thin (1-3 lines each after the DRY fix). Splitting them into separate hooks would scatter the same axis of change across files without benefit.

### 5. SwimLaneGrid responsibility (NO SRP VIOLATION)

**Assessment:** SwimLaneGrid handles filtering, DnD state, virtualization, and scroll detection. These all serve the **same axis of change**: "how the grid renders and interacts." Filtering is a render-time concern (useMemo), DnD is 4 thin state setters, and virtualization/scroll are inherent to the component's purpose. Splitting these would create tight coupling between small fragments for no SRP gain.

## Verification

```
Typecheck: PASS (zero errors)
Unit tests: 207 passed (242ms) -- 15 test files
```

## Files Modified

| File | Change |
|------|--------|
| `src/renderer/theme/components.css` | Unified `.filter-bar__input` and `.lane-add-input__field` into shared multi-selector; removed duplicate drag handle cursor rules |
| `src/renderer/src/App.tsx` | Extracted `applyLaneChange` helper to DRY up lane mutation pattern |
