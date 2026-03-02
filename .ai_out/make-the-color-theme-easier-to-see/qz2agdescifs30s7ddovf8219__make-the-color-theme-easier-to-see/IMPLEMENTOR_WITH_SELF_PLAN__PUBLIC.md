# Color Theme Legibility Improvement

## Summary

Aligned the two mismatched color systems (Bootstrap in `DEFAULT_APP_CONFIG` vs Tailwind Slate in `tokens.css`) and improved log level color contrast for dark backgrounds. Lane header text upgraded from secondary to primary color for better readability.

## Before / After Color Values

### Surface Colors (`DEFAULT_APP_CONFIG`)

| Property | Before (Bootstrap) | After (Tailwind Slate) | Notes |
|----------|-------------------|----------------------|-------|
| `background` | `#212529` | `#0F172A` | Matches `--color-grey-900` |
| `swimlaneHeaders` | `#495057` | `#1E293B` | Matches `--color-swimlane-header` token |
| `rowHover` | `#2c3034` | `#1E293B` | Matches `--color-row-hover` token |
| `expandedRow` | `#343a40` | `#334155` | Matches `--color-expanded-row` token |

### Log Level Colors (`DEFAULT_APP_CONFIG`)

| Level | Before (Bootstrap) | After (Tailwind/Dark Theme) | Notes |
|-------|-------------------|---------------------------|-------|
| `trace` | `#6c757d` | `#6B7280` | Grey 500, muted |
| `debug` | `#0dcaf0` | `#94A3B8` | Slate 400, subtle |
| `info` | `#198754` | `#3B82F6` | Blue 500, clear |
| `warn` | `#ffc107` | `#F59E0B` | Amber 500, vivid |
| `error` | `#dc3545` | `#EF4444` | Red 500, vivid |
| `fatal` | `#6f42c1` | `#A855F7` | Purple 500, vivid |
| `unrecognizedLevel` | `#adb5bd` | `#F97316` | Orange 500, distinct |

### Log Level Colors (`tokens.css` defaults)

| Level | Before | After | Notes |
|-------|--------|-------|-------|
| `fatal` | `#991B1B` (dark red, ~invisible) | `#A855F7` (Purple 500) | High contrast on dark bg |
| `critical` | `#991B1B` (dark red, ~invisible) | `#F472B6` (Pink 400) | Distinct from error/fatal |

### Lane Header Text (`components.css`)

| Property | Before | After |
|----------|--------|-------|
| `.lane-header` color | `var(--color-text-secondary)` (grey-400, 65% lightness) | `var(--color-text-primary)` (grey-200, 91% lightness) |

## Files Modified

| File | Change |
|------|--------|
| `src/core/types.ts` | Aligned `DEFAULT_APP_CONFIG` surface and level colors with Tailwind Slate palette |
| `src/renderer/theme/tokens.css` | Updated fatal/critical from dark red (#991B1B) to vivid purple/pink |
| `src/renderer/theme/components.css` | Lane header text: `--color-text-secondary` -> `--color-text-primary` |
| `tests/unit/core/types.test.ts` | Updated background color assertion from `#212529` to `#0F172A` |

## Test Results

```
Test Files  16 passed (16)
     Tests  274 passed (274)
  Duration  234ms
```

Typecheck: passes (exit code 0).
