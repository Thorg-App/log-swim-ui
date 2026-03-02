# PLANNER PRIVATE — Expanding Log Line Overlay Bug

## Files Read

- `src/renderer/src/components/SwimLaneGrid.tsx` — virtual row wrapper with root cause at line 213
- `src/renderer/src/components/LogRow.tsx` — renders `log-row-grid` outer div + `log-row` / `log-row--expanded` inner div
- `src/renderer/theme/components.css` — `.log-row` has `height: var(--row-height)`; `.log-row--expanded` has `height: auto; min-height: var(--row-height)`
- `tests/e2e/app.spec.ts` — existing expand/collapse tests at lines 85-112

## Key Decision Points

### 1. The exact line to remove

`SwimLaneGrid.tsx` line 213: `height: virtualRow.size,`

The virtual row wrapper style block (lines 208-215) becomes:
```tsx
style={{
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  transform: `translateY(${virtualRow.start}px)`
}}
```

The `height` property is the ONLY thing blocking the ResizeObserver from seeing expanded content height. Without it the wrapper grows naturally with its children, the ResizeObserver fires with the true height, and the virtualizer repositions subsequent rows.

### 2. Keep estimateSize fallback?

YES — keep `rowHeight * 6` estimate for expanded rows. Rationale:
- It prevents a jarring layout reflow: virtualizer renders an initial size before measurement
- Without the estimate, expanded row starts at collapsed height and jumps — noticeable flicker
- With the estimate, the row opens near final size then settles — smoother UX
- No correctness issue: the ResizeObserver will immediately correct it after first paint

### 3. The `dispatchEvent` in the collapse test

The comment says: "Playwright's actionability check detects overlapping log-row-grid elements."

After the fix, rows no longer visually overlay. HOWEVER, the structural reason for the workaround remains:
- `log-row-grid` divs are `position: absolute` wrappers that are `width: 100%`
- They are stacked vertically via `translateY`, NOT in flow
- Playwright's "overlapping element" check looks at the element at the click coordinates, not at z-order or visual overlap
- The element ABOVE in z-stack (higher virtual index) is another `log-row-grid` starting at a higher translateY offset — they don't overlap in coordinates after the fix

After the fix, rows physically don't overlap (each occupies a distinct vertical band), so Playwright's actionability check should pass. The collapse test CAN be updated to `.click()`.

Decision: UPDATE the collapse test to use `.click()` directly. This:
1. Proves the fix works at the Playwright actionability level (no overlap detected)
2. Removes the workaround comment (which described the now-fixed bug)
3. Aligns with how the expand test already works

### 4. New E2E test shape

Test scenario: expand a row, then verify the NEXT row is positioned BELOW the expanded row (bounding box check).

Approach:
- Inject 5+ log lines
- Get bounding box of first row BEFORE expansion
- Click first row to expand it
- Get bounding box of first row AFTER expansion (should be taller)
- Get bounding box of second row AFTER expansion
- Assert: `secondRow.y >= firstRow.y + firstRow.height` (second row starts at or below expanded row's bottom)

The second row is `.log-row:nth-child(2)` or via `page.locator('.log-row').nth(1)` — but need to be careful because `.log-row` is the inner div, while the virtual wrapper is the direct child of the spacer. The bounding box check should be on `.log-row` elements directly, which maps to the visible content bounds.

Actually: `.log-row` is the inner div inside `.log-row-grid`. The safer approach is to get bounding boxes of `.log-row-grid` wrappers, or compare `.log-row` elements' Y positions. Either works. Using `.log-row` is simpler and more readable.

## Risk

The only risk is that the `log-row` CSS class has `height: var(--row-height)` when not expanded. This means the inner `.log-row` div has a fixed height when collapsed — but this is the INNER element, not the wrapper. The wrapper growing freely is what matters for the virtualizer.

When expanded, `.log-row--expanded` has `height: auto` — this is correct and the content drives the height.

The wrapper (virtual row div) growing without a fixed `height` is the fix. The inner `.log-row` already does the right thing via CSS.
