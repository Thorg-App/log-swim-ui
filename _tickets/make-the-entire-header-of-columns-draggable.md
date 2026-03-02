---
id: d36nprfywbttypqw8an9db92c
title: "Make the entire header of columns draggable"
status: done
deps: []
links: []
created_iso: 2026-03-01T14:51:24Z
status_updated_iso: 2026-03-02T18:00:00Z
type: task
priority: 0
assignee: nickolaykondratyev
---

## Resolution

Moved `draggable`, `onDragStart`, and `onDragEnd` from the small `⠿` drag-handle span to the entire lane header `<div>`. The header is now the drag initiator AND drop target.

**Changes:**
- `LaneHeader.tsx`: `draggable` / `onDragStart` / `onDragEnd` moved to container div, gated on `isDraggable && !isEditing` (disables drag while inline editing to prevent text-selection regression)
- `components.css`: cursor `grab`/`grabbing` rules moved from `.lane-header__drag-handle[draggable="true"]` to `.lane-header[draggable="true"]`

The `⠿` icon is retained as a visual affordance hint (no `draggable` attr). Unmatched lane remains non-draggable.
