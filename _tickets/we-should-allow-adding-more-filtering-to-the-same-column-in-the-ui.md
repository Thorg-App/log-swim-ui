---
id: a00f8gpa997bvrg9ckjgi5ylu
title: "We should allow adding more filtering to the same column in the UI"
status: done
deps: []
links: []
created_iso: 2026-03-04T21:10:00Z
status_updated_iso: 2026-03-06T01:00:00Z
type: task
priority: 0
assignee: nickolaykondratyev
---

Right now a single column has a single filter we should allow adding more filtering options for the same column. It should have the same icon for adding another filter. We should DRY up and use the same icon and have the same ICON to add extra filtering to the same column.

## Resolution

Implemented multiple classification patterns per lane (OR logic).

### What changed
- **Data model**: `LaneDefinition` now has `extraPatterns: readonly ExtraPatternEntry[]`. Factory functions added: `addExtraPatternToLane`, `removeExtraPatternFromLane`, `rebuildLaneDefinition`.
- **Classifier**: `LaneClassifier.classify()` now checks primary pattern OR any extra pattern (first lane to match wins).
- **UI**: LaneHeader shows extra patterns as removable chips. A `+ Pattern` button (reuses `.filter-add-btn` CSS class — DRY with FilterBar) opens an inline input. Enter confirms, Escape/blur cancels.
- **Bug fixes caught during implementation**: `handleEditLane` and `handleToggleLaneCaseSensitivity` in App.tsx both called `createLaneDefinition` which would have silently dropped extra patterns. Both now use `rebuildLaneDefinition` which preserves extra patterns.
- **Tests**: 326 unit tests + 30 E2E tests all passing. 9 new E2E tests including OR routing integration test.

### Commit
`9da380b` feat: allow multiple classification patterns per lane
