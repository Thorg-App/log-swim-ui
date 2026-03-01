# Phase 06 Planner -- Private Context

## Key Architectural Decisions & Rationale

### 1. lanesRef Pattern for useLogIngestion

The most important refactoring decision in this phase. Currently `useLogIngestion` takes `lanes` as a direct prop and includes it in the `useEffect` dependency array. If `lanes` becomes React state (changes on reorder/add), the effect would re-run, tearing down IPC listeners and LogBuffer, then re-creating them. This causes:
- Missed log lines during teardown/setup
- LogBuffer timer reset (partial flush lost)
- Unnecessary IPC listener churn

Solution: Use a `React.MutableRefObject` so the effect closure always reads the latest lanes without being a dependency.

```typescript
// AppShell:
const lanesRef = useRef(lanes)
useEffect(() => { lanesRef.current = lanes }, [lanes])

// useLogIngestion:
// - Accept lanesRef as param
// - Remove lanes from useEffect deps
// - In onLogLine callback: convertIpcToLogEntry(ipcLine, lanesRef.current)
```

### 2. Filtered Index Mapping vs. Filtered Array

Chose index mapping (`filteredIndices: number[] | null`) over creating a filtered copy of entries. Rationale:
- 20K entries flushed every 200ms means a new 20K array allocation every 200ms with the copy approach
- Index mapping only stores integer indices (80KB vs potentially MBs of LogEntry references)
- `null` sentinel for "no active filters" means zero overhead in the common case
- The virtualizer count switches between `masterList.length` and `filteredIndices.length`

### 3. Filter Types as Discriminated Union

Using `FieldFilter | RawFilter` discriminated union rather than single interface with optional `field`:
- Compiler enforces that `field` is present on FieldFilter
- Pattern matching in `matchesFilter` is clean: `switch(filter.type)`
- Aligns with project's existing pattern (ParsedLine = JsonParseSuccess | JsonParseFailure)

### 4. bumpVersion Exposure

Adding `bumpVersion()` to `useLogIngestion` return. This is a controlled escape hatch for lane reorder/add operations. Alternative was to have reorder trigger a state change that useLogIngestion watches -- but that couples filter/lane state to the ingestion hook unnecessarily.

### 5. E2E Test Strategy

The hardest part of Phase 06. stdin piping in Electron E2E is non-trivial because `_electron.launch()` does not support stdin configuration. Two viable paths:

**Path A (recommended)**: After launching with `_electron.launch()`, use `electronApp.evaluate()` to get the main process's `webContents`, then call `webContents.send(IPC_CHANNELS.LOG_LINE, testData)` directly. This bypasses stdin but tests the exact same code path from IPC onward. The stdin reader is already unit-tested.

**Path B**: Create a Node.js child process wrapper that pipes a file to Electron's stdin. More complex, tests more of the pipeline, but fragile for E2E.

I recommend Path A because:
- E2E tests should focus on UI behavior, not stdin plumbing (already unit tested)
- Avoids test flakiness from process spawning/piping
- Faster test execution
- Standard practice for Electron Playwright testing

### 6. Drag-and-Drop Scope

HTML5 DnD is applied to the entire `<div className="lane-header">` element, not just the drag handle icon. The drag handle is a visual affordance, but making only the handle draggable creates a tiny hit target. The whole header being draggable is better UX.

However: the "unmatched" lane header must have `draggable={false}`. It is always last and cannot be reordered.

Drop targets: only lane headers (indices 0..lanes.length-1). The unmatched header is NOT a valid drop target either (you can not move a lane to be after unmatched -- unmatched is conceptually not in the lanes array).

### 7. CSS Pre-existing State

Many CSS classes are already defined from Phase 02:
- `.filter-bar`, `.filter-chip`, `.filter-chip--disabled`, `.filter-chip__remove`
- `.filter-add-btn`
- `.lane-add-input`, `.lane-add-input__field`
- `.lane-header__drag-handle` with `cursor: grab`

New CSS needed:
- `.lane-header--drag-over` for drop target visual
- `.lane-header--dragging` for dragged element
- `.filter-bar__form`, `.filter-bar__input` for inline add-filter form
- `.filter-bar__type-toggle` for field/raw selector
- `.filter-chip--error` for invalid regex indicator

## Gotchas to Watch For

1. **useLogIngestion effect dependency array**: After refactoring to use `lanesRef`, ensure `lanesRef` is NOT in the dependency array. The ref object itself is stable.

2. **Race condition on lane add**: When a lane is added and reclassifyAll runs, new entries arriving via IPC should use the updated `lanesRef.current`. Since React state updates are async, ensure `lanesRef.current` is updated BEFORE reclassifyAll runs (or simultaneously).

3. **Drag-and-drop on Linux**: HTML5 DnD can be quirky on some Linux window managers. Since this runs in Electron (Chromium), it should be fine, but worth testing.

4. **Filter bar overflow**: With many filters, the bar will overflow horizontally. The CSS already has `overflow-x: auto`, but scrollbar styling on dark background may need attention.

5. **Virtualizer count change during scroll**: When filters are applied/removed, the virtualizer count changes. This can cause scroll position jumps. Consider resetting scroll position when filter state changes (or let the virtualizer handle it -- @tanstack/virtual handles count changes gracefully).

6. **E2E test timing**: After injecting data via `webContents.send()`, there is a processing delay (LogBuffer flush interval). Tests must wait for data to appear in the DOM, not assert immediately. Use `page.waitForSelector()` or `expect(locator).toBeVisible()` with auto-retry.

## Files Read During Planning

- `src/core/types.ts` -- all types, createLaneDefinition, KNOWN_LOG_LEVELS
- `src/core/lane-classifier.ts` -- classify, reclassifyAll
- `src/core/master-list.ts` -- entries accessor, insert, length
- `src/renderer/src/App.tsx` -- AppShell, state machine, hooks wiring
- `src/renderer/src/useAppInit.ts` -- init hook, lane creation
- `src/renderer/src/useLogIngestion.ts` -- IPC wiring, version state, LogBuffer
- `src/renderer/src/ipc-converters.ts` -- convertIpcToLogEntry
- `src/renderer/src/components/SwimLaneGrid.tsx` -- virtualizer, lane headers, log rows
- `src/renderer/src/components/LaneHeader.tsx` -- drag handle placeholder
- `src/renderer/src/components/LogRow.tsx` -- grid column positioning
- `src/renderer/src/log-row-utils.ts` -- getLevelCssClass, getTotalLaneCount
- `src/renderer/theme/tokens.css` -- all CSS custom properties
- `src/renderer/theme/components.css` -- all component styles
- `src/main/index.ts` -- app startup, IPC handlers, window creation
- `bin/log-swim-ui.js` -- CLI entry, stdin piping
- `tests/unit/core/lane-classifier.test.ts` -- existing test patterns
- `vitest.config.ts` -- test config
- `playwright.config.ts` -- E2E config
- `package.json` -- dependencies, scripts
- `electron.vite.config.ts` -- build config
- `tsconfig.web.json` -- TS config for renderer
- EXPLORATION_PUBLIC.md -- prior analysis
- Task spec (06_ui_filters_drag_lanes.md)
- High-level spec (log-swim-ui-high-level.md)
