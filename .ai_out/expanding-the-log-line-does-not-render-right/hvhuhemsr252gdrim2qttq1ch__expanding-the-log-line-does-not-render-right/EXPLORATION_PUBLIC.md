# Exploration: Log Line Expansion Overlay Bug

## Root Cause (Confirmed)

In `SwimLaneGrid.tsx` line 213, the virtual row wrapper div has:

```tsx
style={{
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: virtualRow.size,        // <-- ROOT CAUSE: fixed height constrains the wrapper
  transform: `translateY(${virtualRow.start}px)`
}}
ref={virtualizer.measureElement}  // ResizeObserver attached here
data-index={virtualRow.index}
```

**The problem:** `height: virtualRow.size` sets a FIXED height on the wrapper. When a row expands:
1. The expanded content (pretty-printed JSON) is taller than the container
2. Content overflows visually (overlays subsequent rows)
3. The ResizeObserver on `measureElement` sees the wrapper at fixed `virtualRow.size` height (not the actual content height), so the virtualizer never learns the true height
4. Subsequent rows stay at their original positions → visual overlay

**The fix:** Remove `height: virtualRow.size` from the wrapper. Without a fixed height:
- The wrapper grows to match its content naturally
- The ResizeObserver measures the actual height
- The virtualizer recalculates positions for subsequent rows
- Rows are pushed down correctly

## Key Files

| File | Location | Relevance |
|------|----------|-----------|
| SwimLaneGrid.tsx | `src/renderer/src/components/SwimLaneGrid.tsx` | Virtual row wrapper - line 213 has the root cause |
| LogRow.tsx | `src/renderer/src/components/LogRow.tsx` | Renders expanded content; `height: auto` via CSS class |
| components.css | `src/renderer/theme/components.css` | `.log-row` (height: var(--row-height)), `.log-row--expanded` (height: auto) |

## virtualizer.estimateSize (line 115-118)

```ts
estimateSize: (index) => {
  const masterIndex = filteredIndices !== null ? filteredIndices[index] : index
  return masterIndex === expandedRowIndex ? rowHeight * 6 : rowHeight
}
```

This provides an initial estimate (192px for expanded) before measurement. After fix, this remains useful as an initial layout estimate. No change needed here.

## E2E Test Note

In `tests/e2e/app.spec.ts` line 107-109, the collapse test uses `dispatchEvent('click')` with this WHY comment:
> "In virtualized layout with absolute-positioned rows, Playwright's actionability check detects overlapping log-row-grid elements."

After the fix (rows no longer overlay), regular `.click()` should work. BUT `log-row-grid` elements are full-width divs — they may still be technically adjacent even without overlay. The `dispatchEvent` approach is safe to keep or can be changed to `.click()` after testing.

## Existing Tests

- `THEN clicking a log row expands it to show full JSON` — verifies expanded content visible
- `THEN clicking an expanded row collapses it` — verifies collapse works

**Missing test:** No test verifies that subsequent rows are NOT overlaid (pushed down properly). Should add.

## Summary

Single-line fix: remove `height: virtualRow.size` from the virtual row wrapper in SwimLaneGrid.tsx.
Plus add E2E test to verify expanded rows don't overlay subsequent rows.
