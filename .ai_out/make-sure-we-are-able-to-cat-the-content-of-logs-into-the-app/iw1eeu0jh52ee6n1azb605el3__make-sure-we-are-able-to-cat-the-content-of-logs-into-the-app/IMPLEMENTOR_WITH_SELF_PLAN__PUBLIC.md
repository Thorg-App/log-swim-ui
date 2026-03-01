# IMPLEMENTOR_WITH_SELF_PLAN -- PUBLIC Summary

## Completed: Fix IPC Race Condition with RENDERER_READY Handshake

### Problem

When piping data via `cat file.jsonl | log-swim-ui`, the main process reads all stdin and sends IPC messages (LOG_LINE, STREAM_END) before the renderer's React useEffect hooks register their IPC listeners. All data is silently lost.

### Root Cause

1. `did-finish-load` fires when HTML/JS loads, but React effects run asynchronously later
2. `useAppInit` performs 2 async IPC round-trips (`getConfig`, `getCliArgs`) before mounting `AppShell`
3. `useLogIngestion` registers listeners only after `AppShell` mounts
4. By that time, `IpcBridge` has already sent all data and STREAM_END

### Fix: RENDERER_READY Handshake

The renderer signals the main process after ALL IPC listeners are registered. Main waits for this signal before starting stdin ingestion.

### What was done

- Added `RENDERER_READY` IPC channel to `IPC_CHANNELS` constant
- Added `signalReady: () => void` to `ElectronApi` interface
- Added `signalReady` implementation in preload bridge (`ipcRenderer.send`)
- Main process now waits for `RENDERER_READY` signal before starting `IpcBridge`
  - E2E mode is excluded (has its own implicit handshake via `waitForSelector`)
  - 10-second safety timeout prevents infinite hang if renderer fails to signal
- Renderer calls `window.api.signalReady()` after all 4 IPC listeners are registered in `useLogIngestion`

### Files modified

| File | Change |
|------|--------|
| `src/core/types.ts` | Added `RENDERER_READY` to `IPC_CHANNELS`, added `signalReady` to `ElectronApi` |
| `src/preload/index.ts` | Added `signalReady` implementation using `ipcRenderer.send` |
| `src/main/index.ts` | Wrapped bridge start in `ipcMain.once(RENDERER_READY)` with 10s timeout |
| `src/renderer/src/useLogIngestion.ts` | Added `window.api.signalReady()` call after all listeners registered |

### Tests

| Test Suite | Result |
|------------|--------|
| TypeScript typecheck | PASS |
| Vitest unit tests | PASS |
| Build | PASS |
| Playwright E2E (14 tests) | PASS |

### Design Decisions

1. **Signal placement**: `signalReady()` is called inside `useLogIngestion`'s `useEffect`, after all 4 `window.api.on*()` calls. This is the only correct location -- earlier (e.g., `AppShell` mount) would still race.

2. **E2E exclusion**: E2E tests skip the handshake entirely (`isE2eTest` early return). They inject data after `waitForSelector('.swimlane-grid')`, which implicitly guarantees listeners are registered.

3. **Safety timeout**: 10-second timeout on main side. If renderer fails to signal, the bridge starts anyway with a console.error warning. This prevents silent hangs.

4. **No `electron-api.d.ts` change needed**: The declaration file imports `ElectronApi` from `types.ts`, so adding `signalReady` to the interface there is sufficient.
