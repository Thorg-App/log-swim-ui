# Exploration: Make Entire Header of Columns Draggable

## Summary

Currently only a small `⠿` drag handle span is draggable. The ticket requires making the entire lane header div draggable.

## Key Files

| File | Role |
|------|------|
| `src/renderer/src/components/LaneHeader.tsx` | Lane column header component - needs changes |
| `src/renderer/theme/components.css` | CSS for lane-header - needs cursor updates |
| `src/renderer/src/components/SwimLaneGrid.tsx` | Drag state management (dragSourceIndex, dragOverIndex) - may need changes |

## Current Drag Implementation

- `draggable="true"` is on `<span className="lane-header__drag-handle">` (the ⠿ icon span)
- `onDragStart` / `onDragEnd` are on that span
- `onDragOver` / `onDrop` are on the header container `<div>`
- The span's event handlers accept `DragEvent<HTMLSpanElement>`
- `isDraggable` prop (boolean) controls whether drag events are wired (unmatched lane is not draggable)

## CSS State

- `.lane-header__drag-handle[draggable="true"]` → `cursor: grab`
- `.lane-header__drag-handle[draggable="true"]:active` → `cursor: grabbing`
- `.lane-header--drag-over` → visual drop-target indicator (background + border)
- `.lane-header__pattern` → `cursor: text` (click to edit)

## Required Changes

### LaneHeader.tsx
1. Move `draggable={isDraggable}` from the span to the header container div
2. Move `onDragStart={handleDragStart}` and `onDragEnd={handleDragEnd}` to the div
3. Update `handleDragStart`/`handleDragEnd` type signatures: `DragEvent<HTMLSpanElement>` → `DragEvent<HTMLDivElement>`
4. Keep the ⠿ visual indicator span (without draggable attr) as a non-interactive affordance hint
5. Remove `draggable` / drag handlers from the span

### components.css
1. Add `cursor: grab` to `.lane-header` when `isDraggable` → use `[draggable="true"]` attribute selector on `.lane-header`
2. Add `cursor: grabbing` when active
3. Keep `.lane-header__drag-handle` styles but remove the `[draggable="true"]` cursor rules (cursor now on the container)

## UX Considerations

- Pattern text (`cursor: text`) should still allow click-to-edit inline — the click handler is separate from drag
- The ⠿ icon is kept as a visual hint that the lane is reorderable
- Unmatched lane: `isDraggable=false` → no drag behavior on the header div

## No SwimLaneGrid.tsx Changes Needed

SwimLaneGrid already handles drag-over/drop on the header div level; state management is intact.
