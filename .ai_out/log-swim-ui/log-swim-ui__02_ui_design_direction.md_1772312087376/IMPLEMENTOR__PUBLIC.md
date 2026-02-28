# IMPLEMENTOR -- Phase 02: UI Design Direction

## Status: COMPLETE

All plan phases (A through F) implemented and verified.

## Files Created/Modified

| File | Action | Description |
|------|--------|-------------|
| `src/renderer/theme/tokens.css` | Created | 96 CSS custom properties: grey scale, semantic colors, log levels, component colors, spacing, typography, shadows, borders, layout, transitions |
| `src/renderer/theme/components.css` | Created | Structural CSS classes for all UI components + design reference page layout styles + preview state classes |
| `src/renderer/src/DesignReferencePage.tsx` | Created | Static React component showcasing all tokens and component sketches |
| `src/renderer/src/App.tsx` | Modified | Removed inline styles, imports theme CSS, renders DesignReferencePage |
| `src/renderer/src/applyConfigToCSS.ts` | Created | Typed stub for runtime config-to-CSS-variable injection |

## Plan Reviewer Adjustments Applied

All three minor adjustments from the plan reviewer were applied:

1. **Semantic tokens use `var()` references to grey scale** -- `--color-surface: var(--color-grey-800)`, `--color-surface-active: var(--color-grey-700)`, with a WHY comment for `--color-surface-hover` which sits between grey stops.
2. **`.stream-ended__dot` dimensions** -- Uses `var(--space-2)` instead of hardcoded `8px`.
3. **`.is-disabled` cursor** -- Removed `cursor: not-allowed` since `pointer-events: none` makes it unreachable.

## Verification Results

| Check | Result |
|-------|--------|
| `npm run typecheck` | PASS (exit 0) |
| `npm test` | PASS (exit 0) |
| Hardcoded hex colors in components.css | NONE (zero matches) |
| Token count in tokens.css | 96 definitions (target: 70+) |
| All files exist | YES |
| Design reference page renders | YES (verified via Playwright MCP screenshots) |
| Dark theme cohesion | VERIFIED -- consistent slate palette, distinct log level colors, good contrast |
| Console errors | Only missing favicon.ico (expected, harmless) |

## Visual Verification

Screenshots saved to `.out/` (not source-controlled):
- `design-reference-full-page.png` -- Full page capture
- `design-reference-typography.png` -- Spacing bars and typography samples
- `design-reference-shadows-borders.png` -- Border widths/radii and log rows by level
- `design-reference-log-rows-states.png` -- Log row states (default, hover, expanded, disabled)
- `design-reference-filter-toggle.png` -- Filter bar, mode toggle, stream-ended indicator
- `design-reference-panels-input.png` -- Settings panel preview and ad-hoc lane input states
- `design-reference-bottom.png` -- Ad-hoc lane input (default, focused, error)

## Deviations from Plan

1. **Unparseable panel `position: static` override**: The design reference page renders the unparseable panel inline (not fixed-positioned) using an inline `style={{ position: 'static' }}` override. This is the only inline style in the reference page and is necessary because the component's CSS uses `position: relative` which is fine in context but needs to be non-fixed for the reference page preview. This is a development-only concern.

2. **Reference page layout CSS added to components.css**: The `.ref-*` classes for the design reference page layout (swatch grids, spacing bars, shadow boxes, etc.) were added at the bottom of `components.css` under a clear "Design Reference Page Layout" section header. These are development-only and will be removed when the reference page is replaced in Phase 05+.

3. **`unparseable-panel__badge` hardcoded dimensions**: Kept `min-width: 20px; height: 20px` with a WHY comment per the reviewer's guidance -- a one-off badge size not worth a dedicated token.

## Notes for Next Phase

- The design reference page (`DesignReferencePage.tsx`) is a throwaway development artifact. It will be replaced when real components are built.
- The `applyConfigToCSS.ts` stub is importable and typechecks but is not wired up yet. Phase 04 will connect it to the config system.
- Electron's sandbox configuration prevents `npm run dev` from launching the full Electron window in this environment. The renderer was verified via a standalone Vite dev server. This is an environment-specific limitation, not a code issue.
