# Plan Review -- Phase 05: UI Swimlane Layout, Rows & Modes

## Executive Summary

The plan is thorough, well-structured, and demonstrates solid understanding of the existing codebase APIs. The three sub-phase decomposition (5A: data pipeline, 5B: grid + rows, 5C: toolbar + panels) is a clean, incremental approach. There are two issues that need addressing before implementation: (1) IPC listener cleanup for React strict mode safety, and (2) a missing vitest path alias for renderer test files. The remaining items are minor adjustments that the IMPLEMENTOR can handle inline.

## Critical Issues (BLOCKERS)

### 1. IPC Listener Cleanup / React Strict Mode Double-Mount

- **Issue**: The preload API (`/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/preload/index.ts`) exposes `onLogLine`, `onStreamEnd`, `onStreamError`, `onConfigError` as register-only functions using `ipcRenderer.on()`. There is no corresponding `removeListener` or `off` function exposed. In React 18+ strict mode (dev), `useEffect` mount callbacks run twice. This means `useLogIngestion` will register duplicate IPC listeners on every dev-mode mount, causing double-processing of every log line.

- **Impact**: In dev mode, every log line will be processed twice (double-inserted into MasterList, double-counted in version, double-added to unparseable list). In production mode (no strict mode), this is not a problem, but dev mode is where we do all our work. This will produce confusing bugs during development and manual testing.

- **Recommendation**: The plan must include adding `off` / `removeListener` methods to the `ElectronApi` interface in `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/core/types.ts` and implementing them in `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/preload/index.ts`. The `useLogIngestion` hook must return a cleanup function from its `useEffect` that removes all IPC listeners. This also applies to `useAppInit` if it registers any listeners.

  Concrete additions needed:

  In `ElectronApi`:
  ```typescript
  offLogLine: (callback: (line: IpcLogLine) => void) => void
  offStreamEnd: (callback: () => void) => void
  offStreamError: (callback: (error: string) => void) => void
  offConfigError: (callback: (error: string) => void) => void
  ```

  In preload `index.ts`:
  ```typescript
  offLogLine: (callback) =>
    ipcRenderer.removeListener(IPC_CHANNELS.LOG_LINE, (_event, line) => callback(line)),
  ```

  **IMPORTANT CAVEAT**: `ipcRenderer.removeListener` requires the exact same function reference. Since we wrap the callback in `(_event, line) => callback(line)`, we need to store the wrapper. A cleaner approach is to have `onLogLine` return an unsubscribe function:

  ```typescript
  // In ElectronApi:
  onLogLine: (callback: (line: IpcLogLine) => void) => (() => void)
  ```

  ```typescript
  // In preload:
  onLogLine: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, line: IpcLogLine) => callback(line)
    ipcRenderer.on(IPC_CHANNELS.LOG_LINE, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.LOG_LINE, handler)
  },
  ```

  This is the standard pattern for IPC cleanup in Electron + React. Without this, the `useEffect` cleanup in hooks has no way to unregister listeners.

  **NOTE**: This change touches `src/core/types.ts` and `src/preload/index.ts` which the plan says are "Files NOT Modified." They must be added to the modified files list. Existing tests must still pass since this is an additive change (return type changes from `void` to `() => void`).

## Major Concerns

### 1. Missing `@renderer` Path Alias in vitest.config.ts

- **Concern**: The plan puts test files in `tests/unit/renderer/` that will import from `src/renderer/src/timestamp-formatter.ts`, `src/renderer/src/log-row-utils.ts`, and `src/renderer/src/scroll-utils.ts`. The vitest config (`/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/vitest.config.ts`) only has the `@core` alias, not `@renderer`.

- **Why**: Tests will fail to resolve imports if they use `@renderer/timestamp-formatter` paths. If they use relative paths (`../../../src/renderer/src/timestamp-formatter`), it works but is inconsistent with the project's alias convention.

- **Suggestion**: Add `'@renderer': resolve('src/renderer/src')` to the vitest resolve aliases, mirroring the electron-vite config. Add this to Step 1 of Sub-phase 5A:

  ```typescript
  // vitest.config.ts
  resolve: {
    alias: {
      '@core': resolve('src/core'),
      '@renderer': resolve('src/renderer/src')
    }
  }
  ```

### 2. LogBuffer Cleanup on Unmount

- **Concern**: The `useLogIngestion` hook creates a `LogBuffer` with a `setInterval` inside. If the component unmounts (or re-mounts in strict mode), the old `LogBuffer` timer keeps running. The plan does not mention calling `logBuffer.close()` in the `useEffect` cleanup function.

- **Why**: Leaking interval timers in React is a common source of "setState on unmounted component" warnings and memory leaks.

- **Suggestion**: The `useEffect` cleanup in `useLogIngestion` must call `logBuffer.close()`. Add this explicitly to Step 4 of Sub-phase 5A. The cleanup function should: (1) remove IPC listeners (per Critical Issue 1), (2) call `logBuffer.close()`.

### 3. Unmatched Lane Column Count: Potential Off-by-One

- **Concern**: The plan says `lanes.length + 1` for grid columns ("+1 for the implicit unmatched lane") in section 4.5. But `LaneClassifier.classify` already returns `lanes.length` as the unmatched index. This means the total column count is `lanes.length + 1` (indices 0 to lanes.length inclusive). The plan is correct here, but the `gridColumn: entry.laneIndex + 1` in section 4.6 is also correct (CSS grid columns are 1-indexed). This is a spot where an off-by-one is easy to introduce.

- **Why**: Off-by-one in grid column placement will put log entries in the wrong lane column.

- **Suggestion**: Add a named constant like `const totalLaneCount = lanes.length + 1` and use it consistently. Add a unit test that verifies the grid column calculation: `GIVEN laneIndex = lanes.length, WHEN computing CSS gridColumn, THEN it equals totalLaneCount`. Consider adding this test to `log-row-utils.test.ts`.

## Simplification Opportunities (PARETO)

### 1. Scroll-Up Detection: Threshold Function Extraction

- **Current approach**: Plan extracts `isScrollingUp` into a separate `src/renderer/src/scroll-utils.ts` file with its own test file.

- **Simpler alternative**: Inline the logic in `SwimLaneGrid.tsx`. It is a 3-line comparison: `return lastTop - currentTop > threshold`. A dedicated file and test file for a one-liner is over-engineering.

- **Value**: Eliminates one file and one test file. The scroll-up check is trivially obvious and self-documenting. If the logic ever becomes complex (debouncing, etc.), extract then.

- **Verdict**: This is a minor suggestion. The plan's approach is fine if the implementor prefers it, but it does NOT need to be extracted.

### 2. ErrorScreen `onRevertConfig` Prop

- **Current approach**: `ErrorScreen` takes `onRevertConfig?: () => void` as a prop.

- **Observation**: The revert logic is `window.api.saveConfig(DEFAULT_APP_CONFIG)` then `window.location.reload()`. This is entirely self-contained and could live inside `ErrorScreen` itself rather than being passed as a prop from the parent.

- **Verdict**: This is genuinely a matter of taste. The prop approach is slightly more testable. No change needed.

## Minor Suggestions

### 1. `convertIpcToLogEntry` Should Be a Named, Exported Pure Function

The plan shows `convertIpcToLogEntry` inline in section 4.1 but does not specify where it lives. Since `useLogIngestion` uses it and it involves `LaneClassifier.classify`, it should be in a dedicated file (e.g., `src/renderer/src/ipc-converters.ts`) or alongside `log-row-utils.ts`. This makes it unit-testable. The plan should explicitly state where this function goes and add at least one test for the `timestamp === 0` edge case.

### 2. `ViewTimestampFormat` Type -- Plan Reference

In Step 2 (timestamp-formatter.ts), the plan references `ViewTimestampFormat` but does not show the import. This type is already exported from `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/core/types.ts`. The implementor should use `import type { ViewTimestampFormat } from '@core/types'`. Just a note for clarity.

### 3. CSS Tokens Already Define `--row-height: 32px`

The `DEFAULT_APP_CONFIG` has `rowHeight: 28` but the CSS tokens have `--row-height: 32px`. Once `applyConfigToCSS(config)` runs, the CSS variable will be overridden to `28px`. This pre-existing discrepancy (already called out in Phase 03/04) means the virtualizer's `estimateSize` should use `config.ui.rowHeight` (28) NOT the CSS token value (32). The plan correctly passes `config.ui.rowHeight` to `SwimLaneGrid` as a prop, so this is handled. Just flagging for awareness.

### 4. `design-reference.css` Import Removal

The plan says the `DesignReferencePage` file is kept but the import is removed from `App.tsx`. The `design-reference.css` import should also be checked -- if it is imported in `DesignReferencePage.tsx`, it will tree-shake out when the component is no longer imported. If it is imported in `main.tsx` or `App.tsx`, it should be removed. Check and confirm.

### 5. `unparseableEntries` State Growth

The plan collects unparseable entries in `useState<string[]>`. Over a long session, this array could grow unbounded (no eviction). Consider adding a reasonable cap (e.g., 1000) to avoid memory issues. This is a minor concern for Phase 05 -- could be deferred.

## Strengths

1. **Correct API usage throughout**: The plan accurately references `MasterList.insertBatch`, `LaneClassifier.classify`, `LogBuffer` constructor signature, `createLaneDefinition`, and the `ElectronApi` shape. No API mismatches found.

2. **Clear data flow documentation**: The `Main Process -> Renderer Process` data flow diagram in section 2 is precise and matches the actual IPC bridge implementation in `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/main/ipc-bridge.ts` and preload in `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/preload/index.ts`.

3. **Version counter pattern**: Using a version counter to trigger React re-renders for a mutable `MasterList` is the correct and standard pattern for integrating mutable data sources with React virtualization. Well-documented in the plan.

4. **Pure function extraction for testability**: Extracting `formatTimestamp`, `getLevelCssClass`, and `getMessagePreview` as pure functions with dedicated test files is good SRP and testability practice.

5. **CSS custom property approach for dynamic lane count**: Using `--lane-count` CSS custom property instead of inline `gridTemplateColumns` is consistent with the design system approach. Good decision.

6. **Inline style justification**: The plan explicitly documents WHY inline styles are needed for virtualizer positioning (`@tanstack/virtual` requirement) and dynamic `gridColumn` (data-driven). This follows the project's "explicit" principle.

7. **Error handling table in section 4.7**: Comprehensive mapping of error sources to handling strategies. Matches the actual IPC bridge behavior.

8. **Sub-phase decomposition**: 5A proves data flow, 5B adds visuals, 5C completes UI. Each sub-phase has clear acceptance criteria and commit points.

## Verdict

- [ ] APPROVED
- [x] APPROVED WITH MINOR REVISIONS
- [ ] NEEDS REVISION
- [ ] REJECTED

### Required Revisions Before Implementation

1. **[BLOCKER]** Add IPC listener cleanup mechanism (return unsubscribe functions from `onLogLine`, `onStreamEnd`, `onStreamError`, `onConfigError`). Update `ElectronApi` in `types.ts` and implementation in `preload/index.ts`. Add these to the "Modified Files" table.

2. **[MAJOR]** Add `@renderer` path alias to `vitest.config.ts`.

3. **[MAJOR]** Add `logBuffer.close()` to `useLogIngestion` cleanup.

4. **[MINOR]** Specify the file location for `convertIpcToLogEntry` and add a unit test for the `timestamp === 0` edge case.

### PLAN_ITERATION Signal

**PLAN_ITERATION is NEEDED** for the IPC listener cleanup blocker (item 1). This is a cross-cutting change that affects `types.ts`, `preload/index.ts`, the hook design, and the "files not modified" assertion. The PLANNER should incorporate this into the plan before the IMPLEMENTOR proceeds.

Items 2-4 are straightforward enough that the IMPLEMENTOR could handle them inline, but item 1 requires architectural alignment.
