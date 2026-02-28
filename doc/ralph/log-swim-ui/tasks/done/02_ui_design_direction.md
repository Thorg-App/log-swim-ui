# Phase 02: UI Design Direction

## Objective
Establish the visual design system, CSS tokens, and component wireframes for the entire application. This phase produces the design foundation that all subsequent UI phases build upon.

## Prerequisites
- Phase 01 complete (project scaffold with working build)

## Scope
### In Scope
- Load and apply design principles from `${MY_DEEP_MEM}/my-frontend-design.md` and its linked sub-memories
- Define the complete CSS token system (`src/renderer/theme/tokens.css`):
  - Color palette (HSL-based, with shade scales per the design memory)
  - Spacing scale (4, 8, 12, 16, 24, 32, 48, 64, 96, 128px)
  - Typography scale (font families, sizes, weights, line-heights)
  - Shadow system (5 levels of elevation)
  - Border styles (prefer 2px muted over 1px strong)
- Define component-level CSS (`src/renderer/theme/components.css`) referencing only CSS variables
- Create a design reference document or storybook-like page showing:
  - Color swatches with all token values
  - Typography samples at each scale point
  - Component sketches: log row, lane header, filter bar, mode toggle, settings panel
  - State variations: default, hover, active, focus, disabled, error
- Design decisions for key components:
  - Log row: left border color by level, timestamp, message preview, expanded state
  - Lane header: truncated regex with tooltip, error state, drag handle
  - Filter bar: add/remove/toggle filters
  - Mode toggle (Live/Scroll): styled switch (not a radio button)
  - Stream-ended indicator
  - Unparseable timestamp bottom panel
  - Settings slide-out panel
  - Ad-hoc lane addition input
- Ensure dark theme cohesion (the app uses a dark background `#0F172A`)
- Runtime CSS variable injection pattern (config values → CSS custom properties on `:root`)

### Out of Scope
- Functional React components (Phase 05+)
- Data pipeline or business logic
- Actual Electron integration

## Implementation Guidance

### Design Memory References
Load and apply guidance from:
- `${MY_DEEP_MEM}/my-frontend-design.md` — master design memory (primary)
- `${MY_ENV}/ai_input/memory/deep/ui/part_2_Hierarchy_is_Everything.md` — hierarchy & emphasis
- `${MY_ENV}/ai_input/memory/deep/ui/part_3_layout_and_spacing.md` — layout & spacing
- `${MY_ENV}/ai_input/memory/deep/ui/part_4_Designing_Text.md` — typography
- `${MY_ENV}/ai_input/memory/deep/ui/part_5_Working_with_Color.md` — color craft
- `${MY_ENV}/ai_input/memory/deep/ui/part_6_creating_depth.md` — depth & shadows
- `${MY_ENV}/ai_input/memory/deep/ui/part_8_finishing_touches.md` — finishing touches

### Key Design Principles (from memory)
- **Audience**: Technical users (software engineers) who value clarity, density, and low visual noise
- **Tone**: Utilitarian, clean, information-dense — a developer tool, not a consumer product
- **Color**: HSL-based palette. Greys (8-10 shades) + Primary + Accents for states. Boost saturation at lightness extremes.
- **Typography**: Monospace for log content (JetBrains Mono / Fira Code / SF Mono). Sans-serif for UI chrome (Inter / system font stack). Hand-pick scale, no ratio-based.
- **Spacing**: Use the defined spacing scale. Start generous, tighten. Spacing = grouping.
- **Depth**: Light from above. Shadow = elevation. Two-part shadows.
- **Borders**: 2px muted preferred over 1px strong.

### CSS Architecture
```
src/renderer/theme/
  tokens.css        — CSS custom properties for all visual values
  components.css    — Structural styles referencing only CSS variables
```

At runtime, config values override tokens:
```typescript
document.documentElement.style.setProperty('--color-level-error', config.colors.levels.error);
document.documentElement.style.setProperty('--row-height', config.ui.rowHeight + 'px');
```

### Component Design Notes
- **Log row**: Height driven by `--row-height`. Left border 3px solid, colored by level. Monospace font. Truncated message preview. Click-to-expand shows pretty-printed JSON with `--color-expanded-row` background.
- **Lane header**: Shows regex pattern truncated with `text-overflow: ellipsis`. Tooltip shows full regex on hover. Drag handle on left side. Error state: red/orange tinted background with error icon.
- **Mode toggle**: A pill-shaped toggle switch. Active mode highlighted. Auto-switches visually when scroll behavior changes.
- **Unparseable panel**: Appears at bottom only when errors exist. Distinct background color. Collapsible or has a count badge.
- **Settings panel**: Slides in from right. Semi-transparent backdrop over logs. Organized in sections matching config structure (Colors, UI, Performance).

## Acceptance Criteria
- [ ] `src/renderer/theme/tokens.css` exists with complete CSS custom property definitions
- [ ] `src/renderer/theme/components.css` exists with structural styles referencing only CSS variables
- [ ] Color palette defined in HSL with shade scales for primary, accent, and grey
- [ ] Spacing scale defined (4–128px)
- [ ] Typography scale defined with monospace and sans-serif families
- [ ] Shadow system defined (5 levels)
- [ ] Design reference page or document shows all tokens and component sketches
- [ ] All component states designed: default, hover, active, focus, disabled, error
- [ ] Dark theme cohesion verified
- [ ] CSS variable injection pattern documented and stubbed

## Notes
- This phase is primarily a design exercise. The output is CSS files and a design reference, not functional components.
- The design tokens created here will be consumed by Phases 05, 06, and 07.
- Use Playwright MCP screenshots to visually verify the design reference page.
