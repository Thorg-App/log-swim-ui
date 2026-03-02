# Exploration: Make Color Theme Easier to See

## Root Cause

**Two mismatched color systems** cause poor legibility:

1. **CSS Tokens** (`tokens.css`): Uses Tailwind Slate palette — dark blue-greys, well-structured
2. **DEFAULT_APP_CONFIG** (`types.ts`): Uses Bootstrap Dark palette — neutral greys, different values

At runtime, `applyConfigToCSS()` overrides SOME CSS tokens (backgrounds, level colors) with config values, but NOT text colors. This creates a mismatch:
- Background from config: `swimlaneHeaders: '#495057'` (Bootstrap grey-600, fairly bright)
- Text from tokens: `--color-text-secondary: grey-400` (Tailwind, also mid-brightness)
- **Result**: Grey text on grey background = poor contrast

## Specific Issues

### 1. Lane Header Text (Primary Complaint)
- CSS class: `.lane-header { color: var(--color-text-secondary) }` → grey-400 (HSL 65% lightness)
- Background: `var(--color-swimlane-header)` overridden at runtime to `#495057`
- Both are mid-greys → low contrast ratio

### 2. DEFAULT_APP_CONFIG vs Tokens Mismatch
| Property | Config Default | Token Default | Issue |
|----------|---------------|---------------|-------|
| swimlaneHeaders | `#495057` | `#1E293B` | Config is much lighter |
| background | `#212529` | `hsl(222,47%,11%)` ≈ `#0F172A` | Different hue |
| rowHover | `#2c3034` | `#1E293B` | Different values |
| expandedRow | `#343a40` | `#334155` | Different hue |
| Level colors | Bootstrap-based | Tailwind-based | Completely different palettes |

### 3. Interactive Controls Too Dim
- Drag handles, case toggles, remove buttons: `--color-text-disabled` (grey-600, 35% lightness)
- On dark backgrounds → barely visible (~3.5:1 contrast)

## Key Files

| File | What Changes |
|------|-------------|
| `src/core/types.ts` | `DEFAULT_APP_CONFIG` — align with token colors |
| `src/renderer/theme/tokens.css` | Improve log level color contrast; align swimlane tokens |
| `src/renderer/theme/components.css` | Lane header text: use `--color-text-primary` |
| `src/renderer/src/applyConfigToCSS.ts` | No changes expected |

## Recommended Approach

1. **Align DEFAULT_APP_CONFIG** with CSS token colors (Tailwind Slate palette)
2. **Upgrade lane header text** from `--color-text-secondary` to `--color-text-primary`
3. **Improve log level colors** for better contrast on dark backgrounds
4. **Keep existing CSS token architecture** — it's well-structured, just needs consistent values
