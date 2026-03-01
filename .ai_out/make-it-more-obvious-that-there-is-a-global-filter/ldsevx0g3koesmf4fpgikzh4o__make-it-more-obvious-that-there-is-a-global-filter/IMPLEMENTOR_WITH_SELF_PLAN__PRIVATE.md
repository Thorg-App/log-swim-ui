# Implementor Private Notes

## Status: COMPLETE

## Plan

**Goal**: Enhance the global filter UI to be more prominent, add include/exclude mode, and add case-sensitivity toggle.

### Steps (all done)
1. [x] Update `src/core/filter.ts` — add `mode`, `caseSensitive` to filter types, update create/match methods, add `toggleMode`/`toggleCaseSensitivity`
2. [x] Add 26 new unit tests for new features (exclude mode, case-insensitive matching, toggleMode, toggleCaseSensitivity)
3. [x] Update `FilterChip.tsx` — add mode indicator (+/-), case-sensitivity indicator (Aa/aa), clickable toggles
4. [x] Update `FilterBar.tsx` — add "Global Filter" label, mode/case toggles in add-form, right-slot for ModeToggle
5. [x] Update `App.tsx` — swap FilterBar/Toolbar order, move ModeToggle into FilterBar, add handleToggleMode/handleToggleCaseSensitivity
6. [x] Add CSS styles for new elements (filter-bar label, right-slot, chip mode/case indicators, exclude chip border, case-toggle button)
7. [x] Verify E2E tests still pass (14/14 pass)
8. [x] Verify all unit tests pass (264/264 pass)
9. [x] Write documentation

## Key Design Decisions

1. **Default caseSensitive=false**: Regex compiled with 'i' flag by default. This is backwards-compatible because existing tests used same-case patterns.
2. **FilterOptions as optional parameter**: `createRawFilter(pattern, options?)` — second param is optional to preserve backwards compatibility.
3. **rightSlot pattern for FilterBar**: Used a `ReactNode` slot rather than making FilterBar aware of ModeToggle. Clean composition.
4. **CSS token adherence**: All new styles use `var()` references to existing tokens. No new tokens added (none needed).
5. **Exclude filter with null regex returns false**: Consistent with include behavior — invalid regex never blocks or passes entries.
