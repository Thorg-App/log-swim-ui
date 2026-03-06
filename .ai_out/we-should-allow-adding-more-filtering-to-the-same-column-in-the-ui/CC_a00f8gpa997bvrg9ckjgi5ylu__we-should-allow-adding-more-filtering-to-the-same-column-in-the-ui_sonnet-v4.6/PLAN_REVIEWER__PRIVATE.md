# PLAN REVIEWER PRIVATE CONTEXT

## Review Status
Plan reviewed. One blocker found. Review written to PLAN_REVIEWER__PUBLIC.md.

## Blocker Found: handleEditLane also drops extraPatterns

`App.tsx` line 123:
```typescript
const newLane = createLaneDefinition(newPattern, { caseSensitive: existing.caseSensitive })
```

This creates a fresh LaneDefinition with `extraPatterns: []`. The plan flags the same bug in `handleToggleLaneCaseSensitivity` and fixes it with `reCaseLaneDefinition`, but misses `handleEditLane`.

### Fix direction
Introduce `rebuildLaneDefinition(newPrimaryPattern: string, existingLane: LaneDefinition): LaneDefinition` that:
1. Recompiles the primary pattern with `existingLane.caseSensitive`
2. Recompiles each entry in `existingLane.extraPatterns` with the same flag
3. Returns a full new `LaneDefinition`

This supersedes `reCaseLaneDefinition` — case-toggle is just `rebuildLaneDefinition(existing.pattern, { ...existing, caseSensitive: !existing.caseSensitive })` logically. Consider whether to keep both or unify. Unification is cleaner.

### Callers that need fixing
| Caller | Current call | Bug |
|--------|-------------|-----|
| `handleToggleLaneCaseSensitivity` | `createLaneDefinition(existing.pattern, { caseSensitive: !existing.caseSensitive })` | Drops extraPatterns |
| `handleEditLane` | `createLaneDefinition(newPattern, { caseSensitive: existing.caseSensitive })` | Drops extraPatterns |

`handleAddLane` (`createLaneDefinition(pattern)`) creates a brand-new lane — no extraPatterns to preserve. Not a bug.

## Major Concern: blur-confirms add-pattern input

FilterBar does not use blur-confirm on its add-filter form — it uses Enter to confirm and blur/Escape to cancel. LaneHeader's existing `handleConfirmEdit` uses blur-confirm. The plan says the add-pattern input mirrors `handleConfirmEdit` behavior, meaning it will also blur-confirm.

Risk: user clicks Aa toggle while add-pattern input is focused → blur fires first → partial pattern gets submitted → Aa toggle fires. This is a UX trap. Recommend blur-cancels for the add-pattern input. If implementer copies `handleConfirmEdit` pattern without reading this note, they will get the wrong behavior.

## Architecture Decision: one helper vs two

Option A (keep two helpers):
- `reCaseLaneDefinition(lane, newCaseSensitive)` — for case toggle
- Some new function for edit — e.g. `editLanePattern(lane, newPattern)` or just inline

Option B (collapse to one):
- `rebuildLaneDefinition(newPattern: string, existingExtraPatterns: readonly ExtraPatternEntry[], caseSensitive: boolean): LaneDefinition`
- Callers assemble the args explicitly

Option B is cleaner: fewer exported symbols, single recompilation logic. Recommendation: advocate for Option B in the review.

## Test Gap to Add to Plan
GIVEN a lane with 2 extra patterns, WHEN handleEditLane changes the primary pattern, THEN extraPatterns length is still 2.

## Simplification Note: compileExtraPattern internal helper
Both addExtraPatternToLane and reCaseLaneDefinition (and handleEditLane fix) all need to turn `(pattern: string, caseSensitive: boolean)` into `ExtraPatternEntry`. A private (non-exported) `compileExtraPattern` function in types.ts eliminates this duplication.

## CSS Wrapper Gap
PLANNER__PRIVATE.md says `.lane-header__extra-patterns` wrapper should have `flex-shrink: 1; min-width: 0; overflow: hidden`. Phase 6 JSX description in the public plan omits the wrapper element — implementer may not add it, producing overflow bugs. Flagged as major concern (not blocker).

## What was NOT flagged (correct decisions)
- `ExtraPatternEntry` shape (no caseSensitive field) — correct
- PatternChip as internal component, not reusing FilterChip — correct
- isAddingPattern suppresses draggable — plan correctly notes this
- .filter-add-btn CSS reuse — correct DRY level
- No per-pattern case sensitivity — correct 80/20
- No CLI arg support — correct scope exclusion
