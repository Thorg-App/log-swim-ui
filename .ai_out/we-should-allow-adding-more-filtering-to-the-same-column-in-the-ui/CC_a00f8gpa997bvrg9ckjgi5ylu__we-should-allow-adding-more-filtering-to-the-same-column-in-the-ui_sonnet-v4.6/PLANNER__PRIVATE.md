# PLANNER PRIVATE CONTEXT

## Status
Plan v2 complete. Incorporates all PLAN_REVIEWER feedback. Written to PLANNER__PUBLIC.md.

## Changes from v1 → v2

### Critical blocker fixed
`handleEditLane` in App.tsx calls `createLaneDefinition(newPattern, { caseSensitive: existing.caseSensitive })` which silently drops `extraPatterns`. This was the same class of bug as the `handleToggleLaneCaseSensitivity` issue identified in v1, but it was missed.

Fix: `reCaseLaneDefinition` has been replaced by a single, more general `rebuildLaneDefinition(newPrimaryPattern, existingLane, caseSensitive): LaneDefinition`. Both App.tsx callsites now use it:
- Case toggle: `rebuildLaneDefinition(existing.pattern, existing, !existing.caseSensitive)`
- Edit primary: `rebuildLaneDefinition(newPattern, existing, existing.caseSensitive)`

This is fewer exported symbols and a single implementation to test. Phase 4 (the separate reCaseLaneDefinition phase) has been folded into Phase 1 step 7.

### Major feedback addressed
1. **Blur cancels (not confirms) the add-pattern input.** `onBlur` fires before `onClick`, so if blur-confirmed, clicking the Aa toggle or × button while the input is open would silently submit partial text before the button action fires. Blur-cancels mirrors FilterBar behavior and avoids the UX trap.

2. **`lane-header__extra-patterns` wrapper is now required (not "if used") in the Phase 6 JSX description.** Explicitly included in the JSX layout with `flex-shrink: 1; min-width: 0; overflow: hidden` to prevent chip overflow.

### Minor feedback accepted
- E2E test 4 (OR routing): changed from "unmatched row count decreases" to "warn-only entry appears in the error lane column" — more direct, less brittle.
- Phase ordering note added to the public plan: unit tests for Phases 1+2 should be written immediately after implementing those phases (before moving to Phase 3+).
- `addPatternInputRef` focus effect uses `[isAddingPattern]` as its own dependency array, separate from the existing `[isEditing]` effect.
- `compileExtraPattern` private helper added to types.ts to DRY up the try/catch compilation logic used by both `addExtraPatternToLane` and `rebuildLaneDefinition`.

## Key Architectural Decisions (Preserved from v1, with updates)

### 1. ExtraPatternEntry vs reusing LaneDefinition recursively
Rejected recursive `LaneDefinition[]` for extra patterns because:
- `caseSensitive` on sub-entries would be misleading (it's a lane-level concern)
- It would make the classifier loop more complex with no gain
- `ExtraPatternEntry = { pattern, regex, isError }` is the minimal correct shape

### 2. rebuildLaneDefinition is mandatory — not optional cleanup
Two App.tsx callsites will silently drop `extraPatterns` without it:
- `handleToggleLaneCaseSensitivity` (identified in v1)
- `handleEditLane` (identified in review, fixed in v2)
Both must use `rebuildLaneDefinition`. Unit tests must cover both scenarios.

### 3. PatternChip as internal LaneHeader component (not exported)
The chip for extra patterns does NOT need mode toggle, case sensitivity toggle, or enabled/disabled state.
Reusing `FilterChip` would be wrong (POLS violation — FilterChip shows +/- mode indicators).
A minimal internal `PatternChip` is the right boundary: it renders pattern text and a × remove button.
This is a deliberate NOT-DRY choice at the component level — the shared CSS class `.filter-add-btn` is the DRY point.

### 4. compileExtraPattern is private, not exported
It's purely an internal DRY helper within types.ts. Exporting it would expand the module's public API surface for no benefit.

### 5. 80/20 choices explicitly scoped out
- No per-extra-pattern case sensitivity (one lane-level `caseSensitive` flag for all)
- No inline editing of extra patterns (chips are remove-only)
- No CLI arg support for extra patterns in `--lanes`
- No overflow handling for many chips (clip is acceptable; follow-up ticket if needed)

## File Change Map

| File | Type of Change |
|------|---------------|
| `src/core/types.ts` | Add ExtraPatternEntry interface; extend LaneDefinition; update createLaneDefinition; add private compileExtraPattern; add addExtraPatternToLane, removeExtraPatternFromLane, rebuildLaneDefinition |
| `src/core/lane-classifier.ts` | Extend classify() to OR over extraPatterns |
| `src/renderer/src/App.tsx` | Add handleAddLanePattern, handleRemoveLaneExtraPattern; fix handleToggleLaneCaseSensitivity and handleEditLane to use rebuildLaneDefinition; pass new props to SwimLaneGrid |
| `src/renderer/src/components/SwimLaneGrid.tsx` | Extend SwimLaneGridProps; thread new handlers to LaneHeader |
| `src/renderer/src/components/LaneHeader.tsx` | Extend props; add isAddingPattern state; add PatternChip internal component; render chips + add form |
| `src/renderer/theme/components.css` | Add lane-header__extra-patterns, lane-header__extra-chip, lane-header__extra-chip--error, lane-header__add-form, lane-header__add-input classes |
| `tests/unit/core/types.test.ts` | Add tests for addExtraPatternToLane, removeExtraPatternFromLane, rebuildLaneDefinition |
| `tests/unit/core/lane-classifier.test.ts` | Add OR logic tests |
| `tests/e2e/app.spec.ts` | Add extra-pattern E2E test block |

## Critical Test IDs to Add (for E2E stability)

- `data-testid="lane-header-add-pattern-btn"` — the `+ Pattern` button
- `data-testid="lane-header-add-pattern-input"` — the inline add input
- `data-testid="lane-header-extra-chip"` — each extra pattern chip wrapper
- `data-testid="lane-header-extra-chip-remove"` — each chip's × button

## Correctness Trap: Drag Suppression

The `draggable` attribute on the lane-header div must be suppressed when `isAddingPattern` is true.
Current condition: `draggable={isDraggable && !isEditing ? true : undefined}`
Must become:       `draggable={isDraggable && !isEditing && !isAddingPattern ? true : undefined}`
Same applies to `onDragStart` and `onDragEnd` handlers.

## Implementation Order Recommended

1. Phase 1 (types.ts) — pure data model, no UI
2. Phase 2 (lane-classifier.ts) — pure logic
3. Unit tests for Phases 1+2 immediately (before any UI work)
4. Phase 3 (App.tsx handlers) — wire data through, fix rebuildLaneDefinition callsites
5. Phase 5 (SwimLaneGrid prop threading) — mechanical prop pass-through
6. Phase 6 (LaneHeader UI) — most complex UI change
7. Phase 7 (remaining unit tests not yet written)
8. Phase 8 (E2E tests) — after build is successful

## CSS Note

The `.filter-add-btn` class already exists and is shared. No duplication needed.
New CSS additions are purely for:
- `.lane-header__extra-patterns` (required wrapper, NOT optional)
- `.lane-header__extra-chip` (the chip itself)
- `.lane-header__extra-chip--error` (red border for invalid regex)
- `.lane-header__add-form` (flex container for the inline add form)
- `.lane-header__add-input` (the short text input inside the add form)

The lane-header already uses `display: flex; align-items: center; gap: var(--space-2)`.
Extra patterns will flow into that same flex row between the primary pattern and the add button.
The `lane-header__extra-patterns` wrapper MUST have `flex-shrink: 1; min-width: 0; overflow: hidden` to avoid blowing out the header width.

## Blur Behavior Decision

The add-pattern input uses blur-cancels (not blur-confirms). Reason: DOM event order means `onBlur` fires before `onClick`. Blur-confirm would silently submit partial text when the user clicks Aa or × while the input is open. This is the same behavior as FilterBar and is the correct choice here.
