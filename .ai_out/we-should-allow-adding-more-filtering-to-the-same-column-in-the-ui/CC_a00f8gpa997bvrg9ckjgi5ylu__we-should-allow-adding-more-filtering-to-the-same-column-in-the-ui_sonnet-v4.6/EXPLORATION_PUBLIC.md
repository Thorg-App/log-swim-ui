# Exploration: Allow Multiple Filters per Column

## Ticket Summary
"Right now a single column has a single filter we should allow adding more filtering options for the same column. It should have the same icon for adding another filter. We should DRY up and use the same icon and have the same ICON to add extra filtering to the same column."

## Interpretation (confirmed by TOP_LEVEL_AGENT)
- "column" = swimlane lane
- "single filter" = the lane's single classification regex (the `pattern` field in `LaneDefinition`)
- Feature: Allow multiple classification patterns per lane (OR logic — entry matches lane if ANY pattern matches)
- "same icon" = reuse the `.filter-add-btn` CSS class (styled as `+ Filter` button in FilterBar)
- "DRY up" = both FilterBar and LaneHeader new "+" button use same `.filter-add-btn` class

## Current Architecture

### LaneDefinition (src/core/types.ts)
```typescript
interface LaneDefinition {
  readonly pattern: string        // single regex string (primary)
  readonly regex: RegExp | null   // compiled regex (null if invalid)
  readonly isError: boolean       // true if regex compilation failed
  readonly caseSensitive: boolean // applies to regex compilation
}
```

### Lane Classification (src/core/lane-classifier.ts)
- `LaneClassifier.classify(entry, lanes)` → first lane whose `regex` matches wins
- `LaneClassifier.reclassifyAll(entries, lanes)` → reclassify all entries

### App.tsx Filter State
- `filters: readonly Filter[]` — GLOBAL filters (not per-lane), managed by FilterBar
- Per-lane filtering does NOT exist currently

### LaneHeader.tsx Props
- `pattern: string` — single pattern string
- `caseSensitive: boolean`
- Handlers: `onEdit?(newPattern)`, `onRemove?()`, `onToggleCaseSensitivity?()`
- **No multi-pattern UI**

### FilterBar.tsx
- Global include/exclude filters with `.filter-add-btn` (text: `+ Filter`)
- Filter chips (FilterChip.tsx) show each active filter with mode/remove buttons
- `.filter-add-btn` CSS class = dashed border pill button (already defined in components.css)

### LaneAddInput.tsx
- Top toolbar input for adding NEW LANES (not adding patterns to existing lanes)

## Key Files to Modify

| File | What changes |
|------|-------------|
| `src/core/types.ts` | Add `extraPatterns: readonly ExtraPatternEntry[]` to `LaneDefinition`; add `ExtraPatternEntry` interface; add `addExtraPatternToLane()` |
| `src/core/lane-classifier.ts` | Check extra patterns in OR logic during classification |
| `src/renderer/src/App.tsx` | Add handlers: `handleAddLanePattern(laneIndex, pattern)`, `handleRemoveLaneExtraPattern(laneIndex, patternIdx)` |
| `src/renderer/src/components/LaneHeader.tsx` | Show extra pattern chips + `+ Filter` button |
| `src/renderer/src/components/SwimLaneGrid.tsx` | Pass new lane pattern handlers to LaneHeader |
| `tests/unit/` | Update/add unit tests for new data model and classification |
| `tests/e2e/app.spec.ts` | Add E2E test for adding extra patterns |

## Data Model Decision
- Keep `LaneDefinition.pattern` as primary pattern (backward compat with CLI args)
- Add `extraPatterns: readonly ExtraPatternEntry[]` (starts as [])
- `ExtraPatternEntry = { pattern: string; regex: RegExp | null; isError: boolean }`
- Case sensitivity applies to ALL patterns in the lane (shared `caseSensitive` flag)
- Primary pattern: editable via inline edit (as now)
- Extra patterns: shown as removable chips (remove × only, no inline edit for simplicity)

## UI Design
LaneHeader with extra patterns:
```
[⠿] [error] [fatal×] [+ Filter] [Aa] [×]
```
- Primary `pattern` stays as the editable text (click to edit inline)
- Extra patterns = small chips with × to remove
- `+ Filter` button (same `.filter-add-btn` CSS class) between extra chips and Aa toggle
- On click `+ Filter`: shows small inline input to type regex, Enter to confirm, Escape to cancel
- Error state: chip gets error styling if pattern is invalid regex

## DRY Strategy
- Use `.filter-add-btn` CSS class on the new "+" button in LaneHeader (same as FilterBar)
- The add-pattern form in LaneHeader is simpler than FilterBar (just regex input, no include/exclude/field type)
- FilterChip component could potentially be reused for extra pattern display, or a simpler `PatternChip` internal component

## Not Changing
- Global FilterBar and its filter system (unchanged)
- Lane "Aa" case sensitivity applies to all patterns (no per-pattern case sensitivity)
- No include/exclude for per-lane patterns (these are classification patterns, not include/exclude filters)
