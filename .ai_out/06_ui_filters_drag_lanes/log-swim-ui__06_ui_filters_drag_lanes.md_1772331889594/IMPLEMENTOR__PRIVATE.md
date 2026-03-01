# Phase 6C -- Implementor Private State

## Completed
- Phase 6A: Core Filter Types + Logic + Unit Tests
- Phase 6B: State Management Refactor (Mutable Lanes + Filter State)
- Phase 6C: FilterBar, FilterChip, LaneAddInput UI Components + Filter Integration

## Files Created in 6C
- `src/renderer/src/components/FilterChip.tsx`
- `src/renderer/src/components/FilterBar.tsx`
- `src/renderer/src/components/LaneAddInput.tsx`

## Files Modified in 6C
- `src/renderer/src/App.tsx` -- Import/render FilterBar + LaneAddInput, wire handlers, remove void suppressions
- `src/renderer/src/components/SwimLaneGrid.tsx` -- Add `filters` prop, filtered index mapping, expanded row reset
- `src/renderer/theme/components.css` -- Add filter-chip--error, filter-bar__form, filter-bar__input, filter-bar__type-group/toggle CSS

## Key Implementation Notes

### FilterBar State Machine
- `isAdding: boolean` controls whether the inline add-filter form is shown
- `filterType: FilterType` toggles between 'field' and 'raw'
- `fieldName: string` and `pattern: string` for form inputs
- `resetForm()` clears all form state and hides form
- Submit validates pattern is non-empty, creates filter via FilterEngine, calls `onAddFilter`, resets form
- Escape key cancels form

### FilterChip
- Click on chip body toggles enabled/disabled via `onToggle`
- Click on X button removes filter via `onRemove` (uses stopPropagation to prevent toggle)
- Shows `filter-chip--error` when `filter.regex === null`
- Label format: `field:pattern` for field filters, `pattern` for raw filters

### LaneAddInput
- Simple controlled input + submit button
- Submits on Enter or button click
- Clears input after submission
- Reuses `.filter-add-btn` CSS for button

### SwimLaneGrid Filter Integration
- `filteredIndices` computed via `useMemo([version, filters, masterList])`
- `null` = no active filters (fast path), array = filtered indices
- Virtualizer count = `filteredIndices.length` or `masterList.length`
- Virtual row index mapped to masterList index via `filteredIndices[virtualRow.index]`
- `expandedRowIndex` reset to null when `filters` changes
- `estimateSize` maps through `filteredIndices` for expanded row detection

### Remaining Void Suppression
- Only `handleReorderLanes` is still suppressed (Phase 6D)

## Test State
- 207 total tests passing (15 test files)
- Typecheck passes
- No new unit tests added in 6C (components are UI-only, tested via E2E in 6E)

## Ready For Next Phase
Phase 6D can proceed. It will:
1. Add drag-and-drop HTML5 DnD to LaneHeader
2. Wire `handleReorderLanes` from AppShell
3. Add drag state management in SwimLaneGrid
4. Add drag feedback CSS (`.lane-header--drag-over`, `.lane-header--dragging`)
5. Remove last `void handleReorderLanes` suppression
