---
id: qz2agdescifs30s7ddovf8219
title: "Make the color theme easier to see"
status: done
deps: []
links: []
created_iso: 2026-03-01T14:52:05Z
status_updated_iso: 2026-03-02T16:26:06Z
type: task
priority: 0
assignee: nickolaykondratyev
---

Make the color theme of tooling easier to see the column headers, the text is not very legible. Look up some standard theme colors and use them.

## Resolution

**Root cause**: Two mismatched color systems — `DEFAULT_APP_CONFIG` used Bootstrap Dark palette while `tokens.css` used Tailwind Slate palette. At runtime, `applyConfigToCSS()` overrode backgrounds with Bootstrap colors but left text colors from Tailwind, creating grey-on-grey contrast issues in lane headers.

**Changes made**:

1. **Aligned `DEFAULT_APP_CONFIG`** (`src/core/types.ts`) with Tailwind Slate tokens:
   - `background`: `#212529` → `#0F172A` (matches `--color-grey-900`)
   - `swimlaneHeaders`: `#495057` → `#1E293B` (matches `--color-grey-800`)
   - `rowHover`: `#2c3034` → `#1E293B` (matches `--color-grey-800`)
   - `expandedRow`: `#343a40` → `#334155` (matches `--color-expanded-row`)
   - Level colors aligned with tokens.css values

2. **Upgraded lane header text** (`components.css`): `--color-text-secondary` → `--color-text-primary` for better contrast

3. **Improved fatal/critical level colors** (`tokens.css`): Changed from dark red `#991B1B` (near-invisible on dark bg) to purple `#A855F7` / pink `#F472B6` for visibility and distinction from error

All 274 unit tests pass. Existing user configs are unaffected (only fresh installs/config resets see new defaults).
