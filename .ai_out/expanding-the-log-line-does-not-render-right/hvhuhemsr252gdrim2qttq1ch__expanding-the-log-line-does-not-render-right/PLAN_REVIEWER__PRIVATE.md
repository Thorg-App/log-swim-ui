# PLAN REVIEWER PRIVATE — Expanding Log Line Overlay Bug

## Files Verified

- `src/renderer/src/components/SwimLaneGrid.tsx` — confirmed `height: virtualRow.size` at line 213
- `src/renderer/src/components/LogRow.tsx` — confirmed `.log-row-grid` outer wrapper, `.log-row` inner div
- `src/renderer/theme/components.css` — confirmed `.log-row { height: var(--row-height) }` and `.log-row--expanded { height: auto }`
- `tests/e2e/app.spec.ts` — confirmed `dispatchEvent('click')` workaround at line 109 with exact WHY comment

## Fix Correctness Analysis

The root cause analysis is correct. `height: virtualRow.size` on the absolute-positioned wrapper constrains the element to `virtualRow.size` pixels. The ResizeObserver is attached to this wrapper via `ref={virtualizer.measureElement}`. When the wrapper has a fixed height, the ResizeObserver sees no height change when the inner content grows, so `virtualRow.size` is never updated, and subsequent rows never move.

Removing `height: virtualRow.size` is the canonical fix for this pattern with @tanstack/virtual. The ResizeObserver will then observe the wrapper at its natural (content-driven) height and trigger a re-layout.

## CSS Layer Verification

The CSS confirms the fix is safe. `.log-row--expanded` has `height: auto` at the inner `.log-row` level. There is no conflicting height constraint at the `.log-row-grid` level. The wrapper has no CSS class that sets height — it is purely styled via the inline style block. Removing `height` from that inline style object leaves nothing constraining the wrapper's height.

## Phase 2 Risk: Collapse Test dispatchEvent -> .click()

The plan says: "change this to `.click()`, if it fails investigate."

The WHY comment in the existing test says the workaround was needed because Playwright's actionability check detected overlapping `log-row-grid` elements. These are `position: absolute` with `width: 100%`. The overlap was caused by a row that visually expanded but whose wrapper height never updated — so the next wrapper's `translateY` placed it inside the expanded row's visual footprint.

After the fix, each row wrapper occupies a distinct vertical band. The `.log-row-grid` at virtual index 0 occupies `[0, expandedHeight]`. The one at index 1 occupies `[expandedHeight, expandedHeight + rowHeight]`. No coordinate overlap.

HOWEVER: there is a subtle DOM structure concern. `.log-row--expanded` is the INNER div (not the wrapper). The wrapper is an anonymous div with no CSS class. Playwright's `.locator('.log-row--expanded').click()` targets the inner div. The inner div is NOT covered by the wrapper of the next row (which starts at a higher Y). So `.click()` on `.log-row--expanded` should work post-fix.

Conclusion: the Phase 2 change is sound. The fallback note (if `.click()` still fails, investigate z-order) is the correct safety valve.

## Phase 3 New Test Analysis

### Selector Correctness

The plan uses `page.locator('.log-row').nth(1)` for the second row.

DOM structure: each virtual row renders `<div [wrapper]><div class="log-row-grid"><div class="log-row">...</div></div></div>`. With 5 entries and `overscan: 20`, all 5 rows are guaranteed in the DOM. `page.locator('.log-row').nth(1)` correctly selects the second `.log-row` in DOM order.

However: in a swimlane layout with 3 columns, `.log-row` elements are distributed across lanes by `gridColumn`. The second `.log-row` in DOM order IS the row at virtual index 1. But its bounding box Y position is what matters — and bounding box is computed from its rendered position in the viewport. The `gridColumn` placement puts the row in a specific column but does NOT affect its vertical Y position (all rows share the same CSS grid row since each virtual wrapper is a separate absolute element). So the bounding box Y check is valid regardless of which lane each row falls in.

### Timing Concern (Flagged)

The plan says: "Using `await expect(expandedContent).toBeVisible()` before measuring is sufficient."

This is nearly correct but has a gap. After the expanded content is visible, the ResizeObserver fires asynchronously. The virtualizer then recalculates positions for subsequent rows and triggers a React re-render. There is a window between "expanded content visible" and "subsequent rows repositioned."

The safe approach is: after `await expect(expandedContent).toBeVisible()`, the bounding box of `.log-row.nth(1)` should be re-queried (not cached from before expansion). The plan already describes this — it re-queries after expansion. But it may need an additional wait for the virtualizer to settle.

Mitigation that does NOT use `waitForTimeout`: assert `expandedFirstRowBox.height > firstRowBox.height` FIRST. If the virtualizer has not settled yet, this assertion itself acts as a barrier via Playwright retry. Then assert the `secondRowBox.y` position. This is safe because by the time the height assertion passes, at least one ResizeObserver cycle has completed.

The plan does NOT explicitly describe this ordering — it lists the assertions without specifying that the height assertion serves as the timing barrier. This is a minor gap, not a blocker.

### Two-assertion test for one behavior

The plan creates one test with two assertions:
1. `expandedFirstRowBox.height > firstRowBox.height`
2. `secondRowBox.y >= expandedFirstRowBox.y + expandedFirstRowBox.height`

This violates the "one assert per test" guideline. Given the Playwright context (E2E, not unit), and that both assertions together constitute the complete regression proof, this is acceptable. The CLAUDE.md says "one assert per test (preferably)" — the qualifier applies here. Two tightly coupled assertions that form a single behavioral contract are fine in E2E.

## estimateSize Decision

Keeping `rowHeight * 6` is correct. Without it, expanded rows would start at `rowHeight` and resize up — a jarring jump. The estimate is a UX optimization, not a correctness requirement. No change needed.

## What Is NOT Covered

1. **Collapse re-measurement**: When a row collapses, the wrapper height should shrink back to `rowHeight`. This works because `.log-row` (without `--expanded`) has `height: var(--row-height)` which is a fixed height — the inner content goes back to single-line height, the wrapper shrinks, the ResizeObserver fires, and subsequent rows move up. This should work correctly but there is no test for "rows above collapsed row move back up." Not a blocker — the existing collapse test (now using `.click()`) covers the behavior at the functional level. The bounding box aspect is lower priority.

2. **Expanded row at last virtual position**: No overlay concern — there is no "next row" to overlap. Not a gap.

3. **Filtered list**: The `estimateSize` correctly handles filtered indices. The fix applies equally with or without filters.

## Verdict

APPROVED. The plan is minimal, correct, and PARETO-aligned. The single-line fix addresses the root cause directly. The test strategy provides regression proof at both the actionability level (Phase 2) and the geometric level (Phase 3).

Minor note for implementor: when writing the Phase 3 test, structure assertions so the height assertion runs before the Y-position assertion, ensuring the virtualizer has settled before the second check.
