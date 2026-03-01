# Phase 05: UI -- Swimlane Layout, Rows & Modes -- Implementation Summary

## Sub-phase 5A: Core App Shell + State + IPC Wiring (COMPLETE)

All acceptance criteria met. See previous version for details.

## Sub-phase 5B: Swimlane Grid + Virtualization + LogRow (COMPLETE)

All acceptance criteria met. See previous version for details.

## Sub-phase 5C: ModeToggle + StreamEndIndicator + UnparseablePanel (COMPLETE)

### What Was Implemented

Sub-phase 5C -- the three remaining UI components: ModeToggle (pill-shaped Live/Scroll toggle), StreamEndIndicator (subtle badge when stdin closes), and UnparseablePanel (bottom panel for failed timestamp entries). Also extracted scroll-up detection to a pure function with unit tests.

### New Files

| File | Purpose |
|------|---------|
| `src/renderer/src/components/ModeToggle.tsx` | Pill-shaped toggle for Live/Scroll view modes using `.mode-toggle` CSS classes |
| `src/renderer/src/components/StreamEndIndicator.tsx` | Subtle badge with dot indicator and "Stream ended" text |
| `src/renderer/src/components/UnparseablePanel.tsx` | Bottom panel showing count badge and scrollable list of raw JSON strings |
| `src/renderer/src/scroll-utils.ts` | Pure function `isScrollingUp(lastTop, currentTop, threshold)` |
| `tests/unit/renderer/scroll-utils.test.ts` | 8 tests covering scroll-up detection with threshold logic |

### Modified Files

| File | Changes |
|------|---------|
| `src/renderer/src/App.tsx` | Replaced placeholder `<span>` with `<ModeToggle>`, replaced inline stream-ended `<span>` with `<StreamEndIndicator>`, replaced placeholder unparseable `<div>` with `<UnparseablePanel>` |
| `src/renderer/src/components/SwimLaneGrid.tsx` | Extracted scroll-up detection to use `isScrollingUp()` from `scroll-utils.ts` |

### Design Decisions

1. **ModeToggle uses `<button>` elements**: Two buttons ("Live" and "Scroll") inside a `.mode-toggle` container. Active mode button receives `.mode-toggle__option--active` class. Buttons use `type="button"` to prevent form submission.

2. **StreamEndIndicator has `visible` prop**: The component handles its own conditional rendering (returns `null` when not visible). This keeps the parent clean -- just pass `visible={streamEnded}` without wrapping in a conditional.

3. **UnparseablePanel uses index as key**: The entries list is append-only (capped at 1000) and items are never reordered or removed, so array index as key is safe and appropriate here.

4. **Scroll-up detection extracted**: The inline delta comparison in SwimLaneGrid was replaced with a call to `isScrollingUp()` from `scroll-utils.ts`. The function is a pure comparison (`delta > threshold`), making it trivially testable. The threshold constant (`SCROLL_UP_THRESHOLD_PX = 5`) remains in SwimLaneGrid as it is a component-level concern.

5. **Live mode scroll-to-bottom on mode change**: No new `useEffect` was added for mode changes. The existing `useEffect` in SwimLaneGrid keyed on `[version, mode]` already handles scrolling to bottom whenever mode becomes 'live', regardless of whether the trigger was a mode toggle click or a version increment.

### Acceptance Criteria Status

- [x] ModeToggle renders pill-shaped toggle with Live/Scroll options
- [x] Active mode button has `mode-toggle__option--active` class
- [x] Clicking Live mode scrolls to bottom (via existing useEffect on [version, mode])
- [x] Clicking Scroll mode freezes scroll position
- [x] Scrolling up auto-switches from Live to Scroll (via isScrollingUp in SwimLaneGrid)
- [x] StreamEndIndicator appears when stream ends
- [x] UnparseablePanel appears when there are unparseable entries, hidden when none
- [x] UnparseablePanel shows count badge and scrollable list of raw JSON
- [x] ErrorScreen shows for stream-error with error message (from 5A)
- [x] ErrorScreen shows for config-error with "Revert to defaults" button (from 5A)
- [x] "Revert to defaults" saves DEFAULT_APP_CONFIG and reloads (from 5A)
- [x] `npm test` passes: 180 tests (14 test files)
- [x] `npm run typecheck` passes: 0 errors

### Verification

- `npm test`: 180 tests pass (14 test files), including 8 new scroll-utils tests
- `npm run typecheck`: Clean (0 errors)
- No existing tests were modified, skipped, or removed

---

## Implementation Review Fixes (Iteration 1)

### MAJOR-1: Fixed missing `grid-template-rows` on `.swimlane-grid`
- **File**: `src/renderer/theme/components.css`
- Added `grid-template-rows: auto 1fr;` so header row auto-sizes and scroll container row fills remaining space.
- Replaced `flex: 1` (no-op in grid context) with `min-height: 0` on `.swimlane-scroll-container` so the grid `1fr` row properly constrains the child for scrolling.

### MAJOR-2: Removed unnecessary `as AppConfig` assertion
- **File**: `src/renderer/src/ErrorScreen.tsx`
- `DEFAULT_APP_CONFIG` is already typed as `AppConfig` in `types.ts`. Removed the redundant `as AppConfig` cast.
- Also removed the now-unused `AppConfig` type import.

### MINOR-1: Replaced inline style on loading screen with CSS class
- **File**: `src/renderer/src/App.tsx` + `src/renderer/theme/components.css`
- Added `.app-loading` class to `components.css` (flex centering).
- Replaced inline `style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}` with `className="app-main app-loading"`.

### MINOR-2: Added `.catch()` to `handleRevertConfig` promise chain
- **File**: `src/renderer/src/ErrorScreen.tsx`
- Added `.catch()` handler that logs the error via `console.error`. This is a last-resort error reporting path (config revert failure on an already-errored screen), so `console.error` is appropriate with an eslint-disable comment.

### MINOR-3: `void unparseableCount` pattern -- No change
- The existing `// WHY:` comment adequately explains the purpose. The pattern is a standard JS idiom for acknowledging a value.
- Rejected the `useReducer` suggestion as over-engineering for a single counter trigger.

### Post-Fix Verification
- `npm test`: 180 tests pass (14 test files)
- `npm run typecheck`: Clean (0 errors)
