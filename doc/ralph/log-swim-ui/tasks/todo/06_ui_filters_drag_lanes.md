# Phase 06: UI — Filters, Drag & Lane Management

## Objective
Add the global filter bar, ad-hoc lane addition, and draggable lane reordering with re-classification. Complete the interactive features of the swimlane UI and add E2E tests.

## Prerequisites
- Phase 05 complete (swimlane layout, rows, modes all rendering correctly)

## Scope
### In Scope
- **Global filter bar** (`src/renderer/components/FilterBar.tsx`):
  - Sits at the top of the UI above all swimlanes
  - Multiple filter conditions, stacked with AND logic
  - Two filter types:
    - **Field filter**: select a JSON field name + enter value or regex
    - **Raw filter**: regex matched against full raw JSON string
  - Each filter can be: added, removed, toggled on/off
  - All active filters must match for a row to be visible
  - Filtering operates on the master list — affects all lanes simultaneously
  - Filter state managed in App-level state
- **Ad-hoc lane addition** (`src/renderer/components/LaneAddInput.tsx`):
  - Input field for entering a regex pattern
  - On submit: new `LaneDefinition` created and inserted before "unmatched"
  - Invalid regex: lane created in error state (no crash)
  - Existing + new log entries classified against updated lane set
  - Ad-hoc lanes persist only for the session (not saved to config)
- **Draggable lane reordering**:
  - Lane headers can be clicked and dragged to new positions
  - "unmatched" lane cannot be dragged (always last)
  - On drop: lane order updates and ALL entries are re-classified against new order
  - Use HTML5 drag-and-drop API or a lightweight drag library
  - Visual feedback during drag (drag handle, drop indicator)
- **Invalid regex lane error state**:
  - Lane header shows error indicator (icon + tinted background)
  - Lane column body shows a clear error message
  - Does not affect other lanes
- **E2E tests** (Playwright):
  - Test: app launches with piped stdin and renders logs
  - Test: logs appear in correct lanes
  - Test: filter bar filters across lanes
  - Test: ad-hoc lane addition works
  - Test: lane drag reorder triggers re-classification
  - Test: mode toggle works (Live ↔ Scroll)
  - Test: row expand/collapse
  - Test: stream-ended indicator appears
  - Use Playwright MCP screenshots for visual verification

### Out of Scope
- Settings panel (Phase 07)
- Config persistence of ad-hoc lanes (explicitly out of scope for v1)

## Implementation Guidance

### Filter Bar State
```typescript
interface Filter {
  id: string;
  type: 'field' | 'raw';
  field?: string;    // for field filters
  pattern: string;   // value or regex
  regex: RegExp;     // compiled regex
  enabled: boolean;
}
```

### Filtering Logic
```typescript
function matchesAllFilters(entry: LogEntry, filters: Filter[]): boolean {
  const activeFilters = filters.filter(f => f.enabled);
  return activeFilters.every(f => {
    if (f.type === 'raw') return f.regex.test(entry.rawJson);
    if (f.type === 'field' && f.field) {
      const value = String(entry.fields[f.field] ?? '');
      return f.regex.test(value);
    }
    return true;
  });
}
```

### Lane Reorder + Re-classification
When lanes are reordered:
1. Update `lanes` array to new order
2. Iterate all entries in master list
3. Re-run `LaneClassifier.classify()` against each entry with new lane order
4. Update each entry's `laneIndex`
5. Trigger re-render

This is O(n × m) where n = entries, m = lanes. With maxLogEntries = 20K and typically < 10 lanes, this is fast enough.

### Drag-and-Drop
Keep it simple. HTML5 drag-and-drop is sufficient:
- `draggable="true"` on lane headers
- `onDragStart`, `onDragOver`, `onDrop` handlers
- Visual feedback: highlight drop target position

### E2E Test Setup
For Playwright E2E tests with Electron:
- Use `electron` Playwright package or launch the built app
- Pipe test JSON data via stdin
- Assert on DOM structure and visual output
- Use Playwright MCP screenshots for visual regression

## Acceptance Criteria
- [ ] Filter bar renders at top of UI
- [ ] Field filters can be added, targeting specific JSON fields
- [ ] Raw filters can be added, matching against full JSON string
- [ ] Filters can be toggled on/off individually
- [ ] Filters can be removed
- [ ] AND logic: only rows matching ALL active filters visible
- [ ] Filtering affects all lanes simultaneously
- [ ] Ad-hoc lane regex input available
- [ ] New lane inserted before "unmatched" on submit
- [ ] Invalid regex in ad-hoc input creates lane in error state
- [ ] Lane headers are draggable (except "unmatched")
- [ ] Dropping a lane in new position reorders and re-classifies all entries
- [ ] Visual drag feedback (handle, drop indicator)
- [ ] E2E tests pass for core user flows
- [ ] All unit tests still pass

## Notes
- Re-classification on lane reorder is the most computationally expensive operation. Profile it with 20K entries to ensure it stays responsive.
- The filter bar should feel responsive — debounce regex compilation, not the filter application.
