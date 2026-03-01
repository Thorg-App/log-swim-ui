# Plan Review: Phase 06 -- UI Filters, Drag & Lane Management

## Executive Summary

The plan is well-structured, correctly phased (pure logic first, then state refactor, then UI, then DnD, then E2E), and aligns with project standards. There are two significant issues: (1) the `useLogIngestion` effect depends on `lanes` today, and the plan to switch to `lanesRef` will cause `convertIpcToLogEntry` to use stale `lanes` for classification of NEW entries -- this is actually correct behavior per the plan since `lanesRef.current` will be synced, but the plan does not address the parallel concern that `convertIpcToLogEntry` itself must be updated to read from `lanesRef` rather than accepting `lanes` as a parameter; (2) the E2E section is excessively exploratory, presenting 5+ approaches before landing on a recommendation -- it needs to be distilled into a single clear approach. Both are addressable without plan iteration.

## Critical Issues (BLOCKERS)

None. All issues below are addressable as inline refinements.

## Major Concerns

### 1. `convertIpcToLogEntry` and the `lanesRef` Pattern

**Concern**: The plan correctly identifies that `useLogIngestion`'s `useEffect` should NOT re-run when lanes change (it would tear down IPC listeners and LogBuffer). The solution is `lanesRef`. However, the plan says:

> Inside the `onLogLine` callback, use `lanesRef.current` for classification

But the current code calls `convertIpcToLogEntry(ipcLine, lanes)` inside the callback. The plan's Phase 6B section says to "accept `lanesRef`" in `useLogIngestion`, but does not explicitly address how `convertIpcToLogEntry` should be called. Two options:

**Option A (simpler, recommended)**: Inline the classification in the callback. Instead of calling `convertIpcToLogEntry(ipcLine, lanes)`, build the `LogEntry` manually and call `LaneClassifier.classify(ipcLine.rawJson, lanesRef.current)` directly. This avoids modifying `convertIpcToLogEntry`'s signature and keeps it testable with a simple lanes parameter.

**Option B**: Pass `lanesRef.current` to `convertIpcToLogEntry` at call time: `convertIpcToLogEntry(ipcLine, lanesRef.current)`. This works because the ref is read at call time (not captured). This is actually the simplest change -- one line.

**Recommendation**: Option B. The existing `convertIpcToLogEntry` function signature does not need to change. The `useEffect` closure captures the ref object (stable), and `lanesRef.current` is read at invocation time. Just change the call site from `lanes` to `lanesRef.current`. The plan should state this explicitly to avoid confusion during implementation.

**Impact**: Without this clarification, the implementer may pass the captured (stale) `lanes` from the closure to `convertIpcToLogEntry`, resulting in new entries being classified against the old lane order.

### 2. E2E Section is Exploratory, Not Prescriptive

**Concern**: Phase 6E reads like exploration notes, not a plan. It presents Options A, B, C, then "Actually...", then "However...", then "Final Recommendation", then "Alternative (even simpler)". This is confusing for the implementer.

**Recommendation**: Distill to one clear approach. Based on the exploration, the recommended approach is:

1. Build the app with `npm run build`
2. Use Playwright's `_electron.launch()` to start the built app
3. Inject test data via `electronApp.evaluate()` calling `webContents.send(IPC_CHANNELS.LOG_LINE, ipcLogLine)` on the main process
4. This bypasses stdin but exercises the same IPC -> renderer path
5. For stream-end, use `webContents.send(IPC_CHANNELS.STREAM_END)`

This is what the plan ultimately recommends but buried under several paragraphs of alternatives. The implementer should follow this single approach.

**Impact**: Low risk (it is the final recommendation), but the noise makes Phase 6E harder to implement correctly.

### 3. `useEffect` Dependency Array After Refactor

**Concern**: The current `useLogIngestion` effect has `[masterList, lanes, config]` as dependencies. The plan says to "Remove `lanes` from the `useEffect` dependency array (it is now a ref)". This is correct. However, the plan should also note that `config` remains a dependency, and since `config` comes from `useAppInit` and is stable (never changes after init), this is fine. But if `config` were ever to change (Phase 07 -- Settings Panel), the effect would re-run, which would be the same problem. This is a future concern, not a Phase 06 blocker.

**Recommendation**: Add a brief note that `config` stability is assumed. Phase 07 may need to apply the same ref pattern to `config`.

**Impact**: No impact on Phase 06. Forward-looking note for Phase 07.

## Simplification Opportunities (PARETO)

### 1. Filter Types: Discriminated Union vs. Single Interface

The plan uses `FieldFilter | RawFilter` discriminated union. The task spec uses a single `Filter` interface with `type: 'field' | 'raw'` and optional `field?`. Both work. The discriminated union is cleaner for type narrowing, but adds two interfaces instead of one.

**Verdict**: Keep the discriminated union. It is marginally more code but enforces that `field` is present when `type === 'field'` at compile time. This aligns with the "compile-time checks over runtime" principle in CLAUDE.md.

### 2. FilterBar Always Visible

The plan recommends always rendering FilterBar. This is correct -- the CSS token `--filter-bar-height: 48px` is already defined and reserved. Simpler than conditional rendering with layout shifts.

### 3. Filtering Strategy: Option A (Index Mapping) vs Option B (useMemo Filtered Array)

The plan recommends Option A (index mapping with `null` sentinel for "no filters"). The argument is that Option B "would allocate a new 20K array every 200ms".

**Counterpoint**: Option B with `useMemo` only recomputes when `[version, filters]` change, which is the same trigger as Option A. Both allocate proportionally. Option B's `filteredEntries` array holds references (not copies) -- the allocation is `20K * 8 bytes` (pointer array), which is negligible.

**However**, Option A's `null` sentinel (no-filter fast path) is a nice optimization that avoids computing an identity index array. And Option A keeps the virtualizer working with original indices, which matters for `expandedRowIndex` state (expanded row index refers to the masterList index, not the filtered index).

**Verdict**: Keep Option A. The `null` sentinel optimization and stable index semantics justify it. But note: `expandedRowIndex` needs careful handling when filters change. The plan does not address this -- when filters change, an expanded row might be filtered out, and `expandedRowIndex` should reset to `null`. Add a `useEffect` to clear `expandedRowIndex` when `filters` change.

## Minor Suggestions

### 1. Expanded Row Index Reset on Filter Change

Add to Phase 6C SwimLaneGrid changes:
```typescript
useEffect(() => {
  setExpandedRowIndex(null)
}, [filters])
```

Without this, an expanded row that gets filtered out would leave stale state.

### 2. `bumpVersion` Naming

The plan proposes exposing `bumpVersion` from `useLogIngestion`. This is fine, but the function is really `forceRerender`. Since `version` is already the mechanism, `bumpVersion` is accurate. Keep it.

### 3. Drag State Ownership

The plan suggests drag state (`dragSourceIndex`, `dragOverIndex`) in `SwimLaneGrid`. This is correct -- drag state is transient UI state, local to the grid. No need to lift it to App.

### 4. FilterChip Error Indicator for `regex: null`

The plan mentions this in Section 4 (Error Handling) but does not include it in the FilterChip component description in Phase 6C. Add: FilterChip should show `.filter-chip--error` class when `filter.regex === null`.

### 5. DnD: `draggable` on Entire Header vs. Drag Handle

The plan puts `draggable` on the entire `<div>` but says "The drag handle becomes the drag initiator". These are contradictory. If `draggable` is on the whole header, any click-drag on the header starts a drag. If it should only be the handle (`<span className="lane-header__drag-handle">`), the `draggable` attribute should be on the handle span, not the container div.

**Recommendation**: Put `draggable` on the handle span only. This allows the pattern text to remain selectable and prevents accidental drags. The `onDragOver` and `onDrop` can remain on the container div (drop targets need to be the full header area).

### 6. Module-Level Counter for Filter IDs

The plan uses `let nextFilterId = 0` at module scope. This works for session-only filters. However, per CLAUDE.md: "Disfavor non-private free-floating functions. Favor cohesive classes." Since `FilterEngine` is already a static class, the counter should be a private static member:

```typescript
class FilterEngine {
  private static nextId = 0
  // ...
}
```

### 7. Missing: LaneClassifier.reclassifyAll Receives MasterList.entries

The plan calls `LaneClassifier.reclassifyAll(masterList.entries, newLanes)`. The current `reclassifyAll` accepts `readonly LogEntry[]`. `MasterList.entries` returns `readonly LogEntry[]`. This works because `LogEntry.laneIndex` is mutable (`laneIndex: number`, not `readonly laneIndex: number`). Confirmed: this is compatible with the current API. No issue.

## Strengths

1. **Phased approach (6A through 6E)** is excellent. Pure logic first (6A), state refactor (6B), UI (6C), DnD (6D), E2E (6E). Each phase has a clear verification step. This minimizes risk and enables incremental commits.

2. **Filter as render-time operation** -- not mutating MasterList -- is the correct architectural decision. It keeps the data pipeline clean and means filters can be toggled/removed without data loss.

3. **lanesRef pattern** correctly identifies and solves the IPC listener teardown problem. This is a real issue that would cause missed log messages during lane reorder/add.

4. **Pre-defined CSS classes** (filter-bar, filter-chip, lane-add-input, drag-handle) from Phase 02/05 are correctly identified and leveraged. No redundant CSS design work needed.

5. **Acceptance criteria mapping** (Section 7) is thorough -- every criterion maps to a specific phase and implementation item.

6. **Risk mitigation table** (Section 11) is practical and proportionate. The identified risks are real and the mitigations are sensible.

7. **The plan correctly keeps Filter types in `filter.ts` (not `types.ts`)** for SRP -- types.ts is already large.

8. **The `null` sentinel for empty filter set** in Option A is a good optimization that avoids unnecessary work in the common case (no filters active).

## Verdict

- [x] APPROVED WITH MINOR REVISIONS

### Required Revisions (can be done inline by implementer)

1. **Clarify `convertIpcToLogEntry` call site**: In Phase 6B, explicitly state that the `onLogLine` callback should call `convertIpcToLogEntry(ipcLine, lanesRef.current)` -- passing `lanesRef.current` (read at invocation time) instead of the captured `lanes` variable.

2. **Distill E2E approach**: Phase 6E should present one approach, not five. Use `_electron.launch()` + `electronApp.evaluate()` + `webContents.send()`.

3. **Add `expandedRowIndex` reset on filter change**: In SwimLaneGrid, clear expanded row when filters change.

4. **Fix DnD `draggable` placement**: Put `draggable` on the drag handle span, not the container div. Keep `onDragOver`/`onDrop` on the container.

5. **Move filter ID counter**: Make it `private static nextId` on `FilterEngine` class.

6. **Add `.filter-chip--error` handling**: FilterChip component description should mention error state rendering for `regex: null`.

---

## Signal

**PLAN_ITERATION can be skipped.** All revisions are minor and can be addressed inline during implementation. No architectural changes needed.
