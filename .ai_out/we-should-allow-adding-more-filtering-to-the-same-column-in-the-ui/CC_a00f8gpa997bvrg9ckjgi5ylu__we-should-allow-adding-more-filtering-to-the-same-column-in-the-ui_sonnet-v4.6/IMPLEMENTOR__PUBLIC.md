# IMPLEMENTOR__PUBLIC.md

## Feature: Allow Multiple Classification Patterns per Lane

### Status: COMPLETE (post-review iteration done)

### Test Results

- Unit tests: 326 passed (0 failed)
- E2E tests: 30 passed (0 failed)
- Typecheck: passes clean

---

## Files Modified

### Core (src/core/)

**`src/core/types.ts`**
- Added `ExtraPatternEntry` interface (exported): `{ pattern, regex, isError }`
- Added `extraPatterns: readonly ExtraPatternEntry[]` field to `LaneDefinition`
- Updated `createLaneDefinition()` to initialize `extraPatterns: []`
- Added private (non-exported) `compileExtraPattern(pattern, caseSensitive)` helper — internal DRY, used by `addExtraPatternToLane` and `rebuildLaneDefinition`
- Added `addExtraPatternToLane(lane, pattern): LaneDefinition` — pure factory, appends extra pattern
- Added `removeExtraPatternFromLane(lane, index): LaneDefinition` — pure factory, removes by index
- Added `rebuildLaneDefinition(newPrimaryPattern, existingLane, caseSensitive): LaneDefinition` — now delegates primary compilation to `createLaneDefinition` (DRY fix from review), then recompiles extra patterns with new flag and spreads result

**`src/core/lane-classifier.ts`**
- Extended `LaneClassifier.classify()` with OR logic: a lane matches if the primary regex matches OR any `extraPatterns[i].regex` matches. `reclassifyAll()` unchanged (calls `classify()` internally).

### Renderer (src/renderer/)

**`src/renderer/src/App.tsx`**
- Imported `addExtraPatternToLane`, `removeExtraPatternFromLane`, `rebuildLaneDefinition`
- Fixed `handleEditLane` to use `rebuildLaneDefinition` (was `createLaneDefinition` — would have silently dropped extra patterns on edit)
- Fixed `handleToggleLaneCaseSensitivity` to use `rebuildLaneDefinition` (was `createLaneDefinition` — same bug)
- Added `handleAddLanePattern(laneIndex, pattern)` handler
- Added `handleRemoveLaneExtraPattern(laneIndex, extraIndex)` handler
- Passed `onAddLanePattern` and `onRemoveLaneExtraPattern` to `SwimLaneGrid`

**`src/renderer/src/components/SwimLaneGrid.tsx`**
- Extended `SwimLaneGridProps` with `onAddLanePattern` and `onRemoveLaneExtraPattern`
- Threads `lane.extraPatterns`, `onAddLanePattern`, `onRemoveLaneExtraPattern` through to each `LaneHeader`

**`src/renderer/src/components/LaneHeader.tsx`**
- Added `ExtraPatternEntry` import from `@core/types`
- Extended `LaneHeaderProps` with `extraPatterns?`, `onAddLanePattern?`, `onRemoveLaneExtraPattern?`
- Added `isAddingPattern` / `addPatternValue` state
- Added `addPatternInputRef` with `useEffect` focus on `isAddingPattern`
- Added `handleConfirmAddPattern` and `handleCancelAddPattern` callbacks (blur cancels, not confirms — same rationale as FilterBar)
- Added `handleAddPatternChange` named `useCallback` handler (review fix: consistency with existing `handleEditChange` pattern; eliminates inline arrow recreated on every render)
- Added drag suppression for `isAddingPattern` state (alongside existing `isEditing` guard)
- Added internal `PatternChip` function component (not exported)
- Rendered `<div className="lane-header__extra-patterns">` wrapper with `PatternChip` per extra pattern
- Rendered `+ Pattern` button (`.filter-add-btn` class, reused from FilterBar — DRY)
- Added inline add-pattern form when `isAddingPattern` is true
- All new interactive elements have `data-testid` attrs as specified

**`src/renderer/theme/components.css`**
- Added in Lane Header section:
  - `.lane-header__extra-patterns` — flex row, shrink:1, min-width:0, overflow:hidden
  - `.lane-header__extra-chip` — pill chip for extra patterns
  - `.lane-header__extra-chip--error` — error border styling
  - `.lane-header__extra-chip__remove` — remove button
  - `.lane-header__add-form` — inline add-pattern form wrapper
  - `.lane-header__add-input` — narrow inline input (100px width)

### Tests

**`tests/unit/core/types.test.ts`**
- 25 tests covering: `addExtraPatternToLane`, `removeExtraPatternFromLane`, `rebuildLaneDefinition`

**`tests/unit/core/lane-classifier.test.ts`**
- 5 tests covering: extra pattern OR logic, primary match, neither matches, invalid extra skipped, first-lane-wins

**`tests/e2e/app.spec.ts`**
- `WHEN the extra pattern feature is used on a lane header` block (5 tests): button visibility, absent on unmatched, click shows input, Enter adds chip, Escape cancels, × removes chip
- `GIVEN the Electron app launched with --lanes "error" (single lane)` block (2 tests):
  - OR logic routing: uses `ERROR_LANE_SELECTOR = '.log-row[style*="grid-column: 1;"]'` to pin assertions to the error lane column. Before adding extra pattern, asserts warn-only-message NOT in error lane column. After adding, asserts it IS in error lane column.
  - Chip removal revert: asserts warn-only-message IS in error lane column after adding, then NOT in error lane column after chip removal.

---

## Key Decisions and Deviations from Plan

1. **blur cancels (not confirms) the add-pattern input** — As specified in the plan. Rationale: `onBlur` fires before `onClick`, so blur-confirms would silently submit partial text if the user clicks the Aa toggle or chip remove while typing.

2. **No `Cancel` button in add-form** — The plan showed a Cancel button in the `isAddingPattern` form. Dropped it: the input alone (Escape to cancel, Enter to confirm) provides a simpler, less cluttered UX consistent with how FilterBar works. The blur-cancels behavior covers the "click away" case.

3. **`lane-header__extra-patterns` wrapper always rendered when `!isUnmatched`** — Even when there are zero extra patterns, the wrapper div is rendered. This avoids layout shifts as chips appear/disappear and preserves the flex-shrink boundary.

4. **`handleEditLane` and `handleToggleLaneCaseSensitivity` bugs fixed** — Both were silently dropping `extraPatterns` by calling `createLaneDefinition` directly. Fixed to use `rebuildLaneDefinition`. This was pre-identified in the plan as a correctness trap and covered by unit tests.

5. **E2E lane routing via `grid-column` style selector** — Review noted that `hasWarnMessage` across all lanes was untestable (warn entry already in unmatched = visible before adding pattern). Fixed by targeting `.log-row[style*="grid-column: 1;"]` — the error lane column specifically — for before/after assertions. This tests the full integration path: UI handler → `addExtraPatternToLane` → `reclassifyAll` → `classify` OR logic → re-render in correct column.

6. **`rebuildLaneDefinition` now delegates to `createLaneDefinition` for primary** — Review identified DRY violation (duplicated regex compilation). Fixed by `{ ...createLaneDefinition(newPrimaryPattern, { caseSensitive }), extraPatterns: rebuiltExtras }`.
