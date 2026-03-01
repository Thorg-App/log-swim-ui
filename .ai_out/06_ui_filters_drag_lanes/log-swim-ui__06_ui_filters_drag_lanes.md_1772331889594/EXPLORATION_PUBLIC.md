# Phase 06 Exploration Summary

## Key Architecture Points

### State Flow
- `App.tsx` → loading/error/ready state machine → AppShell
- `useAppInit` hook: loads config, CLI args, creates MasterList + lanes
- `useLogIngestion` hook: IPC listeners, LogBuffer flush → version counter → re-render
- Lane order matters: first-match-wins classification via `LaneClassifier`
- `LogEntry.laneIndex` is mutable — gets updated on re-classification
- Version-based rendering: integer counter bump triggers re-renders

### Components
- `SwimLaneGrid` — virtualized CSS grid, takes `masterList`, `lanes`, `version`, `mode`
- `LaneHeader` — has pre-wired drag handle (`⠿`), CSS ready, no events yet
- `LogRow` — shows entry in correct column via `gridColumn`, expandable
- `ModeToggle`, `StreamEndIndicator`, `UnparseablePanel`

### CSS Pre-existing for Phase 06
- `.filter-bar`, `.filter-chip`, `.filter-chip--disabled`, `.filter-add-btn` — classes defined
- `--filter-bar-height: 48px` — token defined
- `.lane-header__drag-handle` — styled with `cursor: grab`
- `.lane-add-input` — class pre-defined

### Core Types
- `LogEntry` — rawJson, fields, timestamp, level, laneIndex (mutable)
- `LaneDefinition` — pattern, regex (RegExp|null), isError
- `createLaneDefinition(pattern)` — factory function
- `LaneClassifier.classify(entry, lanes)` — returns laneIndex
- `LaneClassifier.reclassifyAll(entries, lanes)` — mutates laneIndex on all entries
- `MasterList` — sorted by timestamp, binary-search insert, eviction
- `KNOWN_LOG_LEVELS` — single source of truth in types.ts

### Test Setup
- Vitest: `tests/unit/`, BDD style, path aliases `@core`, `@renderer`
- Playwright: `tests/e2e/`, configured but no tests yet
- Existing tests cover: lane-classifier, master-list, log-row-utils, config-manager, etc.

### Extension Points for Phase 06
1. **Filter state**: New hook or App-level state; filter at render time in SwimLaneGrid
2. **Lane reorder**: Drag LaneHeader → reorder lanes array → `LaneClassifier.reclassifyAll()` → version bump
3. **Lane addition**: New LaneDefinition inserted before unmatched, reclassify all entries
4. **CSS**: Pre-defined tokens and classes ready for filter bar and lane-add components

### Key Files
- `src/core/types.ts` — all type definitions
- `src/core/lane-classifier.ts` — classification + reclassifyAll
- `src/renderer/src/App.tsx` — top-level state machine
- `src/renderer/src/useAppInit.ts` — init hook with lane creation
- `src/renderer/src/useLogIngestion.ts` — IPC + log state
- `src/renderer/src/components/SwimLaneGrid.tsx` — virtualized grid
- `src/renderer/src/components/LaneHeader.tsx` — drag handle ready
- `src/renderer/theme/tokens.css` — CSS custom properties
- `src/renderer/theme/components.css` — structural styles
