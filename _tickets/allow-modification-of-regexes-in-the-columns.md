---
id: p9wkzl3ssicxaor9yap8m2aib
title: "Allow modification of regexes in the columns"
status: done
deps: []
links: []
created_iso: 2026-03-01T14:54:23Z
status_updated_iso: 2026-03-01T16:01:51Z
type: task
priority: 0
assignee: nickolaykondratyev
---

Allow modifications of regexes in the columns by exposing all the same filtering functionality

## Resolution

Implemented three new interactive capabilities on lane headers:

### 1. Inline Regex Edit
- Click on lane pattern text to enter edit mode (shows input field)
- Enter or blur to confirm, Escape to cancel
- Empty/whitespace-only pattern is silently rejected (reverts to original)
- Same-pattern edit is a no-op
- Invalid regex produces error state (graceful degradation)

### 2. Remove Lane (× button)
- × button on each lane header (not shown on "unmatched")
- Removes lane and reclassifies all entries

### 3. Case Sensitivity Toggle (Aa/aa)
- Aa/aa toggle button on each lane header (not shown on "unmatched")
- Aa = case-sensitive (default), aa = case-insensitive (adds `i` flag)
- Extended `LaneDefinition` with `caseSensitive: boolean` (defaults to `true` for backward compat)

### Files Modified
- `src/core/types.ts` — `LaneDefinition` + `createLaneDefinition` with `CreateLaneDefinitionOptions`
- `src/renderer/src/App.tsx` — 3 new handlers: `handleEditLane`, `handleRemoveLane`, `handleToggleLaneCaseSensitivity`
- `src/renderer/src/components/SwimLaneGrid.tsx` — new props forwarded to LaneHeader
- `src/renderer/src/components/LaneHeader.tsx` — edit mode, remove button, case toggle
- `src/renderer/theme/components.css` — styles for new elements
- `CLAUDE.md` — updated component descriptions, E2E test count 15→21

### Tests Added
- 9 new unit tests (caseSensitive behavior + case-insensitive classification)
- 6 new E2E tests (edit/cancel/remove/case-toggle)
- All 274 unit tests + 21 E2E tests pass
