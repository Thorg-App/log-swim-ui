# Exploration: Add Log Level Before Date with Color

## Task Summary
Add log level next before the date (timestamp) and color the log level in its corresponding color. All log levels should be assigned the same width for alignment.

## Current Implementation Analysis

### LogRow Component (`src/renderer/src/components/LogRow.tsx`)
- Current order: `timestamp` → `message preview` (collapsed) or `expanded content`
- Log level is NOT displayed in the row content
- Level only affects left border color via CSS class (`log-row--{level}`)

### CSS Structure (`src/renderer/theme/components.css`)
- `.log-row__timestamp`: styled for timestamp display
- Level classes (`.log-row--trace`, `.log-row--error`, etc.) only set `border-left-color`
- No existing `.log-row__level` class

### Log Level Colors (`src/renderer/theme/tokens.css`)
- `--color-level-trace: #6B7280`
- `--color-level-debug: #94A3B8`
- `--color-level-info: #3B82F6`
- `--color-level-notice: #06B6D4`
- `--color-level-warn: #F59E0B`
- `--color-level-warning: #F59E0B`
- `--color-level-error: #EF4444`
- `--color-level-fatal: #A855F7`
- `--color-level-critical: #F472B6`
- `--color-level-unrecognized: #F97316`

### Known Log Levels (`src/core/types.ts`)
```typescript
const KNOWN_LOG_LEVELS = [
  'trace', 'debug', 'info', 'notice',
  'warn', 'warning', 'error', 'fatal', 'critical'
] as const
```

### Utility Functions (`src/renderer/src/log-row-utils.ts`)
- `getLevelCssClass(level)`: returns CSS class for level styling
- Currently used only for border color

## Key Files to Modify
1. `src/renderer/src/components/LogRow.tsx` - Add level element before timestamp
2. `src/renderer/theme/components.css` - Add `.log-row__level` class with fixed width and color
3. `src/renderer/src/log-row-utils.ts` - Add helper to get level color CSS variable

## Implementation Approach
1. Add a new `<span className="log-row__level">` element before timestamp
2. Apply level color via inline style or CSS variable
3. Use fixed width (e.g., `5ch` or `6ch`) to align all levels
4. Use uppercase or capitalize for consistency

## Technical Constraints
- Follow existing CSS patterns (use tokens via `var()`)
- No inline styles except dynamic color
- Respect monospace font for log content
