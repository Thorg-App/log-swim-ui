# Phase 05 Sub-phase 5A: Implementation Summary

## What Was Implemented

Sub-phase 5A -- Core App Shell + State + IPC Wiring. All acceptance criteria met.

### New Files

| File | Purpose |
|------|---------|
| `src/renderer/src/timestamp-formatter.ts` | Pure function: `formatTimestamp(date, format, firstTimestamp)` for iso/local/relative |
| `src/renderer/src/ipc-converters.ts` | Pure function: `convertIpcToLogEntry(ipcLine, lanes)` -- IpcLogLine to LogEntry |
| `src/renderer/src/useAppInit.ts` | Hook: async init (loads config + CLI args, applies CSS, builds lanes, creates MasterList) |
| `src/renderer/src/useLogIngestion.ts` | Hook: IPC callbacks + LogBuffer + version counter + unparseable collection |
| `src/renderer/src/ErrorScreen.tsx` | Full-screen error component with revert-to-defaults for config errors |
| `tests/unit/renderer/timestamp-formatter.test.ts` | 8 tests covering iso, local, relative formats |
| `tests/unit/renderer/ipc-converters.test.ts` | 5 tests covering conversion, lane classification, field preservation |

### Modified Files

| File | Changes |
|------|---------|
| `src/core/types.ts` | ElectronApi push methods return `() => void`; added `ViewMode`, `AppErrorType` types |
| `src/preload/index.ts` | Each `on*` method stores handler wrapper and returns unsubscribe function |
| `vitest.config.ts` | Added `@renderer` path alias |
| `package.json` | Added `@tanstack/react-virtual` to dependencies |
| `src/renderer/src/App.tsx` | Replaced DesignReferencePage with real app shell (useAppInit + useLogIngestion + ErrorScreen) |
| `src/renderer/theme/components.css` | Added `.error-screen*` and `.swimlane-scroll-container` CSS classes |

### Design Decisions

1. **No explicit JSX.Element return types**: React 19 with `react-jsx` transform does not expose the `JSX` namespace globally. Function components use inferred return types, consistent with existing code (e.g., `DesignReferencePage`).

2. **ViewMode and AppErrorType in core/types.ts**: Placed in the shared types file (not renderer-only) because they are domain types that may be referenced across process boundaries in future phases.

3. **Unparseable entries tracking**: Uses `useRef<string[]>` with a separate `unparseableCount` state to trigger re-renders without copying the array on every push. Capped at `MAX_UNPARSEABLE_ENTRIES = 1000`.

4. **AppShell as a separate component within App.tsx**: Extracted into a separate function (not a separate file) because it needs access to the ready-state props from `useAppInit`. Keeps the component tree shallow for 5A.

5. **DesignReferencePage NOT deleted**: File preserved as dev reference per plan. Only the import was removed from App.tsx.

### Verification

- `npm test`: 145 tests pass (12 test files), including 13 new tests
- `npm run typecheck`: Clean (0 errors)
- No existing tests were modified, skipped, or removed

### What Is NOT Done (deferred to 5B/5C)

- SwimLaneGrid component (placeholder div in App.tsx)
- ModeToggle component (placeholder text in App.tsx)
- StreamEndIndicator as proper component (inline span used)
- UnparseablePanel component
- LaneHeader, LogRow, log-row-utils
- Scroll-up detection for auto mode switching
