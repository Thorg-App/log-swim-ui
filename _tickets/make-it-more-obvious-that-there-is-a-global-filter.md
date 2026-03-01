---
id: ldsevx0g3koesmf4fpgikzh4o
title: "Make it more obvious that there is a global filter"
status: done
deps: []
links: []
created_iso: 2026-03-01T14:39:18Z
status_updated_iso: 2026-03-01T14:56:27Z
type: task
priority: 0
assignee: nickolaykondratyev
---

We should make it more obvious how the global filter works and extend the global filter.

The global filtering group should be the topmost line. While the addition of column filtering should be closer the columns themselves.

The global filter should have ability to FILTER to match and to FILTER to NOT match (exclusion filter).

We should also CLARIFY the naming of "Filter" to something like "Global Include/Exclude Filter"

WITH filtering we should allow case-sensitive or case-insensitive filtering. That should be a flag. The default should be case-insensitive filtering for the global filter (users should be able to toggle.)

---

## Resolution

**Completed** on 2026-03-01. Branch: `ldsevx0g3koesmf4fpgikzh4o__make-it-more-obvious-that-there-is-a-global-filter`

### Changes Made

1. **Layout reorder**: FilterBar is now the topmost row (shared with ModeToggle on the right). Toolbar (LaneAddInput, StreamEndIndicator, Settings) is the second row, closer to lane headers.
2. **"Global Filter" label**: Prominent uppercase label on the left of the filter bar.
3. **Include/Exclude mode**: Each filter has `mode: 'include' | 'exclude'`. Exclude inverts the match. Togglable on chips (`+`/`−` indicators) and in the add-filter form.
4. **Case sensitivity toggle**: Each filter has `caseSensitive: boolean` (default: `false`). When insensitive, regex compiled with `i` flag. Togglable on chips (`Aa`/`aa` indicators) and in the add-filter form.

### Files Modified
- `src/core/filter.ts` — FilterMode, FilterOptions, toggleMode(), toggleCaseSensitivity(), updated match logic
- `src/renderer/src/App.tsx` — Layout reorder, new toggle handlers, ModeToggle in FilterBar rightSlot
- `src/renderer/src/components/FilterBar.tsx` — "Global Filter" label, rightSlot composition, mode/case toggles in form
- `src/renderer/src/components/FilterChip.tsx` — Mode/case indicators, click handlers
- `src/renderer/theme/components.css` — New styles for label, indicators, exclude chip
- `tests/unit/core/filter.test.ts` — 26 new BDD tests (264 total, all passing)
- `CLAUDE.md` — Updated project structure documentation