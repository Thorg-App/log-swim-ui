# Plan: Allow Multiple Classification Patterns per Lane

## 1. Problem Understanding

Each swimlane currently accepts exactly one regex `pattern` (stored in `LaneDefinition.pattern`). The ticket asks to allow multiple classification patterns per lane using OR logic: an entry is routed to the lane if ANY of its patterns match the raw JSON.

Key confirmed constraints:
- The "+" button to add another pattern reuses the `.filter-add-btn` CSS class (DRY with FilterBar).
- The primary pattern stays as-is (click-to-edit inline).
- Extra patterns are displayed as simple removable chips (no inline edit — 80/20 simplicity).
- Case sensitivity applies to ALL patterns in the lane via the existing shared `caseSensitive` flag.
- The feature does NOT touch global FilterBar or its filter system.

---

## 2. High-Level Architecture

### Data Model Addition

`LaneDefinition` gains a new readonly field:

```
extraPatterns: readonly ExtraPatternEntry[]
```

`ExtraPatternEntry` mirrors the primary pattern's compiled-regex shape but without `caseSensitive` (that remains a lane-level flag):

```
interface ExtraPatternEntry {
  readonly pattern: string
  readonly regex: RegExp | null
  readonly isError: boolean
}
```

### Classification Change (OR logic)

`LaneClassifier.classify()` currently checks `lane.regex`. After the change it checks:
- `lane.regex` (primary) — as today
- For each entry in `lane.extraPatterns`: check `entry.regex`

The first lane where ANY pattern matches wins. Lane-level first-match semantics are preserved; the OR expansion is within a single lane.

### UI Shape

```
LaneHeader (before):
  [⠿] [error-pattern-text] [Aa] [×]

LaneHeader (after, with extra patterns):
  [⠿] [error] [fatal×] [auth×] [+ Pattern] [Aa] [×]
         ^primary   ^chips        ^add btn
```

When `+ Pattern` is clicked an inline input appears (auto-focused), Enter confirms, Escape cancels, blur cancels. This mirrors FilterBar's `isAdding` state pattern exactly (blur cancels, not confirms).

### Data Flow

```
App.tsx
  handleAddLanePattern(laneIndex, newPattern)    -> calls addExtraPatternToLane() helper -> applyLaneChange()
  handleRemoveLaneExtraPattern(laneIndex, extraIdx) -> removes from extraPatterns array -> applyLaneChange()

SwimLaneGrid.tsx
  threads onAddLanePattern + onRemoveLaneExtraPattern down to LaneHeader

LaneHeader.tsx
  receives extraPatterns[], onAddLanePattern, onRemoveLaneExtraPattern
  renders chips + inline add-form
```

---

## 3. Implementation Phases

Recommended implementation order: Phase 1 → Phase 2 → unit tests for Phases 1+2 (inline, before moving on) → Phase 4 → Phase 3 → Phase 5 → Phase 6 → Phase 7 (remaining unit tests) → Phase 8 (E2E). Writing unit tests for Phases 1 and 2 immediately after implementing them catches data model and classifier bugs before any UI code is written.

---

### Phase 1 — Core Data Model (`src/core/types.ts`)

**Goal:** Extend `LaneDefinition` with extra patterns. Keep backward compatibility (all existing callers of `createLaneDefinition` still work because `extraPatterns` defaults to `[]`).

**Key Steps:**

1. Add `ExtraPatternEntry` interface (before `LaneDefinition`):
   ```typescript
   interface ExtraPatternEntry {
     readonly pattern: string
     readonly regex: RegExp | null
     readonly isError: boolean
   }
   ```

2. Add `extraPatterns: readonly ExtraPatternEntry[]` field to `LaneDefinition`. Make it the last field so existing destructuring is not broken.

3. Update `createLaneDefinition()` to initialize `extraPatterns: []`.

4. Add a private (non-exported) helper `compileExtraPattern(pattern: string, caseSensitive: boolean): ExtraPatternEntry` inside `types.ts`. This is the single place that compiles `(pattern, caseSensitive)` into an `ExtraPatternEntry`. Used by `addExtraPatternToLane` and `rebuildLaneDefinition` to avoid duplicating the try/catch compilation logic.

5. Add `addExtraPatternToLane(lane: LaneDefinition, pattern: string): LaneDefinition` pure factory function. It:
   - Uses `compileExtraPattern(pattern, lane.caseSensitive)` to build the entry.
   - Returns a new `LaneDefinition` with `extraPatterns` appended (immutable update).

6. Add `removeExtraPatternFromLane(lane: LaneDefinition, index: number): LaneDefinition` pure factory function. Returns a new `LaneDefinition` with the specified extra pattern removed.

7. Add `rebuildLaneDefinition(newPrimaryPattern: string, existingLane: LaneDefinition, caseSensitive: boolean): LaneDefinition` pure factory function. This replaces the former `reCaseLaneDefinition` concept and is the single helper for any "rebuild the full lane from parts" operation:
   - Recompiles the primary pattern with the new `caseSensitive` flag (via `createLaneDefinition` internals or equivalent).
   - Recompiles each existing `extraPatterns` entry via `compileExtraPattern(entry.pattern, caseSensitive)`.
   - Returns a fully rebuilt `LaneDefinition` preserving all extra patterns.
   - Callers:
     - Case toggle: `rebuildLaneDefinition(existing.pattern, existing, !existing.caseSensitive)`
     - Edit primary pattern: `rebuildLaneDefinition(newPattern, existing, existing.caseSensitive)`

8. Export `ExtraPatternEntry` type and `addExtraPatternToLane`, `removeExtraPatternFromLane`, `rebuildLaneDefinition` functions. Do NOT export `compileExtraPattern` (internal DRY only).

**Verification:** `npm run typecheck` passes. Existing `createLaneDefinition` callsites compile without change.

---

### Phase 2 — Classifier OR Logic (`src/core/lane-classifier.ts`)

**Goal:** Extend `classify()` to test extra patterns, maintaining first-match-wins per lane.

**Key Steps:**

1. In `LaneClassifier.classify()`, after checking `lane.regex`, add a loop over `lane.extraPatterns`. The lane matches if any regex in extraPatterns is non-null and `.test(rawJson)` returns true. Combined:

   ```
   primaryMatches = lane.regex !== null && lane.regex.test(rawJson)
   extraMatches = lane.extraPatterns.some(ep => ep.regex !== null && ep.regex.test(rawJson))
   if (primaryMatches || extraMatches) return i
   ```

2. No changes to `reclassifyAll()` — it calls `classify()` internally.

**Verification:** All existing unit tests still pass. New tests (written immediately after this phase) cover OR logic.

---

### Phase 3 — App.tsx Handlers

**Goal:** Wire two new lane mutation handlers and fix `handleEditLane` and `handleToggleLaneCaseSensitivity` to preserve `extraPatterns`.

**Key Steps:**

1. Import `addExtraPatternToLane`, `removeExtraPatternFromLane`, and `rebuildLaneDefinition` from `@core/types`.

2. Fix `handleToggleLaneCaseSensitivity`: replace the current `createLaneDefinition(existing.pattern, ...)` call with `rebuildLaneDefinition(existing.pattern, existing, !existing.caseSensitive)`. This preserves all extra patterns and recompiles them with the new case sensitivity flag.

3. Fix `handleEditLane`: replace the current `createLaneDefinition(newPattern, { caseSensitive: existing.caseSensitive })` call with `rebuildLaneDefinition(newPattern, existing, existing.caseSensitive)`. This preserves all extra patterns when the primary pattern is edited.

4. Add `handleAddLanePattern(laneIndex: number, pattern: string)`:
   - Guards: `lanes[laneIndex]` must exist and `pattern.trim()` must be non-empty.
   - Calls `addExtraPatternToLane(existing, pattern.trim())` to get the new lane.
   - Calls `applyLaneChange(newLanes)`.

5. Add `handleRemoveLaneExtraPattern(laneIndex: number, extraIndex: number)`:
   - Guards: `lanes[laneIndex]` must exist.
   - Calls `removeExtraPatternFromLane(existing, extraIndex)` to get the new lane.
   - Calls `applyLaneChange(newLanes)`.

6. Pass both new handlers to `SwimLaneGrid` as `onAddLanePattern` and `onRemoveLaneExtraPattern`.

**Verification:** TypeScript compiles. Manual test: add extra pattern, toggle case sensitivity, verify extra patterns survive. Edit primary pattern, verify extra patterns survive.

---

### Phase 4 — (Moved to Phase 1, step 7)

Phase 4 is now folded into Phase 1 step 7. The `rebuildLaneDefinition` helper in `types.ts` is the correctness fix for both `handleToggleLaneCaseSensitivity` and `handleEditLane`. It is implemented in Phase 1 and used in Phase 3.

---

### Phase 5 — SwimLaneGrid.tsx Prop Threading

**Goal:** Thread the two new handlers and `extraPatterns` data through to `LaneHeader`.

**Key Steps:**

1. Extend `SwimLaneGridProps` interface:
   ```typescript
   readonly onAddLanePattern: (laneIndex: number, pattern: string) => void
   readonly onRemoveLaneExtraPattern: (laneIndex: number, extraIndex: number) => void
   ```

2. Accept these in the destructured params.

3. In the `lanes.map()` rendering, pass to each `LaneHeader`:
   ```tsx
   extraPatterns={lane.extraPatterns}
   onAddLanePattern={(pattern) => onAddLanePattern(i, pattern)}
   onRemoveLaneExtraPattern={(extraIdx) => onRemoveLaneExtraPattern(i, extraIdx)}
   ```

**Verification:** TypeScript compiles. No change in runtime behavior yet (LaneHeader handles it next).

---

### Phase 6 — LaneHeader.tsx UI

**Goal:** Render extra pattern chips and the inline add-pattern form. Reuse `.filter-add-btn` CSS class for the "+" button (DRY).

**Key Steps:**

1. Extend `LaneHeaderProps`:
   ```typescript
   readonly extraPatterns?: readonly ExtraPatternEntry[]
   readonly onAddLanePattern?: (pattern: string) => void
   readonly onRemoveLaneExtraPattern?: (extraIndex: number) => void
   ```

2. Add local state for the inline add form:
   ```typescript
   const [isAddingPattern, setIsAddingPattern] = useState(false)
   const [addPatternValue, setAddPatternValue] = useState('')
   const addPatternInputRef = useRef<HTMLInputElement>(null)
   ```
   Add a `useEffect` with `[isAddingPattern]` as its dependency (separate from the existing `[isEditing]` effect) that calls `addPatternInputRef.current?.focus()` when `isAddingPattern` becomes true.

3. Add `handleConfirmAddPattern` and `handleCancelAddPattern` callbacks:
   - `handleConfirmAddPattern`: trim value; if non-empty, call `onAddLanePattern?.(trimmed)`; always reset form (clear value, set `isAddingPattern` to false).
   - `handleCancelAddPattern`: clear value, set `isAddingPattern` to false.
   - Blur behavior: blur on the add-pattern input calls `handleCancelAddPattern` (NOT confirm). This mirrors FilterBar behavior and avoids unintended submissions when the user clicks the Aa toggle or the × remove button while the input is focused.

4. JSX layout after the primary pattern span (or edit input), rendered only when `!isUnmatched`:

   ```tsx
   <div className="lane-header__extra-patterns">
     {(extraPatterns ?? []).map((ep, i) => (
       <PatternChip
         key={i}
         pattern={ep.pattern}
         isError={ep.isError}
         onRemove={() => onRemoveLaneExtraPattern?.(i)}
       />
     ))}
   </div>

   {isAddingPattern ? (
     <div className="lane-header__add-form">
       <input
         ref={addPatternInputRef}
         className="lane-header__add-input"
         data-testid="lane-header-add-pattern-input"
         value={addPatternValue}
         placeholder="regex pattern"
         onChange={e => setAddPatternValue(e.target.value)}
         onKeyDown={e => {
           if (e.key === 'Enter') handleConfirmAddPattern()
           if (e.key === 'Escape') handleCancelAddPattern()
         }}
         onBlur={handleCancelAddPattern}
       />
       <button className="filter-add-btn" onClick={handleCancelAddPattern}>Cancel</button>
     </div>
   ) : (
     <button
       className="filter-add-btn"
       data-testid="lane-header-add-pattern-btn"
       onClick={() => setIsAddingPattern(true)}
     >
       + Pattern
     </button>
   )}
   ```

   Note: the `lane-header__extra-patterns` wrapper is required (not optional). It provides the `flex-shrink: 1; min-width: 0; overflow: hidden` boundary that prevents chips from blowing out the header width.

5. Implement `PatternChip` as an internal function component (not exported, purely presentational):
   ```
   interface PatternChipProps {
     readonly pattern: string
     readonly isError: boolean
     readonly onRemove: () => void
   }
   ```
   Renders a `<span>` with classes `lane-header__extra-chip` (and `lane-header__extra-chip--error` when `isError`), the pattern text, and a `×` remove button with `data-testid="lane-header-extra-chip-remove"`.
   Wrap the whole chip in `data-testid="lane-header-extra-chip"`.
   - This is intentionally simpler than `FilterChip` (no toggle, no mode, no case sensitivity) because lane patterns are pure classification matchers, not include/exclude filters.

6. Drag-and-drop: The `isAddingPattern` state must suppress `draggable` on the header div (same as `isEditing`): `draggable={isDraggable && !isEditing && !isAddingPattern ? true : undefined}`. Apply the same guard to `onDragStart` and `onDragEnd`.

**CSS additions in `components.css`** (in the Lane Header section):
- `.lane-header__extra-patterns`: `display: flex; align-items: center; gap: var(--space-1); flex-shrink: 1; min-width: 0; overflow: hidden; flex-wrap: nowrap;`
- `.lane-header__extra-chip`: mirrors `.filter-chip` styling but smaller/simpler — inline-flex, mono font, xs size, surface bg, border, border-radius-full, gap.
- `.lane-header__extra-chip--error`: border-color `var(--color-error)`.
- `.lane-header__extra-chip__remove`: mirrors `.filter-chip__remove`.
- `.lane-header__add-form`: `display: inline-flex; align-items: center; gap: var(--space-1);` for the add-pattern inline form.
- `.lane-header__add-input`: same styling as `.lane-header__edit-input` but shorter (narrower `width`/`min-width`). Consider whether the two input classes can share a common base class to avoid duplicating dimension/padding/border token references.

**data-testid additions:**
- `data-testid="lane-header-add-pattern-btn"` on the `+ Pattern` button.
- `data-testid="lane-header-add-pattern-input"` on the inline input.
- `data-testid="lane-header-extra-chip"` on each `PatternChip` wrapper span.
- `data-testid="lane-header-extra-chip-remove"` on each chip's remove `×` span.

**Verification:** Visual inspection of lane headers with extra patterns. TypeScript compiles.

---

### Phase 7 — Unit Tests

**File: `tests/unit/core/types.test.ts`** — add tests for new factory functions:

- `addExtraPatternToLane`:
  - GIVEN a lane with no extra patterns, WHEN `addExtraPatternToLane` is called with a valid pattern, THEN `extraPatterns` has length 1 with `isError: false`.
  - GIVEN a lane with no extra patterns, WHEN called with an invalid regex, THEN `extraPatterns[0].isError` is true and `regex` is null.
  - GIVEN a lane with `caseSensitive: false`, WHEN an extra pattern is added, THEN the extra pattern's regex has the `'i'` flag.
  - GIVEN a lane with `caseSensitive: true`, WHEN an extra pattern is added, THEN the extra pattern's regex has no flags (empty string).
  - GIVEN a lane with 1 extra pattern, WHEN `addExtraPatternToLane` is called again, THEN `extraPatterns` has length 2 (immutable append).
  - GIVEN the original lane, WHEN `addExtraPatternToLane` is called, THEN the original lane's `extraPatterns` is unchanged (pure function).

- `removeExtraPatternFromLane`:
  - GIVEN a lane with 2 extra patterns, WHEN `removeExtraPatternFromLane(lane, 0)` is called, THEN `extraPatterns` has length 1 and contains only the second pattern.
  - GIVEN a lane with 1 extra pattern, WHEN `removeExtraPatternFromLane(lane, 0)` is called, THEN `extraPatterns` is empty.

- `rebuildLaneDefinition`:
  - GIVEN a lane with `caseSensitive: false` and 1 extra pattern compiled with `'i'` flag, WHEN `rebuildLaneDefinition(lane.pattern, lane, true)` is called, THEN `caseSensitive` is true, primary regex has no `'i'` flag, extra pattern regex has no `'i'` flag.
  - GIVEN a lane with `caseSensitive: true`, WHEN `rebuildLaneDefinition(lane.pattern, lane, false)` is called, THEN all regexes get the `'i'` flag.
  - GIVEN a lane with 2 extra patterns, WHEN `rebuildLaneDefinition(newPattern, lane, lane.caseSensitive)` is called with a new primary pattern, THEN `extraPatterns` length is still 2 and the primary pattern is updated.
  - GIVEN a lane with 2 extra patterns, WHEN `rebuildLaneDefinition` is called, THEN the original lane is unchanged (pure function).

**File: `tests/unit/core/lane-classifier.test.ts`** — add tests for OR logic:

- GIVEN a lane with primary pattern `"error"` and extra pattern `"fatal"`, WHEN `classify` is called with JSON containing only `"fatal"`, THEN returns index 0 (matched via extra pattern).
- GIVEN a lane with primary pattern `"error"` and extra pattern `"fatal"`, WHEN `classify` is called with JSON containing `"error"`, THEN returns index 0 (matched via primary pattern).
- GIVEN a lane with primary pattern `"error"` and extra pattern `"fatal"`, WHEN `classify` is called with JSON containing neither, THEN returns `lanes.length` (unmatched).
- GIVEN a lane with an invalid extra pattern (isError: true, regex: null), WHEN classified, THEN the invalid extra pattern is skipped (does not throw).
- GIVEN two lanes where lane 0 has extra pattern `"auth"` and lane 1 has primary pattern `"auth"`, WHEN classified with `"auth"` in JSON, THEN returns 0 (first-match-wins across lanes still holds).

---

### Phase 8 — E2E Tests

**File: `tests/e2e/app.spec.ts`** — add a new `test.describe` block (can be added to the existing `GIVEN the Electron app launched with --lanes "error" "auth"` group since it reuses the same setup):

```
test.describe('WHEN an extra pattern is added to the "error" lane', () => {
  test.beforeEach(async () => {
    await injectLogLines(electronApp, SAMPLE_LOG_LINES)
    await waitForFlush(page)
  })

  test('THEN the "+ Pattern" button is visible on lane headers', ...)
  test('THEN clicking "+ Pattern" shows an inline input', ...)
  test('THEN typing a pattern and pressing Enter adds a chip to the lane header', ...)
  test('THEN entries matching the extra pattern are routed to that lane (OR logic)', ...)
  test('THEN clicking × on the extra pattern chip removes it', ...)
  test('THEN after removal, entries that only matched the extra pattern revert to unmatched', ...)
})
```

**Acceptance Criteria per test:**

1. `+ Pattern` button visible: `page.locator('[data-testid="lane-header-add-pattern-btn"]').first()` is visible.

2. Clicking it shows inline input: `page.locator('[data-testid="lane-header-add-pattern-input"]')` has count 1.

3. After entering `"warn"` and pressing Enter:
   - Input disappears.
   - `page.locator('[data-testid="lane-header-extra-chip"]')` has count >= 1.
   - The chip text contains `"warn"`.

4. OR logic verification (more direct than row-count comparison):
   - Launch with `--lanes error` (single lane matching `"error"` in raw JSON).
   - Inject a log line whose raw JSON contains only `"warn"` (e.g. `{"level":"warn","msg":"warn-only"}`).
   - Wait for flush. Confirm the `"warn"` entry is NOT present in the `"error"` lane column (it is in unmatched).
   - Add extra pattern `"warn"` to the `"error"` lane via the UI.
   - `waitForFlush(page)`.
   - Assert that a row containing `"warn-only"` is now visible in the `"error"` lane column (check by grid column index or by presence of the row within that lane's rendered cells). This is more direct and less brittle than counting unmatched rows.

5. Chip removal:
   - With a chip present, click its `[data-testid="lane-header-extra-chip-remove"]`.
   - Chip count decreases by 1.

6. After removal, entries revert:
   - After removing the chip, `waitForFlush(page)`.
   - The `"warn-only"` log entry no longer appears in the `"error"` lane column.

---

## 4. Technical Considerations

### Immutability Throughout

All `LaneDefinition` mutations (add/remove/rebuild) must go through pure factory functions that return new objects. `applyLaneChange` in App.tsx already handles the mutable `lanesRef` update. No direct mutation of `lane.extraPatterns`.

### The `rebuildLaneDefinition` Correctness Trap

Two callsites in App.tsx will silently drop `extraPatterns` if they remain on bare `createLaneDefinition`:
- `handleToggleLaneCaseSensitivity` — was already identified in the original plan.
- `handleEditLane` — was missing from the original plan; added in this revision.

Both must use `rebuildLaneDefinition`. A unit test must cover each: toggle case sensitivity on a lane with extra patterns preserves them; edit primary pattern on a lane with extra patterns preserves them.

### Blur Cancels (Not Confirms) the Add-Pattern Input

The add-pattern input uses blur-cancels rather than blur-confirms. Rationale: `onBlur` fires before `onClick` in the DOM event order. If blur-confirmed, clicking the Aa toggle or the × remove button while the add-pattern input is focused would silently submit whatever partial text is in the input before performing the button action. Blur-cancels avoids this UX trap and mirrors FilterBar's behavior.

### LaneHeader Width and Overflow

Lane headers are fixed-height (`--lane-header-height`). The `lane-header__extra-patterns` wrapper div is required and must have `flex-shrink: 1; min-width: 0; overflow: hidden` to prevent chips from overflowing the header bounds. With many patterns, chips will clip. A follow-up ticket for an `+N more` badge is out of scope.

### Drag-and-Drop Suppression

The `isAddingPattern` state must suppress `draggable` on the header div. Missing this would allow the user to accidentally drag a lane while typing a new pattern.

### No Per-Pattern Case Sensitivity

Case sensitivity is intentionally per-lane, not per-extra-pattern. This is the 80/20 choice. It simplifies the UI (one toggle affects all) and the data model.

---

## 5. Testing Strategy

### Unit Test Coverage

| Scenario | File | What to verify |
|---|---|---|
| `addExtraPatternToLane` valid pattern | `types.test.ts` | `isError: false`, regex compiled |
| `addExtraPatternToLane` invalid pattern | `types.test.ts` | `isError: true`, regex null |
| `addExtraPatternToLane` inherits caseSensitive | `types.test.ts` | `'i'` flag present/absent |
| `addExtraPatternToLane` is immutable | `types.test.ts` | original `extraPatterns` unchanged |
| `removeExtraPatternFromLane` | `types.test.ts` | correct index removed |
| `rebuildLaneDefinition` recompiles all patterns | `types.test.ts` | primary + extra recompiled with new caseSensitive |
| `rebuildLaneDefinition` preserves extra patterns on primary edit | `types.test.ts` | extra count unchanged, primary updated |
| `rebuildLaneDefinition` is immutable | `types.test.ts` | original lane unchanged |
| OR logic: extra pattern matches | `lane-classifier.test.ts` | returns lane index |
| OR logic: neither matches | `lane-classifier.test.ts` | returns lanes.length |
| OR logic: invalid extra pattern skipped | `lane-classifier.test.ts` | no throw, continues |
| OR logic: first-lane wins over second-lane extra | `lane-classifier.test.ts` | lane 0 returned |

### E2E Coverage

| Scenario | What to verify |
|---|---|
| Add pattern button visible | `data-testid="lane-header-add-pattern-btn"` present on each lane header |
| Click shows input | `data-testid="lane-header-add-pattern-input"` count 1 |
| Enter confirms | chip appears with entered pattern text |
| Escape cancels | input disappears, no chip added |
| OR routing | entries previously unmatched now appear in the lane column (by column presence, not row count) |
| Remove chip | chip disappears, entries reclassified back (row no longer in lane column) |

---

## 6. Open Questions / Decisions Needed

1. **Lane header height with many extra patterns:** Current fixed height will clip. The plan says "let it clip" for 80/20. If product wants a multi-line header, that is a follow-up.

2. **Edit extra patterns:** The plan explicitly excludes inline editing of extra patterns (80/20: extra patterns are removable chips only). If needed later, it can be added without changing the data model.

3. **CLI arg support for extra patterns:** Current `--lanes` only supports one pattern per lane (e.g. `--lanes error auth`). Supporting multiple patterns per lane from CLI (e.g. `--lanes "error,fatal" auth`) is out of scope for this ticket. A follow-up ticket should be created if needed.

4. **Config persistence:** `LaneDefinition` is not currently persisted to `AppConfig` — lanes are runtime-only state from CLI args. So adding `extraPatterns` to the data model does not affect `AppConfig` serialization. This is consistent with the current behavior.
