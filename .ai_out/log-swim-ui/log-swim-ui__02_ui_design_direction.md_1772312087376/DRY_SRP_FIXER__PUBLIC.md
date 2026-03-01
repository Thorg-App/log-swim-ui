# DRY/SRP Analysis -- Phase 02: UI Design Direction

## Summary

**1 SRP violation found and fixed.** No DRY violations found.

---

## SRP Violation: Mixed Responsibilities in `components.css`

### Problem

`components.css` contained THREE distinct responsibilities with different reasons to change:

1. **Production component CSS** (~468 lines) -- changes when component design changes
2. **Preview state classes** (~40 lines, `.preview-hover`, `.preview-focus`, etc.) -- development-only, changes when reference page needs new state previews
3. **Design reference page layout** (~200 lines, `.ref-*` classes) -- development-only, changes when reference page layout changes

Responsibilities (2) and (3) share the same lifecycle: both are development-only artifacts tied to `DesignReferencePage.tsx`, and both will be deleted entirely when the reference page is replaced in Phase 05+. Mixing throwaway development CSS with production CSS creates a file with two axes of change -- a textbook SRP violation.

### Fix Applied

Extracted all development-only CSS (preview state classes AND `ref-*` layout classes) into a new file:

| File | Action | Content |
|------|--------|---------|
| `src/renderer/theme/design-reference.css` | **Created** | 261 lines -- preview state classes + design reference page layout |
| `src/renderer/theme/components.css` | **Modified** | Reduced from 727 to 468 lines -- production component CSS only |
| `src/renderer/src/DesignReferencePage.tsx` | **Modified** | Added `import '../theme/design-reference.css'` |

The import is colocated with its sole consumer (`DesignReferencePage.tsx`), so when the reference page is deleted in Phase 05+, the CSS file deletion is obvious and contained.

---

## DRY Analysis: No Violations Found

### Investigated and Cleared

| Pattern | Verdict | Reasoning |
|---------|---------|-----------|
| `--color-swimlane-header: #1E293B` and `--color-row-hover: #1E293B` | **NOT a DRY violation** | Different knowledge. Independently configurable via `applyConfigToCSS` (`config.colors.swimlaneHeaders` vs `config.colors.rowHover`). Same default value does not mean same knowledge. |
| `--color-error: #EF4444` and `--color-level-error: #EF4444` | **NOT a DRY violation** | Different knowledge. `--color-error` is a semantic UI state color (error borders, badges). `--color-level-error` is a user-configurable log level indicator color from config.json. They change for different reasons. |
| `--color-warning: #F59E0B` and `--color-level-warn: #F59E0B` | **NOT a DRY violation** | Same reasoning as error colors above. |
| `--color-level-fatal: #991B1B` and `--color-level-critical: #991B1B` | **NOT a DRY violation** | Intentional aliases for different logging framework naming conventions. The spec explicitly lists both. |
| `--color-level-warn: #F59E0B` and `--color-level-warning: #F59E0B` | **NOT a DRY violation** | Same as fatal/critical -- intentional aliases. |
| Component tokens using hex (`#1E293B`) instead of `var(--color-grey-800)` | **NOT a DRY violation** | The hex values come from the Tailwind Slate palette in the spec. The grey scale HSL values are hand-tuned approximations that produce slightly different colors (e.g., `hsl(217, 33%, 17%)` converts to `#1D2839`, not `#1E293B`). Using `var()` would silently change the spec-mandated defaults. |
| `display: inline-flex; align-items: center` repeated across 5 component classes | **NOT a DRY violation** | Different components (filter-chip, filter-add-btn, mode-toggle, stream-ended, unparseable-panel__badge) with different reasons to change. Code looks similar but represents different knowledge. |
| Log level lists in `applyConfigToCSS.ts` vs `DesignReferencePage.tsx` | **NOT a DRY violation** | Different knowledge. `CSS_VAR_MAP_LEVELS` maps config keys to CSS vars (runtime injection). `LOG_LEVELS` maps CSS vars to display labels (visual reference). Furthermore, `DesignReferencePage.tsx` is a throwaway artifact. |

---

## Verification Results

| Check | Result |
|-------|--------|
| `npm run typecheck` | PASS (exit 0) |
| `npm test` | PASS (exit 0) |
| Design reference page renders | VERIFIED (all sections visible, no missing styles) |
| Console errors | Only missing favicon.ico (expected, harmless) |
