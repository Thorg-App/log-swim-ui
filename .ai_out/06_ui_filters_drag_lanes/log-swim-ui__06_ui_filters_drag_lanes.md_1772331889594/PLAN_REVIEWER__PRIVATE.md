# Plan Reviewer Private Context -- Phase 06

## Key Technical Findings from Source Code Review

### useLogIngestion Current Dependencies
- `useEffect` depends on `[masterList, lanes, config]` (line 82 of useLogIngestion.ts)
- The `lanes` dependency means effect re-runs when lanes change, tearing down LogBuffer + IPC listeners
- This is the core problem the lanesRef pattern solves
- `convertIpcToLogEntry(ipcLine, lanes)` at line 58 -- `lanes` is captured from the closure
- After refactor: must use `lanesRef.current` at call site, NOT the captured `lanes`

### MasterList API Compatibility
- `masterList.entries` returns `readonly LogEntry[]` -- compatible with `LaneClassifier.reclassifyAll`
- `LogEntry.laneIndex` is mutable (not readonly) -- confirmed in types.ts line 30
- `masterList.get(index)` returns `LogEntry | undefined` -- plan's filtering code handles this correctly

### SwimLaneGrid Current Structure
- Uses `useVirtualizer` with `count: masterList.length`
- Expanded row tracked by `expandedRowIndex: number | null` -- this is a masterList index
- When filtering is added, this index semantics needs care:
  - If filters active: virtualRow.index maps through filteredIndices to masterList index
  - expandedRowIndex should still reference masterList index (stable across filter changes)
  - BUT: when filter changes, the expanded row may disappear -- needs reset to null

### LaneHeader Current Props
- Only `pattern`, `isError`, `isUnmatched` -- very simple
- Has pre-wired drag handle span with CSS cursor:grab
- Plan adds 5 new props for DnD -- manageable

### Pre-Existing CSS
- `.filter-bar`, `.filter-chip`, `.filter-chip--disabled`, `.filter-add-btn` -- all defined in components.css
- `.lane-add-input`, `.lane-add-input__field` -- defined in components.css
- `.lane-header__drag-handle` -- has cursor:grab and active state
- `--filter-bar-height: 48px` token defined
- No `.filter-chip--error` or `.lane-header--drag-over` or `.lane-header--dragging` yet -- need to add

### E2E Setup
- Playwright config is minimal (just testDir + timeout + headless)
- No existing E2E tests (only .gitkeep)
- Electron is already a devDependency
- The `_electron.launch()` approach is the standard Playwright-for-Electron pattern

### Existing Test Coverage
- 14 test files covering core, main, and renderer
- lane-classifier has tests for classify and reclassifyAll
- ipc-converters has tests for convertIpcToLogEntry
- No React component tests (no jsdom/testing-library setup)
- No hooks tests

## Concerns Not Raised (Acceptable Risk)

1. **No component-level tests for FilterBar/FilterChip/LaneAddInput**: The plan relies on E2E tests for UI verification. This is acceptable for Phase 06 -- these are simple presentation components. If they grow complex, component tests can be added later.

2. **LogBuffer tear-down risk during reclassification**: When `handleReorderLanes` is called, it mutates entries via `reclassifyAll` and then bumps version. If a LogBuffer flush happens between reclassifyAll and bumpVersion, the flush inserts entries classified against the new lane order, which is correct. No race condition.

3. **Filter compilation debounce**: The plan mentions debouncing regex compilation but not the filter input. Since filters are created on submit (Enter key), not on every keystroke, debounce is not needed. Correct.

## Phase 07 Forward Look
- Config will become mutable in Phase 07 (Settings Panel)
- The same ref pattern may be needed for config to avoid effect re-runs
- The plan correctly notes this as a future concern, not a Phase 06 issue
