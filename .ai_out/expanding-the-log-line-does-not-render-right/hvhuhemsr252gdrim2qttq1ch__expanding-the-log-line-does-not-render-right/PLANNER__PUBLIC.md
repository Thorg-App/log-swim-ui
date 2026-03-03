# Implementation Plan — Fix: Expanding Log Row Overlays Subsequent Rows

## Problem Understanding

When a log row is clicked to expand, its full JSON content is taller than the collapsed row height. The virtual row wrapper has `height: virtualRow.size` (a fixed pixel value), so:

1. Expanded content overflows the fixed-height wrapper visually, covering rows below.
2. The `@tanstack/react-virtual` ResizeObserver (attached via `ref={virtualizer.measureElement}`) observes the wrapper element — which stays at `virtualRow.size` pixels — so it never learns the actual expanded height.
3. Subsequent rows keep their original `translateY` positions → visual overlay.

## Root Cause

`src/renderer/src/components/SwimLaneGrid.tsx`, line 213:

```tsx
style={{
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: virtualRow.size,           // <-- ROOT CAUSE
  transform: `translateY(${virtualRow.start}px)`
}}
```

## Implementation — Phase 1: Code Fix (1 line)

**File:** `src/renderer/src/components/SwimLaneGrid.tsx`

Remove the `height: virtualRow.size` property from the virtual row wrapper's inline style. The resulting style object is:

```tsx
style={{
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  transform: `translateY(${virtualRow.start}px)`
}}
```

No other code changes are needed. The ResizeObserver on `measureElement` will now observe the wrapper at its natural (content-driven) height. The virtualizer will recalculate `virtualRow.start` for subsequent rows after each measurement, pushing them down correctly.

### Why NOT to change `estimateSize`

Keep the existing `estimateSize` callback as-is:

```ts
estimateSize: (index) => {
  const masterIndex = filteredIndices !== null ? filteredIndices[index] : index
  return masterIndex === expandedRowIndex ? rowHeight * 6 : rowHeight
}
```

The `rowHeight * 6` estimate for the expanded row serves as an initial layout hint before the ResizeObserver fires. Without it, the expanded row would start at collapsed height and jump to final height after first render — noticeable flicker. The estimate reduces the jump. It does not affect correctness.

## Implementation — Phase 2: Update Existing Collapse Test

**File:** `tests/e2e/app.spec.ts`, lines 99-112

The existing collapse test uses `dispatchEvent('click')` because the original bug caused overlapping virtual row wrappers, which Playwright's actionability check detected as covered elements. After the fix, rows occupy distinct vertical bands and no longer overlap — Playwright's `.click()` should work directly.

**Change:** Replace `dispatchEvent('click')` with `.click()` on the collapse action, and remove the WHY comment that described the workaround.

Before:
```ts
// Collapse by dispatching click on the expanded row
// WHY: In virtualized layout with absolute-positioned rows, Playwright's actionability
// check detects overlapping log-row-grid elements. We dispatch the click event directly.
await page.locator('.log-row--expanded').dispatchEvent('click')
```

After:
```ts
// Collapse by clicking the expanded row directly
await page.locator('.log-row--expanded').click()
```

This change serves a dual purpose: it proves the fix resolved the actionability issue AND removes the now-obsolete workaround.

Note: If after the fix Playwright still rejects `.click()` (which would be unexpected given the rows no longer overlap), the implementor should investigate whether `log-row-grid` wrappers have a z-order issue, and fall back to `dispatchEvent` with an updated WHY comment explaining why the workaround remains necessary post-fix.

## Implementation — Phase 3: New E2E Test

**File:** `tests/e2e/app.spec.ts`

Add one new test inside the `WHEN test log lines are injected` describe block (which already has `beforeEach` injecting 5 log lines).

**Test goal:** Verify that after expansion, the second log row's top edge is at or below the first row's bottom edge (not overlaid).

**Test structure:**

```
THEN expanding a row pushes subsequent rows down (no overlay)
```

**Logic:**
1. Get the bounding box of the first `.log-row` element (collapsed height).
2. Click the first `.log-row` to expand it.
3. Wait for the expanded content to appear (`.log-row__expanded-content`).
4. Get bounding box of the expanded `.log-row--expanded` element.
5. Get bounding box of the second `.log-row` element (which is still collapsed).
6. Assert: `secondRow.y >= firstRow.y + firstRow.height` — second row starts at or below the bottom of the expanded first row.

The bounding box checks use `element.boundingBox()` from Playwright. The locator for the second row is `page.locator('.log-row').nth(1)`.

Key assertion: `expect(secondRowBox.y).toBeGreaterThanOrEqual(expandedFirstRowBox.y + expandedFirstRowBox.height)`

Additionally, assert that the expanded row is actually taller than a collapsed row: `expect(expandedFirstRowBox.height).toBeGreaterThan(firstRowBox.height)`

These two assertions together capture the regression: expanded row grew, AND the next row was not overlaid.

## Testing Strategy

### Sequence (required order)

1. Write the failing E2E test first (it will fail before the fix is applied).
2. Apply the one-line fix (remove `height: virtualRow.size`).
3. Update the collapse test (`dispatchEvent` → `.click()`).
4. Run `npm run build && npm run test:e2e` — all three tests must pass.

### Edge Cases to Consider

- The bounding box test relies on the virtualizer having measured the expanded row. Add a brief `waitForTimeout` or wait for the expanded content to be stable before measuring. Using `await expect(expandedContent).toBeVisible()` before measuring is sufficient.
- Virtualization with `overscan: 20` means the second row is always in the DOM for a 5-entry dataset — the `nth(1)` selector will reliably find it.

## Files Touched

| File | Change |
|------|--------|
| `src/renderer/src/components/SwimLaneGrid.tsx` | Remove `height: virtualRow.size` from virtual row wrapper style (line 213) |
| `tests/e2e/app.spec.ts` | Update collapse test (remove `dispatchEvent` workaround); add new bounding box overlay test |
