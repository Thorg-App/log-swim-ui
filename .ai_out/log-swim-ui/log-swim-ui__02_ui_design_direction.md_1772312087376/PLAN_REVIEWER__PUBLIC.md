# Plan Review: Phase 02 - UI Design Direction

## Executive Summary

This is a well-structured, thorough plan that correctly scopes the work as CSS architecture and visual verification only. The token system is comprehensive, the grey scale choice (Tailwind Slate family) is smart and cohesive with the existing spec colors, and the component CSS covers all UI elements from the high-level design. Two critical issues and a few minor concerns are identified below, but overall the plan is ready for implementation with minor adjustments.

## Critical Issues (BLOCKERS)

### 1. `--color-surface` duplicates `--color-grey-800` but uses a raw HSL value instead of a `var()` reference

- **Issue**: In Section A.2, `--color-surface: hsl(217, 33%, 17%)` is defined as a raw HSL value. Looking at the grey scale in A.1, `--color-grey-800: hsl(217, 33%, 17%)` is the identical value. The semantic token should reference `var(--color-grey-800)`, not duplicate the raw value. Similarly, `--color-surface-hover` and `--color-surface-active` do not reference grey scale tokens.
- **Impact**: Violates DRY. If the grey scale is tweaked, the surface colors become inconsistent. The plan's own "Critical rule" (Phase B: "Every visual value MUST reference a `var(--token)`. Zero hardcoded values.") should also apply to semantic tokens referencing the grey palette tokens.
- **Recommendation**: Change:
  ```css
  --color-surface:         var(--color-grey-800);
  --color-surface-hover:   var(--color-grey-700);  /* or a new grey between 700-800 */
  --color-surface-active:  var(--color-grey-700);
  ```
  If a value truly needs to be between two grey stops, that is acceptable as a raw HSL value with a `/* WHY: between grey-700 and grey-800 */` comment. But for exact matches, use `var()`.

**SEVERITY**: This is a minor inline adjustment, not a plan iteration trigger. I am making this correction inline. The implementor should use `var(--color-grey-XXX)` references for semantic tokens that match existing grey scale values exactly, and add a WHY comment for any that intentionally sit between grey stops.

### 2. `stream-ended__dot` uses hardcoded `8px` dimensions

- **Issue**: In B.8, `.stream-ended__dot` has `width: 8px; height: 8px;` -- hardcoded values rather than tokens.
- **Impact**: Violates the plan's own "Zero hardcoded values" rule for `components.css`.
- **Recommendation**: Use `var(--space-2)` (which is 8px) instead:
  ```css
  .stream-ended__dot {
    width: var(--space-2);
    height: var(--space-2);
    ...
  }
  ```

**SEVERITY**: Minor inline adjustment. Implementor should use the spacing token.

---

## Major Concerns

None. The plan is well-scoped and appropriately simple for a CSS-only design phase.

---

## Minor Concerns

### 1. `--color-surface-hover` maps to `#1E293B approx` but so does `--color-swimlane-header` and `--color-row-hover`

- **Concern**: Three separate tokens (`--color-surface-hover`, `--color-swimlane-header`, `--color-row-hover`) appear to resolve to the same or very similar value (`#1E293B` / slate-800). This is intentional per the spec (config.json has `"swimlaneHeaders": "#1E293B"` and `"rowHover": "#1E293B"` as separate concerns), but the semantic layer should be clear that these CAN diverge independently via config.
- **Why**: This is fine. Having separate semantic tokens for distinct concepts (surface hover vs. swimlane header vs. row hover) is correct even when they share the same default value. Users may want to override `swimlaneHeaders` without affecting `rowHover`.
- **Suggestion**: No change needed. Just noting this is reviewed and intentional.

### 2. `unparseable-panel__badge` has `min-width: 20px; height: 20px` hardcoded

- **Concern**: These are hardcoded pixel values in `components.css`.
- **Suggestion**: Consider using a token or at minimum use `calc()` on spacing tokens. However, badge sizing is often a one-off that does not benefit from tokenization. This is borderline -- the implementor should use their judgment. If a token like `--badge-size: 20px` feels over-engineered for a single use, a `/* WHY: one-off badge size, not worth a token */` comment suffices.

### 3. B.12 `.is-disabled` sets both `pointer-events: none` and `cursor: not-allowed`

- **Concern**: `pointer-events: none` prevents all mouse interactions including cursor changes, so `cursor: not-allowed` will never be visible.
- **Suggestion**: Remove `cursor: not-allowed` since it is unreachable, or remove `pointer-events: none` and rely on component logic to prevent clicks. Given this is a CSS-only phase, using just `pointer-events: none` is simpler and correct.

### 4. Font loading disclaimer is appropriate

- **Concern**: None. The plan correctly defers font bundling. System fallbacks are fine for a developer tool.

### 5. Phase F (Playwright MCP verification) may not work with Electron

- **Concern**: The plan acknowledges this and provides a fallback (use Vite dev server URL at `http://localhost:5173`). This is practical. However, electron-vite's dev mode may not serve the renderer at a standalone URL. The implementor should verify the actual URL. Typically, electron-vite serves the renderer through Electron's window, not as a standalone web page.
- **Suggestion**: The implementor may need to temporarily add a standalone Vite dev server entry point, or take screenshots via Electron's built-in `webContents.capturePage()`, or simply open the Electron window and use Playwright MCP against it. This is an implementation detail, not a plan issue.

---

## Simplification Opportunities (PARETO)

### 1. B.13 Utility classes may be premature

- **Current**: 8 utility classes (`.text-mono`, `.text-sans`, `.text-xs`, etc.)
- **Simpler alternative**: Skip utility classes entirely until a component actually needs them. The DesignReferencePage can use component classes or inline the font-family/size references directly in component classes.
- **Value**: Eliminates dead code. If utility classes are needed later, they are trivial to add.
- **Verdict**: This is a very minor concern. Keeping them is fine -- they are small, clear, and may be useful in the reference page.

### 2. `applyConfigToCSS.ts` is more implementation than stub

- **Current**: A fully typed, fully implemented function with proper config interfaces and mapping logic.
- **Simpler alternative**: A true stub would be just the interface + an empty function body with a TODO comment.
- **Value**: The current approach is actually better than a stub -- it gives Phase 04 a working function to wire up. No simplification needed.

---

## Consistency Checks

### Config.json Color Values vs. CSS Tokens

| Config field | Config hex | Token name | Token value | Match? |
|---|---|---|---|---|
| `levels.trace` | `#6B7280` | `--color-level-trace` | `#6B7280` | YES |
| `levels.debug` | `#94A3B8` | `--color-level-debug` | `#94A3B8` | YES |
| `levels.info` | `#3B82F6` | `--color-level-info` | `#3B82F6` | YES |
| `levels.notice` | `#06B6D4` | `--color-level-notice` | `#06B6D4` | YES |
| `levels.warn` | `#F59E0B` | `--color-level-warn` | `#F59E0B` | YES |
| `levels.warning` | `#F59E0B` | `--color-level-warning` | `#F59E0B` | YES |
| `levels.error` | `#EF4444` | `--color-level-error` | `#EF4444` | YES |
| `levels.fatal` | `#991B1B` | `--color-level-fatal` | `#991B1B` | YES |
| `levels.critical` | `#991B1B` | `--color-level-critical` | `#991B1B` | YES |
| `unrecognizedLevel` | `#F97316` | `--color-level-unrecognized` | `#F97316` | YES |
| `swimlaneHeaders` | `#1E293B` | `--color-swimlane-header` | `#1E293B` | YES |
| `background` | `#0F172A` | `--color-bg` (via `--color-grey-900`) | `hsl(222, 47%, 11%)` | YES (equivalent) |
| `rowHover` | `#1E293B` | `--color-row-hover` | `#1E293B` | YES |
| `expandedRow` | `#334155` | `--color-expanded-row` | `#334155` | YES |
| `ui.rowHeight` | `32` | `--row-height` | `32px` | YES |
| `ui.fontSize` | `12` | `--text-sm` | `12px` | YES |

All config.json values are correctly mapped. No gaps.

### Acceptance Criteria Coverage

| Acceptance Criterion | Plan Coverage |
|---|---|
| `tokens.css` with complete CSS custom property definitions | Phase A: YES, comprehensive (75+ tokens) |
| `components.css` referencing only CSS variables | Phase B: YES, 13 component sections |
| HSL color palette with shade scales | Phase A.1: YES, 11 shades (50-950) in Slate family |
| Spacing scale (4-128px) | Phase A.5: YES, 10 values |
| Typography scale with mono and sans-serif | Phase A.6: YES, 2 families, 6 sizes, 4 weights, 3 line-heights, 2 letter-spacing |
| Shadow system (5 levels) | Phase A.7: YES, two-part shadows |
| Design reference page shows all tokens and component sketches | Phase C: YES, detailed section list |
| All component states designed (default, hover, active, focus, disabled, error) | Phase C + B.12: YES, preview-hover classes for static display |
| Dark theme cohesion verified | Phase F: YES, Playwright MCP screenshot |
| CSS variable injection pattern documented and stubbed | Phase E: YES, comment block + typed stub function |

All 10 acceptance criteria are covered. No gaps.

---

## Strengths

1. **Grey scale alignment with Tailwind Slate**: The plan correctly identifies that the existing spec hex values (`#0F172A`, `#1E293B`, `#334155`, `#E2E8F0`) follow the Tailwind Slate palette. Building the grey scale in the same hue family (222) ensures cohesion. This is a smart decision.

2. **Spacing naming convention**: `--space-N` where N = value/4 is clean, memorable, and avoids ambiguity. The documentation of the convention in the plan is clear.

3. **No over-engineering**: No CSS preprocessor, no CSS-in-JS, no Storybook, no CSS modules. Two CSS files is the right answer for this scale.

4. **Clear separation between palette and semantic tokens**: Grey scale tokens are raw values; semantic tokens reference them via `var()`. This allows theme evolution without breaking component references.

5. **BEM-ish naming**: `component__element--modifier` is well-established, grep-friendly, and requires no tooling.

6. **Comprehensive component coverage**: Every UI element from the high-level design (log row, lane header, filter bar, mode toggle, stream-ended, unparseable panel, settings panel, ad-hoc lane input) has CSS classes defined.

7. **"What NOT to Do" section**: Explicitly listing anti-patterns (no Storybook, no CSS-in-JS, no business logic) prevents scope creep.

8. **Preview states via CSS classes**: Using `.preview-hover` classes to show hover states statically on the reference page is practical and avoids Storybook complexity.

9. **`applyConfigToCSS.ts` types**: The stub has proper TypeScript interfaces with `readonly` and `Partial<>` patterns, matching project strict-mode standards.

---

## Inline Adjustments Made

The following minor adjustments should be applied during implementation (no plan iteration needed):

1. **Semantic tokens should `var()`-reference grey scale where values match exactly**. `--color-surface` should be `var(--color-grey-800)`, not a duplicate HSL value. Add WHY comments for any semantic tokens that intentionally sit between grey stops.

2. **`.stream-ended__dot` dimensions**: Use `var(--space-2)` instead of hardcoded `8px`.

3. **`.is-disabled` class**: Remove unreachable `cursor: not-allowed` (since `pointer-events: none` prevents it from being visible).

---

## Verdict
- [x] **APPROVED WITH MINOR REVISIONS**

The plan is comprehensive, well-scoped, and covers all acceptance criteria. The three inline adjustments above are minor and can be applied during implementation without a plan iteration cycle. The CSS token system is solid, the component coverage is complete, and the approach correctly avoids over-engineering.

**Signal: APPROVED -- proceed to implementation.**
