# Phase 05: UI -- Swimlane Layout, Rows & Modes -- Implementation Review

## Summary

Phase 05 implements the core renderer UI: CSS Grid swimlane layout with virtualized scrolling via `@tanstack/react-virtual`, log row rendering with level colorization and expand/collapse, lane headers, Live/Scroll mode toggle, stream-ended indicator, unparseable panel, and error screens. The implementation closely follows the plan across all three sub-phases (5A, 5B, 5C).

**Overall assessment**: Solid implementation with clean code, good test coverage of pure functions, and correct architectural decisions. All 180 tests pass, typecheck is clean, and no existing tests were modified or removed. There is **one MAJOR layout issue** (missing `grid-template-rows`) that will prevent the scroll container from working correctly, one MAJOR issue with an unsafe type assertion, and several minor items. **Implementation iteration is needed** to fix the MAJOR issues before merging.

---

## Verification Results

- `npm test`: 180 tests pass (14 test files) -- all green
- `npm run typecheck`: 0 errors -- clean
- No `sanity_check.sh` present
- No existing tests were modified, skipped, or removed
- `DesignReferencePage.tsx` preserved (not deleted), import removed from `App.tsx`

---

## Acceptance Criteria Checklist

| Criterion | Status | Notes |
|-----------|--------|-------|
| Swimlane grid renders with correct columns | BLOCKED | Grid columns are correct, but missing `grid-template-rows: auto 1fr` will prevent scroll container from sizing properly (see MAJOR-1) |
| Log rows in correct lane column | PASS | `getGridColumn()` correctly converts 0-based to 1-based, tested |
| Log row left border colored by level | PASS | `getLevelCssClass()` handles all standard levels + unrecognized, CSS classes defined |
| Timestamp in configured format | PASS | `formatTimestamp()` handles iso/local/relative, well tested |
| Click expands to show full JSON | PASS | `expandedRowIndex` state + `LogRow` conditional rendering |
| Click collapses expanded row | PASS | Toggle logic in `handleToggleExpand` |
| Virtualization (~50-100 DOM nodes) | PASS | `@tanstack/react-virtual` with overscan=20 |
| Live mode auto-scrolls | BLOCKED | useEffect on [version, mode] correct, but depends on MAJOR-1 fix |
| Scroll up switches to Scroll mode | PASS | `isScrollingUp()` extracted, tested, threshold=5px |
| Mode toggle switches Live/Scroll | PASS | `ModeToggle` component with proper CSS classes |
| Stream-ended indicator | PASS | `StreamEndIndicator` with `visible` prop |
| Unparseable panel appears/hidden | PASS | Conditional rendering, capped at 1000 entries |
| Error states display correctly | PASS | `ErrorScreen` handles stream-error, config-error, no-stdin |
| Revert to defaults button | PARTIAL | Works but missing error handling (see MINOR-2), unnecessary `as AppConfig` (see MAJOR-2) |
| Lane headers with truncated regex + tooltip | PASS | `title` attribute for native tooltip, CSS ellipsis |
| Invalid regex lanes show error state | PASS | `lane-header--error` class applied |
| Design tokens applied | PASS | All CSS uses `var(--token)` from `tokens.css` |
| Tests pass | PASS | 180 tests, 14 files |

---

## MAJOR Issues

### MAJOR-1: Missing `grid-template-rows: auto 1fr` on `.swimlane-grid` -- Layout Bug

**File**: `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/renderer/theme/components.css` (lines 163-168)

The `.swimlane-grid` CSS class defines `display: grid` and `height: 100%`, but does not define `grid-template-rows`. The grid has two implicit rows:
1. Row 1: Lane header cells (N+1 `<div>` elements)
2. Row 2: `.swimlane-scroll-container` (spans all columns via `grid-column: 1 / -1`)

Without `grid-template-rows: auto 1fr`, both rows default to `auto` sizing. The scroll container row will expand to its content height (the full virtual spacer, potentially thousands of pixels). Since the scroll container has `overflow-y: auto`, it needs a **definite, constrained height** to enable scrolling. With `auto` row sizing, the scroll container expands to fit all content, meaning no scrollbar appears and the content overflows the grid (clipped by `overflow: hidden` on the grid).

Additionally, `.swimlane-scroll-container` has `flex: 1` which is a **flexbox** property that has no effect in a CSS Grid context.

**Fix**:
```css
.swimlane-grid {
  display: grid;
  height: 100%;
  overflow: hidden;
  grid-template-rows: auto 1fr; /* headers auto-size, scroll container fills remaining space */
  /* grid-template-columns set dynamically based on lane count */
}
```

And remove `flex: 1` from `.swimlane-scroll-container` (it has no effect in a grid child context; the `1fr` row handles the sizing).

### MAJOR-2: Unnecessary `as AppConfig` Type Assertion in ErrorScreen

**File**: `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/renderer/src/ErrorScreen.tsx` (line 25)

```typescript
.saveConfig(DEFAULT_APP_CONFIG as AppConfig)
```

`DEFAULT_APP_CONFIG` is already declared as `const DEFAULT_APP_CONFIG: AppConfig = { ... }` in `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/core/types.ts` (line 143). The `as AppConfig` assertion is unnecessary and violates the project standard: "No type assertions (`as`) unless justified with a `// WHY:` comment explaining why it is safe."

If the assertion IS needed due to some type widening/narrowing issue, add the `// WHY:` comment. If not, remove the assertion.

**Fix**:
```typescript
.saveConfig(DEFAULT_APP_CONFIG)
```

---

## MINOR Issues

### MINOR-1: Inline Style on Loading Screen

**File**: `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/renderer/src/App.tsx` (line 19)

```tsx
<div className="app-main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
```

The project standard says "No inline styles except where justified (virtualization positioning, gridColumn)." A loading screen centering style should use a CSS class. This is a minor violation but worth fixing for consistency, especially since the project already has the `.error-screen` class with similar centering that could serve as a pattern.

**Suggested fix**: Add a `.app-loading` class to `components.css`:
```css
.app-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}
```

### MINOR-2: Missing Error Handling in `handleRevertConfig`

**File**: `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/renderer/src/ErrorScreen.tsx` (lines 23-27)

```typescript
function handleRevertConfig(): void {
    void window.api
      .saveConfig(DEFAULT_APP_CONFIG as AppConfig)
      .then(() => { window.location.reload() })
}
```

There is no `.catch()` handler. If `saveConfig` fails (e.g., disk full, permissions error), the promise rejection is silently swallowed. The `void` suppresses the TypeScript floating-promise lint but does not handle the error. Per CLAUDE.md: "Never swallow errors silently."

**Suggested fix**:
```typescript
function handleRevertConfig(): void {
    void window.api
      .saveConfig(DEFAULT_APP_CONFIG)
      .then(() => { window.location.reload() })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : 'Unknown error'
        // eslint-disable-next-line no-console -- last-resort error reporting on config revert failure
        console.error(`Failed to revert config: ${msg}`)
      })
}
```

### MINOR-3: `void unparseableCount` Pattern is Non-Obvious

**File**: `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/renderer/src/useLogIngestion.ts` (lines 84-86)

```typescript
// WHY: unparseableCount triggers re-reads of unparseableRef.current
// This avoids making the full array part of state (which would copy on every push)
void unparseableCount
```

While the `// WHY:` comment explains the intent, `void unparseableCount` is a very unusual pattern that will confuse readers. The purpose is to "use" the `unparseableCount` state variable so React re-renders when it changes, even though the returned value comes from the ref. This is a clever optimization to avoid copying the full array into state on every push, but the mechanism is non-obvious.

**Suggestion**: Consider adding an explicit `// eslint-disable-next-line @typescript-eslint/no-unused-expressions` to make it clear this is intentional, or rename to make the intent clearer. Alternatively, use a `useReducer` with a counter to make the re-render trigger more explicit:

```typescript
const [, forceUpdate] = useReducer((c: number) => c + 1, 0)
```

Then in the `onLogLine` callback, call `forceUpdate()` instead of `setUnparseableCount(...)`.

---

## Suggestions

### SUGGESTION-1: Accessibility -- Clickable Log Rows Need Keyboard Support

**File**: `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/renderer/src/components/LogRow.tsx` (line 47)

The log row `<div>` uses `onClick` but has no keyboard support (`role="button"`, `tabIndex={0}`, `onKeyDown`). This means keyboard-only users cannot expand/collapse rows. Consider adding basic keyboard accessibility in a follow-up phase.

### SUGGESTION-2: `log-row-grid` CSS Class Has No Definition

**File**: `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/renderer/src/components/LogRow.tsx` (line 39)

The `log-row-grid` class name is used on the outer `<div>` of `LogRow`, but there is no corresponding CSS rule in `components.css`. The grid styles are applied via inline `style` (justified by the WHY comment), so the class is purely semantic. This is fine for now, but if the class is intended for future CSS hooks or DevTools identification, consider documenting that intent. Otherwise, consider removing the unused class name.

### SUGGESTION-3: Consider Extracting `AppShell` to Its Own File

**File**: `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/renderer/src/App.tsx`

`AppShell` is defined in the same file as `App`. While acceptable for now (two components, moderate complexity), as the app grows, extracting `AppShell` to its own file would improve SRP and make the component tree easier to navigate.

---

## Documentation Updates Needed

None identified. The CLAUDE.md project structure section accurately reflects the new files. The file locations match the documented structure.

---

## Verdict

**Implementation iteration is needed.** The MAJOR-1 layout bug (missing `grid-template-rows: auto 1fr`) will prevent the scroll container from working correctly, which blocks the core functionality of the swimlane grid. MAJOR-2 is a type assertion that violates project standards and should be removed. The MINOR items are worth fixing but are not blockers.

After fixing MAJOR-1 and MAJOR-2, the implementation is ready for merge.
