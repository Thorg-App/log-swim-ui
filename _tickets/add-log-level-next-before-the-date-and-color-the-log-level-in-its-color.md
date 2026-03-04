---
id: 24kndx1r4401m21nuoa5ocvcv
title: "Add log level next before the date and color the log level in its color"
status: closed
deps: []
links: []
created_iso: 2026-03-03T12:44:08Z
status_updated_iso: 2026-03-04T17:11:30Z
type: task
priority: 0
assignee: nickolaykondratyev
resolution: completed
resolution_date: 2026-03-04
---

Make sure all the log levels are assigned the same width

## Resolution

Successfully implemented log level display before timestamp in each log row.

### Changes Made

1. **CSS Styles** (`src/renderer/theme/components.css`)
   - Added `.log-row__level` base class with fixed 8ch width, right-alignment, uppercase, semibold
   - Added 10 level-specific color classes using CSS tokens

2. **Utility Functions** (`src/renderer/src/log-row-utils.ts`)
   - Extracted `normalizeLevel()` helper (DRY improvement)
   - Added `getLevelTextCssClass()` function

3. **Component** (`src/renderer/src/components/LogRow.tsx`)
   - Added level span before timestamp

4. **Tests** (`tests/unit/renderer/log-row-utils.test.ts`)
   - Added 14 unit tests for the new function
   - All 288 tests pass

### Acceptance Criteria Met
- [x] Log level appears before timestamp
- [x] Level text colored according to level (error=red, warn=orange, etc.)
- [x] All levels have same 8ch width for alignment
- [x] Works in both collapsed and expanded row states
- [x] Unknown levels handled with orange "unrecognized" color

### Commit
`85a1003` - feat: add log level badge before timestamp with color
