# Implementor Public — Fix: Expanding Log Row Overlays Subsequent Rows

## Summary

Three changes were made to fix the log row expansion overlay bug.

## Changes Made

### 1. Production fix — `src/renderer/src/components/SwimLaneGrid.tsx` (line 207-215)

Removed `height: virtualRow.size` from the virtual row wrapper's inline style.

Before:
```tsx
style={{
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: virtualRow.size,
  transform: `translateY(${virtualRow.start}px)`
}}
```

After:
```tsx
style={{
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  transform: `translateY(${virtualRow.start}px)`
}}
```

Added WHY comments explaining the absence of `height` (the ResizeObserver needs the wrapper to grow naturally).

### 2. Updated collapse test — `tests/e2e/app.spec.ts` (line 106-107)

Replaced `dispatchEvent('click')` with `.click()` and removed the WHY comment that described the now-obsolete workaround for overlapping virtual rows.

### 3. New bounding box E2E test — `tests/e2e/app.spec.ts` (lines 112-137)

Added test `THEN expanding a row pushes subsequent rows down without overlaying them` inside the `WHEN test log lines are injected` describe block.

## Deviations from Plan

### Deviation 1: `expect.poll()` instead of synchronous `expect` for the position assertion

The plan reviewer stated "Playwright retries until this passes" for the height assertion, implying that the synchronous `expect(expandedBox!.height)` would cause subsequent queries to read settled positions. This is incorrect — Playwright retries only for locator-based assertions (`expect(locator).toXxx()`), not for direct value assertions (`expect(value).toXxx()`).

The first test run confirmed this: secondRowBox.y was 161 (stale) even though expandedBox.height was correct, because the virtualizer re-render had not yet completed.

Fix: used `expect.poll()` to retry the `boundingBox()` query on the second row until its y position has settled.

### Deviation 2: `Math.floor()` for sub-pixel comparison

Playwright bounding boxes report sub-pixel positions (e.g., expandedBox.y=0, expandedBox.height=311.25, so bottom=311.25). The browser rounds CSS `translateY` to whole pixels, so the second row lands at y=311. 311 >= 311.25 is false but the rows are not overlaying.

Fix: compare `Math.floor(box.y) >= Math.floor(expandedBox.y + expandedBox.height)` for integer-granularity comparison that matches actual rendering.

## Test Results

- Unit tests: 274 passed (16 test files)
- E2E tests: 22 passed (was 21; new test added)
- Build: success
