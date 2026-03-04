# Implementation Plan: Add Log Level Before Date with Color

## Problem Understanding

Add a log level display element before the timestamp in each log row. The log level text should:
1. Appear before the date/timestamp
2. Be colored according to its corresponding level color
3. Have a fixed width for proper alignment across all rows

## High-Level Architecture

The change is a localized UI enhancement affecting only the `LogRow` component and its associated CSS.

```
LogRow Structure (Collapsed):
  [level-badge] [timestamp] [message preview]
       ^            ^
       |            |
    NEW          existing
```

## Implementation Phases

### Phase 1: Add CSS Styles for Level Badge

**Goal**: Create CSS classes for the log level display with fixed width and color support.

**Files to Modify**:
- `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/renderer/theme/components.css`

**Key Steps**:
1. Add `.log-row__level` base class:
   - Fixed width: `5ch` (accommodates "FATAL", "CRITICAL", "WARN", etc. - longest is 8 chars but uppercase short forms work)
   - Actually, longest level is "critical" (8 chars), "warning" (7 chars). Use `8ch` to accommodate all.
   - Font styling: uppercase, monospace, text-align right
   - Margin-right for spacing before timestamp

2. Add color classes for each known level:
   - `.log-row__level--trace` → `color: var(--color-level-trace)`
   - `.log-row__level--debug` → `color: var(--color-level-debug)`
   - `.log-row__level--info` → `color: var(--color-level-info)`
   - `.log-row__level--notice` → `color: var(--color-level-notice)`
   - `.log-row__level--warn` → `color: var(--color-level-warn)`
   - `.log-row__level--warning` → `color: var(--color-level-warning)`
   - `.log-row__level--error` → `color: var(--color-level-error)`
   - `.log-row__level--fatal` → `color: var(--color-level-fatal)`
   - `.log-row__level--critical` → `color: var(--color-level-critical)`
   - `.log-row__level--unrecognized` → `color: var(--color-level-unrecognized)`

**CSS Snippet**:
```css
.log-row__level {
  flex-shrink: 0;
  width: 8ch;
  text-align: right;
  margin-right: var(--space-2);
  text-transform: uppercase;
  font-weight: var(--weight-semibold);
}

/* Level-specific text colors */
.log-row__level--trace     { color: var(--color-level-trace); }
.log-row__level--debug     { color: var(--color-level-debug); }
.log-row__level--info      { color: var(--color-level-info); }
.log-row__level--notice    { color: var(--color-level-notice); }
.log-row__level--warn      { color: var(--color-level-warn); }
.log-row__level--warning   { color: var(--color-level-warning); }
.log-row__level--error     { color: var(--color-level-error); }
.log-row__level--fatal     { color: var(--color-level-fatal); }
.log-row__level--critical  { color: var(--color-level-critical); }
.log-row__level--unrecognized { color: var(--color-level-unrecognized); }
```

**Dependencies**: None

---

### Phase 2: Add Helper Function for Level CSS Class

**Goal**: Create a utility function to get the level text color CSS class.

**Files to Modify**:
- `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/renderer/src/log-row-utils.ts`

**Key Steps**:
1. Add `getLevelTextCssClass(level: string): string` function:
   - Same logic as `getLevelCssClass()` but returns `.log-row__level--{level}` format
   - Returns `log-row__level--unrecognized` for unknown levels

**Code Snippet**:
```typescript
/**
 * Returns the CSS class for a log level's text color.
 * Known levels map to `.log-row__level--{level}`.
 * Unknown levels map to `.log-row__level--unrecognized`.
 */
function getLevelTextCssClass(level: string): string {
  const normalized = level.toLowerCase()
  if (KNOWN_LOG_LEVELS_SET.has(normalized)) {
    return `log-row__level--${normalized}`
  }
  return 'log-row__level--unrecognized'
}
```

**Dependencies**: None

---

### Phase 3: Update LogRow Component

**Goal**: Render the log level element before the timestamp.

**Files to Modify**:
- `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/renderer/src/components/LogRow.tsx`

**Key Steps**:
1. Import the new `getLevelTextCssClass` function
2. Add level element before timestamp in the JSX:
   ```tsx
   <span className={`log-row__level ${getLevelTextCssClass(entry.level)}`}>
     {entry.level.toUpperCase()}
   </span>
   ```

**Dependencies**: Phase 2

---

### Phase 4: Add Unit Tests

**Goal**: Verify the new utility function works correctly.

**Files to Modify**:
- Create or update: `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/tests/unit/log-row-utils.test.ts`

**Key Test Cases**:
1. Known levels return correct class names (trace, debug, info, warn, error, fatal)
2. Unknown levels return `log-row__level--unrecognized`
3. Case-insensitive matching (e.g., "ERROR", "Error", "error" all map correctly)

---

## Acceptance Criteria

1. **Visual**: Log level appears before timestamp in each log row
2. **Color**: Log level text is colored according to its level (e.g., error = red, warn = orange)
3. **Alignment**: All log levels have the same width (8ch) for proper column alignment
4. **Collapsed and Expanded**: Level display works in both collapsed and expanded row states
5. **Unknown Levels**: Unrecognized levels display with the orange "unrecognized" color
6. **No Regression**: Existing functionality (border colors, timestamp formatting) remains unchanged

## Testing Strategy

### Manual Testing
1. Run `npm run dev`
2. Pipe sample JSON logs with various levels (trace, debug, info, warn, error, fatal, custom)
3. Verify:
   - Level text appears before timestamp
   - Level text color matches the left border color
   - All levels align vertically
   - Expanded rows still show the level

### Automated Testing
- Unit test for `getLevelTextCssClass()` covering known and unknown levels
- E2E test (optional): Verify level text is present and colored correctly in the DOM

## Technical Considerations

### Width Calculation
The longest known level name is "critical" (8 characters). Using `8ch` ensures all levels fit. The `text-align: right` creates a clean right edge before the timestamp.

### Performance
This is a pure display change with no algorithmic impact. React reconciliation handles the new span element efficiently.

### Maintainability
- Reuses existing CSS variable tokens from `tokens.css`
- Follows existing patterns (same structure as border color classes)
- Single source of truth: `KNOWN_LOG_LEVELS` in `types.ts`
