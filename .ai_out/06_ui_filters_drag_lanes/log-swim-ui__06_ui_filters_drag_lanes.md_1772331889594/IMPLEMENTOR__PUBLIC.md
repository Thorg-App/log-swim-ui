# Phase 6B Implementation: State Management Refactor (Mutable Lanes + Filter State)

## Status: COMPLETE

## What Was Implemented

Phase 6B lifts lane state from read-only (passed from `useAppInit`) to mutable `useState` in `AppShell`, adds filter state, and refactors `useLogIngestion` to accept a `lanesRef` instead of `lanes` so that lane changes do not cause IPC listener teardown/re-setup.

### Modified Files

| File | Changes |
|------|---------|
| `src/renderer/src/useLogIngestion.ts` | Accept `lanesRef: RefObject<readonly LaneDefinition[]>` instead of `lanes`; read `lanesRef.current` at invocation time in `onLogLine` callback; remove `lanes` from effect dep array; expose `bumpVersion()` in return type |
| `src/renderer/src/App.tsx` | Lift lanes to `useState` in AppShell; create `lanesRef` synced via `useEffect`; add `filters` state; add handler functions (`handleAddLane`, `handleReorderLanes`, `handleAddFilter`, `handleRemoveFilter`, `handleToggleFilter`); pass `lanesRef` to `useLogIngestion` |

### No New Files

Phase 6B is a refactor of existing files. No new files created.

## Design Decisions

### 1. `lanesRef` Pattern for IPC Stability

The `useLogIngestion` hook's `useEffect` sets up IPC listeners and a `LogBuffer`. Previously, `lanes` was in the dependency array, meaning any lane change (reorder, add) would tear down all IPC listeners and the LogBuffer timer, then recreate them. This would cause missed log messages during the brief teardown window.

**Solution**: Accept a `RefObject<readonly LaneDefinition[]>` instead. The ref object is stable (same identity across renders), so the effect does NOT re-run on lane changes. Inside the `onLogLine` callback, `lanesRef.current` is read at invocation time, ensuring new entries are classified against the latest lane order.

### 2. `convertIpcToLogEntry(ipcLine, lanesRef.current)` at Call Site

Per plan review point #1: The existing `convertIpcToLogEntry` function signature is unchanged (still accepts `lanes: readonly LaneDefinition[]`). The call site in `useLogIngestion` simply passes `lanesRef.current` which is read at invocation time, not at closure capture time. This is the simplest possible change -- one token.

### 3. Handler Functions as `useCallback` Stubs

All handler functions (`handleAddLane`, `handleReorderLanes`, `handleAddFilter`, `handleRemoveFilter`, `handleToggleFilter`) are fully implemented with correct logic but not yet wired to UI components. They are suppressed with `void` to avoid unused-variable warnings. Phase 6C/6D will wire them to `LaneAddInput`, drag-and-drop, and `FilterBar`.

### 4. AppShellProps Change: `lanes` -> `initialLanes`

Renamed the prop from `lanes` to `initialLanes` with type `readonly LaneDefinition[]` to make it clear this is the seed value. Internal state `lanes` via `useState` is the mutable version.

### 5. Filter State with `readonly` Arrays

Both `lanes` and `filters` state use `readonly` array types (`readonly LaneDefinition[]`, `readonly Filter[]`) to prevent accidental mutation. All updates create new arrays.

### 6. `bumpVersion` via `useCallback`

Exposed as a stable callback from `useLogIngestion` so external code (lane reorder, filter change) can trigger re-renders without going through the IPC path. Uses `useCallback` with empty deps for stability.

## Plan Review Points Addressed

| Review Point | How Addressed |
|---|---|
| #1: `convertIpcToLogEntry` must use `lanesRef.current` at invocation time | Done -- call site reads `lanesRef.current` at invocation, not from closure |
| #3: `config` stability assumed | Added WHY comment in dependency array noting Phase 07 may need ref pattern |
| #5: Filter ID counter as private static | Already done in Phase 6A |

## Test Results

```
Test Files  15 passed (15)
     Tests  207 passed (207) -- all existing tests still pass
  Duration  218ms
```

Typecheck: PASS (zero errors)

## What Phase 6C/6D Will Wire

The following handlers exist in `AppShell` and will be connected to UI components:

- `handleAddLane(pattern: string)` -> `LaneAddInput` component (6C)
- `handleReorderLanes(fromIndex, toIndex)` -> `LaneHeader` drag-and-drop (6D)
- `handleAddFilter(filter: Filter)` -> `FilterBar` component (6C)
- `handleRemoveFilter(id: string)` -> `FilterChip` component (6C)
- `handleToggleFilter(id: string)` -> `FilterChip` component (6C)
- `filters` state -> `SwimLaneGrid` for render-time filtering (6C)
