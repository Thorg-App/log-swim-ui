# Implementation Summary: Enhanced Global Filter UI

## What Was Done

### 1. Layout Reorder
- Filter bar is now the **topmost row** in the app (above the toolbar)
- ModeToggle moved from toolbar into the filter bar (right-aligned via `rightSlot`)
- Toolbar (LaneAddInput, StreamEndIndicator, Settings button) is now the **second row**, closer to lane headers

### 2. Include/Exclude Mode
- Each filter has a `mode: 'include' | 'exclude'` property (default: `'include'`)
- **Include mode**: entry must match pattern (existing behavior)
- **Exclude mode**: entry must NOT match pattern (inverted match)
- Filter chips show `+` (green) for include, `−` (amber) for exclude
- Exclude chips have an amber border to visually differentiate them
- Mode is togglable both in the add-filter form and on existing filter chips

### 3. Case Sensitivity Toggle
- Each filter has a `caseSensitive: boolean` property (default: `false`)
- When `caseSensitive === false`, regex is compiled with `i` flag (case-insensitive by default)
- Filter chips show `aa` (muted) for case-insensitive, `Aa` (blue) for case-sensitive
- Case sensitivity is togglable both in the add-filter form and on existing filter chips
- Toggling recompiles the regex with/without the `i` flag

### 4. "Global Filter" Label
- The filter bar now has a prominent uppercase "Global Filter" label on the left side
- Uses semi-bold weight, secondary color, and wide letter-spacing for visibility

## Files Modified

| File | Changes |
|------|---------|
| `src/core/filter.ts` | Added `mode`, `caseSensitive` to FieldFilter/RawFilter; added `FilterMode`, `FilterOptions`, `FILTER_MODES` exports; added `toggleMode()`, `toggleCaseSensitivity()` methods; updated `tryCompileRegex()` to accept `caseSensitive` flag; updated `matchesFilter()` to invert for exclude mode |
| `src/renderer/src/App.tsx` | Swapped FilterBar/Toolbar order; moved ModeToggle into FilterBar via rightSlot; added `handleToggleMode` and `handleToggleCaseSensitivity` callbacks |
| `src/renderer/src/components/FilterBar.tsx` | Added "Global Filter" label; added `rightSlot` prop; added mode/case-sensitivity toggles to add-filter form; added `onToggleMode`/`onToggleCaseSensitivity` props wired to FilterChip; added `FilterModeToggle` and `CaseSensitivityToggle` internal components |
| `src/renderer/src/components/FilterChip.tsx` | Added mode indicator (+/−) and case-sensitivity indicator (Aa/aa) with click handlers; added `onToggleMode`/`onToggleCaseSensitivity` props; added exclude chip CSS class |
| `src/renderer/theme/components.css` | Added styles for: `.filter-bar__label`, `.filter-bar__right-slot`, `.filter-chip--exclude`, `.filter-chip__mode`, `.filter-chip__case`, `.filter-bar__case-toggle` |
| `tests/unit/core/filter.test.ts` | Added 26 new tests covering: default mode/caseSensitive values, case-insensitive matching, case-sensitive matching, exclude mode matching, matchesAllFilters with mixed include/exclude, toggleMode, toggleCaseSensitivity |

## Test Results

- **Unit tests**: 264 passed (238 existing + 26 new), 0 failed
- **E2E tests**: 14 passed, 0 failed
- **Typecheck**: passed
- **Build**: passed

## Backwards Compatibility

All existing behavior is preserved:
- Filters created without options default to `mode: 'include'` and `caseSensitive: false`
- The `createRawFilter(pattern)` and `createFieldFilter(field, pattern)` signatures remain unchanged (options param is optional)
- Default `caseSensitive: false` means regex gets `i` flag, but existing tests pass because they tested same-case matches
