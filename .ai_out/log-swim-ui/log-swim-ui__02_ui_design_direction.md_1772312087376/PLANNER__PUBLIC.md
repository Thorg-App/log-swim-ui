# Planner Output: Phase 02 - UI Design Direction

## Summary

Plan is complete and written to `PLAN.md` in this directory. The plan covers 6 implementation phases (A through F) to create the complete CSS design system, a visual reference page, and the runtime CSS injection pattern.

## Key Decisions Made

1. **Slate-family grey scale (HSL hue ~222)**: The existing hex colors in the spec (`#0F172A`, `#1E293B`, `#334155`, `#E2E8F0`) all follow the Tailwind Slate palette. The HSL-based grey scale uses the same hue family for cohesion. Saturation is boosted at lightness extremes per the design guidance.

2. **Flat token namespace**: All tokens live in `:root` with `--category-name` convention (e.g., `--color-level-error`, `--space-4`, `--text-sm`). No nesting, no CSS preprocessing. Two files, simple and grep-able.

3. **Spacing names use multiplier of 4**: `--space-1` = 4px, `--space-2` = 8px, `--space-4` = 16px, etc. Short, memorable, and the math is trivial.

4. **No CSS preprocessor or CSS-in-JS**: Raw CSS custom properties. The design system is two files. The complexity of adding Sass, PostCSS, or CSS modules is not justified at this scale.

5. **No font loading**: Font stacks use web-safe fallbacks (JetBrains Mono, Inter). Fonts render if installed; otherwise system fallbacks. Bundling fonts is deferred.

6. **Design reference page as React component (not Storybook)**: A single `DesignReferencePage.tsx` component renders all tokens and component sketches. This is simpler than setting up Storybook and is throwaway code replaced in Phase 05+.

7. **Preview states via CSS classes**: Hover/active states are shown on the reference page using forced-state CSS classes (e.g., `.preview-hover`) rather than requiring mouse interaction. This allows static visual verification.

8. **`applyConfigToCSS` as typed stub**: The runtime injection pattern is a real TypeScript function with proper types, but it is not wired up to any config system yet (that happens in Phase 04).

## Files to Create (5 new files, 1 modified)

| File | Purpose |
|------|---------|
| `src/renderer/theme/tokens.css` | CSS custom properties: colors (greys, log levels, semantic), spacing, typography, shadows, borders, layout |
| `src/renderer/theme/components.css` | Structural CSS classes for all components: log row, lane header, swimlane grid, filter bar, mode toggle, settings panel, unparseable panel, etc. |
| `src/renderer/src/DesignReferencePage.tsx` | Visual showcase of all tokens and component state previews |
| `src/renderer/src/applyConfigToCSS.ts` | Typed stub for runtime config-to-CSS injection |
| `src/renderer/src/App.tsx` | **Modified**: Remove inline styles, import theme CSS, render DesignReferencePage |

## Token Count Summary

The `tokens.css` file will define approximately 75+ CSS custom properties across:
- 11 grey shades (50-950)
- 10 log level colors
- 8 semantic surface/text/border colors
- 6 component-specific color groups
- 10 spacing values
- 10 typography values (2 families, 6 sizes, 4 weights, 3 line-heights)
- 5 shadow levels
- 5 border tokens
- 7 layout/dimension tokens
- 3 transition tokens

## Risks Identified

1. **Low risk**: Font rendering without bundled fonts -- system fallbacks are acceptable for a developer tool. Defer font bundling.
2. **Low risk**: Playwright MCP may not navigate to Electron dev server directly -- fallback is to use Vite dev server URL (`http://localhost:5173`) or take screenshots manually.
3. **No risk**: No business logic, no dependencies, no integration points. This is pure CSS + static HTML.

## Open Questions

None. All design values are specified in the task document and high-level spec. The design memory files referenced in the task are not available on this system, but all essential guidance is already embedded in the task and spec documents (confirmed during exploration).
