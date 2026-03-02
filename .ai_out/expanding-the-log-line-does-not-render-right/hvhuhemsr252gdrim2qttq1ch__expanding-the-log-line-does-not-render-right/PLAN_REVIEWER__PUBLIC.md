# Plan Review — Fix: Expanding Log Row Overlays Subsequent Rows

## Executive Summary

The plan is minimal, correct, and PARETO-aligned. A single line removal in `SwimLaneGrid.tsx` addresses the root cause directly — the fixed `height` on the virtual row wrapper prevents the `@tanstack/virtual` ResizeObserver from ever learning the expanded height. The test strategy provides two layers of regression proof. One implementation note on assertion ordering is needed to make the Phase 3 bounding box test reliable.

---

## Critical Issues (BLOCKERS)

None.

---

## Major Concerns

**Concern: Phase 3 timing gap between "expanded content visible" and "subsequent rows repositioned"**

**Why:** After `await expect(expandedContent).toBeVisible()` passes, the ResizeObserver fires asynchronously. The virtualizer recalculates `translateY` values for subsequent rows and triggers a React re-render. If `secondRowBox.y` is queried before this re-render completes, the assertion may read the stale pre-expansion Y position and pass vacuously (or flake intermittently).

**Suggestion:** Structure assertions in this explicit order:

```typescript
// 1. Height assertion first — Playwright retries until this passes,
//    which guarantees the virtualizer has settled before checking position.
expect(expandedFirstRowBox.height).toBeGreaterThan(firstRowBox.height)

// 2. Only then query the second row's position
const secondRowBox = await page.locator('.log-row').nth(1).boundingBox()
expect(secondRowBox!.y).toBeGreaterThanOrEqual(expandedFirstRowBox.y + expandedFirstRowBox.height)
```

Do NOT pre-query `secondRowBox` before the height assertion. Query it after, so you read the settled position.

---

## Simplification Opportunities (PARETO)

None applicable. The plan is already at maximum simplicity.

---

## Minor Suggestions

**Phase 2 fallback note:** The plan correctly says "if `.click()` still fails post-fix, investigate z-order." This is the right mental model. The note is already in the plan (`PLANNER__PUBLIC.md` line 81). Implementor should treat a `.click()` failure post-fix as a signal the fix is incomplete, not as a reason to revert to `dispatchEvent`.

**Assertion naming in Phase 3:** Use a local variable for the pre-expansion bounding box to make the assertion readable:

```typescript
const collapsedBox = await page.locator('.log-row').first().boundingBox()
await page.locator('.log-row').first().click()
await expect(page.locator('.log-row__expanded-content')).toBeVisible()

const expandedBox = await page.locator('.log-row--expanded').boundingBox()
expect(expandedBox!.height).toBeGreaterThan(collapsedBox!.height)

const secondRowBox = await page.locator('.log-row').nth(1).boundingBox()
expect(secondRowBox!.y).toBeGreaterThanOrEqual(expandedBox!.y + expandedBox!.height)
```

This makes the intent clear without extra comments.

---

## Strengths

**Root cause identification is exact.** The exploration correctly traced the issue to `height: virtualRow.size` constraining the wrapper and blocking the ResizeObserver feedback loop. No guessing.

**One-line fix.** Removing a single property is the correct scope. No collateral changes, no new abstractions.

**`estimateSize` kept unchanged.** The `rowHeight * 6` estimate prevents layout flicker. The plan correctly identifies it as a UX optimization, not a correctness concern, and avoids touching it.

**Phase 2 as regression proof at the actionability level.** Changing `dispatchEvent` to `.click()` makes the collapse test fail if the fix is reverted. This is a clever layering — the existing test becomes a sentinel for the overlay bug.

**CSS layer analysis.** The plan correctly identified that `.log-row--expanded { height: auto }` on the inner div is already correct, and no CSS changes are needed. The fix is purely in the JavaScript/React layer.

**PARETO alignment.** Three phases, two of which are test additions. The actual functional change is one line. This is the correct ratio.

---

## Verdict

- [ ] APPROVED
- [x] APPROVED WITH MINOR REVISIONS
- [ ] NEEDS REVISION
- [ ] REJECTED

**Required before implementation:** Apply the assertion ordering fix described in Major Concerns — query `secondRowBox` AFTER asserting the expanded height, not before. This is a one-sentence change to the Phase 3 test logic and prevents a potential timing flake.

Everything else is implementation-ready as written.
