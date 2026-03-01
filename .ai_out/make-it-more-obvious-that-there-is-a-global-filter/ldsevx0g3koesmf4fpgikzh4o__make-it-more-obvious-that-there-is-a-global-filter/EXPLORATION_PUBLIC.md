# Exploration Summary

## Current Filter System

### Architecture
- **Two filter types** (discriminated union): `RawFilter` (matches `rawJson`) and `FieldFilter` (matches specific JSON field)
- **AND logic**: Entry must pass ALL enabled filters to be displayed
- **Inclusion only**: No exclusion/negation filter support
- **Case-sensitive only**: Regex is always case-sensitive (no toggle)
- **FilterEngine** (`src/core/filter.ts`): Static utility class with create/toggle/match methods
- **Immutable state**: All filter mutations return new objects

### Current UI Layout (top to bottom)
1. **Toolbar** (`app-toolbar`): ModeToggle, LaneAddInput, StreamEndIndicator, Settings button
2. **FilterBar** (`filter-bar`): Filter chips + "+ Filter" add button/form
3. **SwimLaneGrid** (`app-main`): Lane headers (CSS grid row 1) + virtualized log rows (row 2)
4. **UnparseablePanel** (conditional, bottom)

### FilterBar Component
- Horizontal bar between toolbar and grid
- Contains filter chips (pill-shaped, monospace, toggleable, removable)
- Inline add form with type toggle (raw | field), pattern input, add/cancel buttons
- No label/title - just chips and add button
- Height: `var(--filter-bar-height)` = 48px

### Filter Application in SwimLaneGrid
- `useMemo` computes `filteredIndices` array when filters change
- Fast path: if no active filters, `filteredIndices === null` (no overhead)
- Virtualizer maps through filtered indices to masterList

### Key Files
| File | Purpose |
|------|---------|
| `src/core/filter.ts` | FilterEngine + Filter types |
| `src/core/types.ts` | LogEntry, shared types |
| `src/renderer/src/App.tsx` | Filter state management, layout |
| `src/renderer/src/components/FilterBar.tsx` | Filter UI bar |
| `src/renderer/src/components/FilterChip.tsx` | Individual filter chip |
| `src/renderer/src/components/SwimLaneGrid.tsx` | Filter application + rendering |
| `src/renderer/theme/tokens.css` | CSS tokens |
| `src/renderer/theme/components.css` | Component styles |

## What Needs to Change (per ticket)
1. Global filter bar → topmost line, more prominent
2. Add include/exclude mode to filters
3. Add case-sensitivity toggle (default: case-insensitive)
4. Rename to "Global Include/Exclude Filter" or similar
5. "Column filtering closer to columns" - ambiguous (see clarification needed)
