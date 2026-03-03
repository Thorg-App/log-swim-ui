# Implementation Review — Fix: Expanding Log Row Overlays Subsequent Rows

## Status: APPROVED

All tests pass: 274 unit tests, 22 E2E tests (new test added), TypeScript typecheck, build.

---

## Summary

The change removes one line from `src/renderer/src/components/SwimLaneGrid.tsx` — `height: virtualRow.size` from the virtual row wrapper div — and adds an E2E test that verifies subsequent rows are pushed down after expansion. The collapse test is also improved by removing a `dispatchEvent` workaround that was only necessary before the fix.

The fix is minimal, correct, and addresses the root cause directly. No regressions.

---

## CRITICAL Issues

None.

---

## IMPORTANT Issues

None.

---

## Suggestions

**1. Collapse-then-recheck position is not tested**

The new test verifies that expanding a row pushes rows down. A complementary assertion — that collapsing the row returns subsequent rows to their original position — is absent. This is low severity since the collapse DOM test passes and the virtualizer handles this symmetrically, but it would make the regression coverage more complete. Not blocking.

**2. Pre-existing: `log-row-grid` class has no CSS rule**

`LogRow.tsx` applies `className="log-row-grid"` but there is no matching rule in `components.css`. The grid layout is driven entirely by the inline `style`. This is a pre-existing issue not introduced by this change, but `display: 'grid'` as inline style is technically in tension with CLAUDE.md's "no inline styles" rule. The `WHY inline gridTemplateColumns` comment explains the dynamic column count. Consider extracting `display: grid` into a `.log-row-grid` CSS rule to minimize the inline style surface area. Low priority follow-up.

---

## Review Notes

### Root cause fix (SwimLaneGrid.tsx)

Correct. `height: virtualRow.size` constrained the wrapper to the estimated size, preventing the ResizeObserver (attached via `ref={virtualizer.measureElement}`) from seeing the actual expanded height. Removing the fixed height lets the wrapper grow, the ResizeObserver reports the true height, and the virtualizer correctly recalculates `translateY` for all subsequent rows.

The WHY comments added are accurate and explain the non-obvious constraint.

### dispatchEvent to .click() (collapse test)

Correct improvement. The old workaround was needed because the absolute-positioned rows overlaid each other before the fix. After the fix rows no longer overlay, so the standard Playwright `.click()` (with actionability checks) correctly tests the real interaction path. The removal of the old WHY comment is appropriate since the described condition no longer exists.

### New E2E test quality

The test structure is sound:

- `expect.poll()` is the right mechanism. Playwright does NOT auto-retry `boundingBox()` (a direct value query), only locator-based assertions. Wrapping the `boundingBox()` call in `expect.poll()` correctly retries the entire expression until the virtualizer's asynchronous ResizeObserver-driven recalculation completes.

- `Math.floor()` is the right approach. The expanded row's bounding box may return fractional pixel heights (e.g. 311.25) while the browser snaps `translateY` to whole pixels for the next row. Comparing at integer granularity avoids false negatives without masking real overlay bugs.

- The fallback `0` when `box` is null causes the poll to keep retrying until the second row is rendered and positioned — correct behavior.

- With 5 injected log lines and `VIRTUALIZER_OVERSCAN = 20`, all rows render in the virtual window, so `.log-row.nth(1)` is reliably present.
