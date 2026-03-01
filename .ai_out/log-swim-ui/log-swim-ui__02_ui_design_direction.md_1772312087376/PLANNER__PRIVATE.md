# Planner Private Context: Phase 02

## Key Implementation Details for Follow-up Agents

### CSS Import Path
- CSS files are at `src/renderer/theme/` (sibling to `src/renderer/src/`)
- From `App.tsx` (in `src/renderer/src/`), the import path is `../theme/tokens.css`
- Vite handles CSS imports in TSX files natively -- no config changes needed

### Path Alias Note
- `@renderer/*` maps to `src/renderer/src/*` -- theme files are NOT under `src/*` path alias
- Theme CSS must be imported via relative path (`../theme/`) from renderer source files
- The `@core` alias maps to `src/core/` which is not used in this phase

### tsconfig Consideration
- `tsconfig.web.json` includes `src/renderer/src/**/*` but NOT `src/renderer/theme/`
- This is fine because CSS files are not TypeScript -- Vite processes them directly
- The `.ts` stub (`applyConfigToCSS.ts`) goes in `src/renderer/src/` so it IS covered by tsconfig

### DesignReferencePage Design
- Must use raw HTML elements with CSS classes, not custom React components
- No state, no hooks, no interactivity
- For hover/active state previews, add duplicate CSS rules in components.css with `.preview-hover`, `.preview-active` etc. class selectors that mirror the `:hover`, `:active` pseudo-class styles
- Keep all preview-state classes grouped at the bottom of components.css under a clear comment header

### Grey Scale Alignment
- The grey scale is deliberately aligned with Tailwind's Slate palette:
  - `--color-grey-900` = `#0F172A` (app background from spec)
  - `--color-grey-800` = `#1E293B` (swimlane headers / row hover)
  - `--color-grey-700` = `#334155` (expanded row background)
  - `--color-grey-200` = `#E2E8F0` (primary text color)
- This ensures the HSL values produce colors that match the hex values already specified in config.json

### Build Verification
- `npm run typecheck` should pass after changes
- `npm run build` should succeed (Vite will process CSS imports)
- No test changes needed for this phase

### Phase 02 Produces Zero Tests
- This is explicitly a design-only phase
- Visual verification is done via Playwright MCP screenshots
- The `applyConfigToCSS.ts` stub has no behavior worth unit-testing yet
