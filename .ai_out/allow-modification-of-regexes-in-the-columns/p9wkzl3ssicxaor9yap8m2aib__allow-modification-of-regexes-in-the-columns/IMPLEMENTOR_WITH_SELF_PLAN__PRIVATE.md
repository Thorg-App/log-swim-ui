# Implementation Private Notes

## Status: COMPLETE

## What Was Done

### Core Layer (src/core/types.ts)
- Added `caseSensitive: boolean` to `LaneDefinition` interface
- Added `CreateLaneDefinitionOptions` interface with optional `caseSensitive` field
- Updated `createLaneDefinition(pattern, options?)` to accept options; defaults `caseSensitive` to `true`
- When `caseSensitive` is false, regex is compiled with `'i'` flag
- Exported `CreateLaneDefinitionOptions` type

### No changes to lane-classifier.ts
- LaneClassifier already uses `lane.regex.test()` which respects the `i` flag set at creation time

### App State (src/renderer/src/App.tsx)
- Added `handleEditLane(index, newPattern)` -- creates new LaneDefinition preserving caseSensitive, replaces at index
- Added `handleRemoveLane(index)` -- filters out the lane at index
- Added `handleToggleLaneCaseSensitivity(index)` -- recreates lane with toggled caseSensitive
- All three use existing `applyLaneChange` DRY helper
- Passed new callbacks through SwimLaneGrid

### SwimLaneGrid (src/renderer/src/components/SwimLaneGrid.tsx)
- Added `onEditLane`, `onRemoveLane`, `onToggleLaneCaseSensitivity` to props
- Passes `caseSensitive`, `onEdit`, `onRemove`, `onToggleCaseSensitivity` to LaneHeader

### LaneHeader (src/renderer/src/components/LaneHeader.tsx)
- Added edit mode: click pattern -> input, Enter to confirm, Escape to cancel, blur to confirm
- Added x remove button (not on unmatched)
- Added Aa/aa case sensitivity toggle (not on unmatched)
- Added data-testid attributes for E2E testing

### CSS (src/renderer/theme/components.css)
- Added `.lane-header__edit-input` -- inline edit input styled with tokens
- Added `.lane-header__case-toggle` and `--active` variant -- matches filter-chip pattern
- Added `.lane-header__remove` -- matches filter-chip remove pattern
- Added `cursor: text` to existing `.lane-header__pattern`

### Tests
- Unit tests: 274 total (was 265), added 9 new tests for caseSensitive
- E2E tests: 21 total (was 15), added 6 new tests for edit/remove/case-toggle

## Key Decisions
- `caseSensitive` defaults to `true` for backward compatibility
- Edit on blur confirms (same as Enter) -- UX convention for inline edits
- Empty/whitespace-only pattern on edit is discarded (reverts to original)
- Same pattern on edit is a no-op (no reclassification triggered)
