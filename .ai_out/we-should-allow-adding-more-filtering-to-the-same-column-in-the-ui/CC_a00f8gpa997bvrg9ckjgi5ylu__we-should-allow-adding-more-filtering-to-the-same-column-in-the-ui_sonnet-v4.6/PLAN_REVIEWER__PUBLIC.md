# Plan Review: Allow Multiple Classification Patterns per Lane

## Executive Summary

The plan is well-structured and correctly addresses the ticket. The data model extension is sound, the OR-logic classifier change is minimal and correct, and the 80/20 scoping decisions are appropriate. One critical correctness gap was missed: `handleEditLane` in `App.tsx` also calls `createLaneDefinition` and will silently drop `extraPatterns` when the primary pattern is edited — the plan only flags this for `handleToggleLaneCaseSensitivity`. This must be fixed before implementation. All other concerns are minor or cosmetic.

---

## Critical Issues (BLOCKERS)

### `handleEditLane` also drops `extraPatterns`

**Issue:** The plan correctly identifies that `handleToggleLaneCaseSensitivity` calls `createLaneDefinition(existing.pattern, ...)` and will silently discard `extraPatterns`. It introduces `reCaseLaneDefinition` as the fix. However, `handleEditLane` in `App.tsx` (line 123) has the same problem:

```typescript
const newLane = createLaneDefinition(newPattern, { caseSensitive: existing.caseSensitive })
```

This creates a brand-new `LaneDefinition` with `extraPatterns: []`. If a user has added extra patterns to a lane and then edits the primary pattern, all extra patterns are silently erased.

**Impact:** Data loss on a core user action (inline edit). The fix for `caseSensitive` is explicitly called out in Phase 3/4, but `handleEditLane` is not mentioned. An implementer following the plan will not catch this.

**Recommendation:** Add a `rebuiltLaneDefinition(newPrimaryPattern: string, existingLane: LaneDefinition): LaneDefinition` helper (or expand the scope of `reCaseLaneDefinition`) that carries `extraPatterns` forward, recompiling each with the existing `caseSensitive` flag and the new primary pattern. `handleEditLane` must use this instead of bare `createLaneDefinition`. Add a unit test: GIVEN a lane with 2 extra patterns, WHEN the primary pattern is edited, THEN `extraPatterns` length is still 2.

**Suggested helper name:** `rebuildLaneDefinition(newPattern: string, lane: LaneDefinition): LaneDefinition` in `types.ts`. This subsumes `reCaseLaneDefinition` because both operations (edit primary + toggle case) are "rebuild the full lane from existing parts." Consider collapsing Phase 3 and Phase 4 around this single, more general helper to avoid having two nearly identical factory functions.

---

## Major Concerns

### `blur` confirming the add-pattern input may cause unexpected submissions

**Concern:** Phase 6 states "blur confirms" for the inline add-pattern input. The existing primary-pattern `handleConfirmEdit` does the same on blur, but in the filter-add context this is more dangerous: a user who clicks the Aa toggle or the remove button while the input is focused will trigger an unintended pattern submission.

**Why:** `onBlur` fires before `onClick` in the DOM event order, so clicking the Aa or × buttons while the input is open will first confirm whatever partial text is in the input, then perform the button action. This is a subtle UX trap.

**Suggestion:** Mirror FilterBar's behavior: blur should cancel, not confirm. Enter confirms, Escape cancels, blur cancels. If blur-confirms is intentional (matches existing `handleConfirmEdit`), document it explicitly as a known trade-off and add a unit/E2E note. Either way, the plan should be explicit about which behavior is intended.

### `lane-header__extra-patterns` wrapper not guaranteed in Phase 6 spec

**Concern:** The plan mentions the `lane-header__extra-patterns` wrapper div in the CSS section and the PLANNER__PRIVATE.md notes, but it is described as "if used" in the PRIVATE notes, and is absent from the Phase 6 JSX layout description. The JSX description says chips go "after the primary pattern span," without specifying the wrapper element. An implementer may omit the wrapper and produce a layout that overflows the header on long chip lists.

**Why:** Without `flex-shrink: 1; min-width: 0; overflow: hidden` on a containing element, the flex layout will expand beyond the header bounds when multiple chips are present.

**Suggestion:** Phase 6 should explicitly include the wrapper element in the JSX layout description. The CSS spec for `.lane-header__extra-patterns` is already correct; the JSX description should match.

---

## Simplification Opportunities (PARETO)

### Collapse `reCaseLaneDefinition` into a general `rebuildLaneDefinition`

The plan introduces `reCaseLaneDefinition(lane, caseSensitive)` as a helper. Once the `handleEditLane` bug above is fixed, you will also need a way to rebuild with a new primary pattern. Rather than two helpers with overlapping logic, a single:

```typescript
function rebuildLaneDefinition(
  newPrimaryPattern: string,
  existingExtraPatterns: readonly ExtraPatternEntry[],
  caseSensitive: boolean
): LaneDefinition
```

...or an options-based variant, covers both edit and case-toggle in one function. The callers become:

```typescript
// Case toggle:
rebuildLaneDefinition(existing.pattern, existing.extraPatterns, !existing.caseSensitive)

// Edit primary:
rebuildLaneDefinition(newPattern, existing.extraPatterns, existing.caseSensitive)
```

This is fewer exported symbols and a single implementation to test. Value: eliminates duplicated recompilation logic, reduces exported API surface.

### `ExtraPatternEntry` recompilation logic is duplicated across helpers

`addExtraPatternToLane` and `reCaseLaneDefinition` both need to compile a `(pattern, caseSensitive)` pair into an `ExtraPatternEntry`. Extract a private helper `compileExtraPattern(pattern: string, caseSensitive: boolean): ExtraPatternEntry` inside `types.ts`. Not exported; purely internal DRY.

---

## Minor Suggestions

- **E2E test 4 (OR routing) is the most fragile.** It relies on "unmatched lane row count decreases" which requires knowing the initial unmatched count. A more robust assertion: inject a log line whose raw JSON contains only `"warn"` (e.g. `{"level":"warn","msg":"warn-only"}`), add `"warn"` as extra pattern to the error lane, then assert that the warn log row appears in the error lane column (not unmatched). This is more direct and less brittle than counting rows.

- **`data-testid="lane-header-extra-chip"` on each chip:** When there are multiple chips, `page.locator('[data-testid="lane-header-extra-chip"]')` returns a list. E2E test 3 asserts "count >= 1" which is fine. Recommend also asserting the chip text contains the entered pattern (e.g. `page.locator('[data-testid="lane-header-extra-chip"]').first().textContent()` contains `"warn"`). The plan mentions this; just make sure it is in the actual test code.

- **Phase ordering in PLANNER__PRIVATE.md** recommends writing unit tests immediately after Phase 2 (core logic). This is good practice and should be explicitly noted in the public plan as well. Currently Phase 7 (unit tests) is listed last, which an implementer following the public plan might defer.

- **`addPatternInputRef.current` focus:** The plan says to "mirror existing `isEditing` focus effect." The existing focus effect uses `useEffect` with `[isEditing]` dependency. An implementer should use `[isAddingPattern]` as the dependency for the new effect. This is obvious but worth stating explicitly to avoid combining the effects.

- **CSS class name:** The plan uses `.lane-header__add-input` for the inline add-pattern input. The existing edit input is `.lane-header__edit-input`. These are parallel. Consider whether they can share a common base class to avoid duplicating the input dimension/padding/border CSS. Not a blocker, but worth a single CSS variable reference if `lane-header__edit-input` is already parameterized by tokens.

---

## Strengths

- **The `reCaseLaneDefinition` correctness trap is identified.** This is the most subtle bug that would emerge from naive implementation, and the plan calls it out explicitly with a required unit test. Strong signal that the planner thought through the mutation scenarios carefully.

- **PatternChip as internal component (not exported, not reusing FilterChip)** is the correct boundary decision. `FilterChip` has mode toggle, case toggle, and enable/disable state that are actively misleading for classification-pattern chips. The plan's reasoning in PLANNER__PRIVATE.md is sound.

- **`isAddingPattern` suppressing `draggable`** is correctly identified and called out. This is a non-obvious DnD correctness trap and the plan captures it precisely.

- **`.filter-add-btn` CSS reuse** is the right level of DRY. The button appearance is shared; the behavior and context are different enough that no component-level reuse is needed.

- **80/20 scoping** is well-executed: no per-pattern case sensitivity, no inline editing of extra patterns, no CLI argument extension, no overflow scrolling. All are correct exclusions for this ticket size.

- **`ExtraPatternEntry` shape** (pattern + regex + isError, no caseSensitive) is minimal and correct. The planner explicitly rejected recursive `LaneDefinition[]` for good reasons stated in PRIVATE.

- **Test coverage for `addExtraPatternToLane` immutability** (original lane unchanged) is present. This is the kind of assertion that prevents subtle bugs when future code accidentally mutates the array.

- **`compileExtraPattern` logic implicit in `addExtraPatternToLane`** correctly uses the lane's `caseSensitive` flag at time of addition. This is the right behavior.

---

## Verdict

- [ ] APPROVED
- [ ] APPROVED WITH MINOR REVISIONS
- [x] NEEDS REVISION
- [ ] REJECTED

**One blocker must be resolved before implementation begins:** `handleEditLane` silently drops `extraPatterns` — this is the same class of bug as the `reCaseLaneDefinition` fix but was not caught. Fix it by expanding the `reCaseLaneDefinition` helper (or replacing it with a more general `rebuildLaneDefinition`) and updating `handleEditLane` to use it. Add the corresponding unit test. The blur-confirms behavior for the add-pattern input should also be clarified/documented before implementation.
