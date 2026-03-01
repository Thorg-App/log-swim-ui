# Phase 6D Implementation: Draggable Lane Reordering

## Status: COMPLETE

## What Was Implemented

Phase 6D adds HTML5 drag-and-drop to lane headers so users can reorder lanes by dragging. When dropped, all log entries are re-classified against the new lane order via `LaneClassifier.reclassifyAll()` and the UI re-renders.

### Modified Files

| File | Changes |
|------|---------|
| `src/renderer/src/components/LaneHeader.tsx` | Added DnD props (`laneIndex`, `onDragStart`, `onDragOver`, `onDrop`, `onDragEnd`, `isDragOver`); drag handle is `draggable="true"`; unmatched lane has hidden handle and no DnD events |
| `src/renderer/src/components/SwimLaneGrid.tsx` | Added `onReorderLanes` prop; local drag state (`dragSourceIndex`, `dragOverIndex`); wired drag callbacks to LaneHeader instances |
| `src/renderer/src/App.tsx` | Removed `void handleReorderLanes` suppression; passed `handleReorderLanes` to SwimLaneGrid as `onReorderLanes` |
| `src/renderer/theme/components.css` | Added `.lane-header--drag-over`, `.lane-header__drag-handle--hidden`, `.lane-header__drag-handle[draggable="true"]` CSS rules |

## Design Decisions

### 1. Draggable on Handle Span, Not Container Div (Plan Review Point #4)

Per the plan review, `draggable="true"` is set on the drag handle span (`lane-header__drag-handle`), not the container div. This allows:
- Pattern text to remain selectable
- Prevents accidental drags when clicking elsewhere on the header
- Drop target events (`onDragOver`, `onDrop`) remain on the container div for a larger hit area

### 2. Unmatched Lane: No Drag, No Drop

The "unmatched" lane (always last, implicit) renders a hidden drag handle (`visibility: hidden` via `.lane-header__drag-handle--hidden`) to preserve spacing alignment. It has no `onDragOver` or `onDrop` handlers, so it cannot be a drop target.

### 3. Drag State is Local to SwimLaneGrid

Drag state (`dragSourceIndex`, `dragOverIndex`) is transient UI state managed locally in SwimLaneGrid via `useState`. It does not leak to AppShell. Only the final reorder action calls up via `onReorderLanes(fromIndex, toIndex)`.

### 4. handleLaneDragOver Uses Functional setState

`setDragOverIndex((prev) => (prev === index ? prev : index))` avoids unnecessary re-renders when the drag-over index hasn't changed (e.g., rapid `dragover` events on the same target).

### 5. Drop Guard: Same-Position No-Op

`handleLaneDrop` checks `dragSourceIndex !== dropIndex` before calling `onReorderLanes`. This prevents unnecessary reclassification when a lane is dropped back on itself.

### 6. CSS Fallback Values for Drag Feedback

`.lane-header--drag-over` uses `var(--color-surface-hover, var(--color-grey-600))` with a fallback, ensuring visual feedback even if the token is undefined.

### 7. No Void Suppressions Remaining

The last `void handleReorderLanes` suppression from Phase 6C has been removed. All handlers defined in AppShell are now wired to UI.

## Plan Review Points Addressed

| Review Point | How Addressed |
|---|---|
| #4: Put `draggable` on handle span, not container div | `draggable="true"` is on the `<span className="lane-header__drag-handle">`, `onDragOver`/`onDrop` on the container `<div>` |

## Test Results

```
Test Files  15 passed (15)
     Tests  207 passed (207) -- all existing tests still pass
  Duration  197ms
```

Typecheck: PASS (zero errors)

## What Phase 6E Will Cover

- Playwright E2E tests for core user flows including drag-and-drop lane reordering
