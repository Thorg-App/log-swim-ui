# Phase 6C Implementation: FilterBar, FilterChip, LaneAddInput + Filter Integration

## Status: COMPLETE

## What Was Implemented

Phase 6C adds three new UI components (FilterBar, FilterChip, LaneAddInput), wires them into AppShell, and integrates render-time filtering into SwimLaneGrid using a filtered index mapping strategy.

### New Files

| File | Purpose |
|------|---------|
| `src/renderer/src/components/FilterChip.tsx` | Individual filter display chip with toggle and remove controls |
| `src/renderer/src/components/FilterBar.tsx` | Horizontal bar with active filter chips and inline add-filter form |
| `src/renderer/src/components/LaneAddInput.tsx` | Inline text input for adding ad-hoc lanes at runtime |

### Modified Files

| File | Changes |
|------|---------|
| `src/renderer/src/App.tsx` | Import and render FilterBar + LaneAddInput; wire filter/lane handlers; remove void suppressions (except `handleReorderLanes` for 6D) |
| `src/renderer/src/components/SwimLaneGrid.tsx` | Accept `filters` prop; compute `filteredIndices` via `useMemo`; map virtual row indices through filtered index mapping; reset `expandedRowIndex` on filter change |
| `src/renderer/theme/components.css` | Add `.filter-chip--error`, `.filter-chip__label`, `.filter-bar__form`, `.filter-bar__input`, `.filter-bar__type-group`, `.filter-bar__type-toggle` CSS rules |

## Design Decisions

### 1. Filtered Index Mapping (Option A from Plan)

SwimLaneGrid computes `filteredIndices: number[] | null` via `useMemo`. When no filters are active (or all have `regex === null`), `filteredIndices` is `null` (fast path -- virtualizer uses masterList directly). When filters are active, it is an array of masterList indices that pass all filters. The virtualizer count is `filteredIndices.length` when filtering is active.

This approach:
- Avoids copying LogEntry references into a new array
- Preserves stable masterList indices for `expandedRowIndex` state
- Uses `null` sentinel for the no-filter fast path

### 2. Expanded Row Index Reset on Filter Change

Per plan review point #3, a `useEffect` clears `expandedRowIndex` to `null` when `filters` changes. This prevents stale expanded state when a row gets filtered out.

### 3. FilterChip Error State

Per plan review point #6, FilterChip applies `.filter-chip--error` class when `filter.regex === null` (invalid regex). This gives visual feedback for malformed patterns.

### 4. FilterBar Always Visible

The FilterBar always renders (even with no filters), showing the "+ Filter" button. This matches the pre-defined `--filter-bar-height: 48px` token and avoids layout shifts.

### 5. Filter Type Toggle in FilterBar

The inline add-filter form supports toggling between "field" and "raw" filter types via a segmented button group (`.filter-bar__type-group`). When "field" is selected, an additional input for the field name appears.

### 6. LaneAddInput Reuses `.filter-add-btn` for Button Styling

The LaneAddInput submit button uses the existing `.filter-add-btn` class for consistent styling with the filter bar's add button. No new button CSS was needed.

### 7. Void Suppression Reduction

Removed 5 of 6 void suppressions from AppShell. Only `handleReorderLanes` remains suppressed (will be wired in Phase 6D for drag-and-drop).

## Component Layout in AppShell

```
<div className="app-layout">
  <div className="app-toolbar">
    <ModeToggle />
    <LaneAddInput />        [NEW]
    <StreamEndIndicator />
  </div>
  <FilterBar />              [NEW]
  <div className="app-main">
    <SwimLaneGrid filters={filters} />  [MODIFIED]
  </div>
  <UnparseablePanel />
</div>
```

## Plan Review Points Addressed

| Review Point | How Addressed |
|---|---|
| #3: expandedRowIndex reset on filter change | `useEffect(() => setExpandedRowIndex(null), [filters])` in SwimLaneGrid |
| #6: FilterChip error state for `regex: null` | `.filter-chip--error` class applied when `filter.regex === null` |

## Test Results

```
Test Files  15 passed (15)
     Tests  207 passed (207) -- all existing tests still pass
  Duration  216ms
```

Typecheck: PASS (zero errors)

## What Phase 6D Will Wire

- `handleReorderLanes(fromIndex, toIndex)` -> LaneHeader drag-and-drop events
- HTML5 DnD state management in SwimLaneGrid
- Drag feedback CSS classes on LaneHeader
