# Plan Reviewer -- Private Context

## Review Date: 2026-03-01

## Key Findings

### Blocker: IPC Listener Cleanup

The most significant issue found during review. The preload API (`src/preload/index.ts`) registers IPC listeners with `ipcRenderer.on()` but provides no mechanism to remove them. React 18 strict mode in development double-mounts components, which would cause duplicate listener registrations. The recommended fix is to change the `ElectronApi` interface so that `onLogLine`, `onStreamEnd`, `onStreamError`, `onConfigError` return `() => void` (unsubscribe functions) instead of returning `void`.

This requires changes to:
- `src/core/types.ts` (ElectronApi interface)
- `src/preload/index.ts` (implementation)
- The plan's `useLogIngestion` hook design (useEffect cleanup)
- The plan's "Files NOT Modified" table (both files need to be moved to "Modified")

### Files Verified

| File | Status | Notes |
|------|--------|-------|
| `src/core/types.ts` | API correct | `IpcLogLine`, `LogEntry`, `AppConfig`, `LaneDefinition`, `createLaneDefinition`, `ElectronApi` -- all match plan usage |
| `src/core/master-list.ts` | API correct | `insert`, `insertBatch`, `get`, `length`, `entries` -- all match |
| `src/core/lane-classifier.ts` | API correct | `classify(rawJson, lanes)` returns index, `lanes.length` = unmatched -- correct |
| `src/core/log-buffer.ts` | API correct | Constructor takes `LogBufferConfig` (not just number) and `FlushCallback` -- plan Step 4 is correct |
| `src/preload/index.ts` | Needs modification | No listener removal support |
| `src/renderer/src/applyConfigToCSS.ts` | Compatible | Takes `PartialConfig`, `AppConfig` is structurally compatible |
| `src/renderer/theme/tokens.css` | All tokens present | All referenced tokens exist |
| `src/renderer/theme/components.css` | Most classes present | Missing: `.error-screen*`, `.swimlane-scroll-container` -- plan correctly adds these |
| `vitest.config.ts` | Missing `@renderer` alias | Only has `@core` |

### Type Compatibility Notes

- `applyConfigToCSS(config: PartialConfig)` accepts `AppConfig` structurally (AppConfig has required `colors` and `ui`, PartialConfig expects optional). No issue.
- `LogBuffer` constructor: `constructor(config: LogBufferConfig, onFlush: FlushCallback)` where `LogBufferConfig = { readonly flushIntervalMs: number }`. Plan can pass `{ flushIntervalMs: config.performance.flushIntervalMs }` or `config.performance` (which has extra `maxLogEntries` but TypeScript structural typing allows it).
- `DEFAULT_APP_CONFIG.colors.levels` has 6 levels. CSS tokens have 9. `applyConfigToCSS` maps all 9 but only applies those present in config. Non-issue for Phase 05.

### Pre-existing Issues Noted (Not Plan Bugs)

- `DEFAULT_APP_CONFIG` color values differ from CSS token defaults and from high-level spec. Callout carried from Phase 03/04. Phase 07 reconciliation.
- `DEFAULT_APP_CONFIG.ui.rowHeight = 28` but CSS `--row-height: 32px`. Config override via `applyConfigToCSS` will set it to 28px at runtime.

## Verdict Rationale

APPROVED WITH MINOR REVISIONS because:
1. The plan is architecturally sound and correctly uses all existing APIs
2. The IPC cleanup blocker is fixable with a well-understood pattern
3. All other issues are minor (alias config, LogBuffer cleanup, function location)
4. The sub-phase decomposition is good incremental delivery

PLAN_ITERATION is recommended specifically for the IPC cleanup mechanism since it affects the `ElectronApi` contract (a cross-boundary interface).
