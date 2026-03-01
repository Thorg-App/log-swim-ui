# Implementation Review: RENDERER_READY Handshake

## Verdict: APPROVED with one IMPORTANT issue

---

## Summary

The implementation adds a `RENDERER_READY` IPC handshake to solve a race condition where `cat file.jsonl | log-swim-ui` loses all data. The root cause is correct: `did-finish-load` fires before React's `useEffect` hooks register IPC listeners, so all `LOG_LINE`/`STREAM_END` messages are silently dropped.

The fix is minimal, well-placed, and well-documented. The signal fires from the correct location (`useLogIngestion`'s `useEffect`, after all 4 listeners are registered). E2E tests are correctly excluded. All 238 unit tests, typecheck, and 14 E2E tests pass.

---

## Test Results

| Suite | Result |
|-------|--------|
| TypeScript typecheck | PASS |
| Vitest unit tests (238) | PASS |
| Build | PASS |
| Playwright E2E (14 tests) | PASS |

---

## IMPORTANT Issues

### 1. Double `startBridge()` invocation if timeout fires and RENDERER_READY arrives later

**File:** `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/main/index.ts` lines 118-130

**Description:** When the timeout fires, it calls `startBridge()`. However, the `ipcMain.once(RENDERER_READY)` listener is still registered. If the renderer eventually sends `RENDERER_READY` (e.g. it was slow but not dead), `startBridge()` will be called a second time. This creates a second `IpcBridge` and calls `readline.createInterface()` on the same `process.stdin` a second time. Two readline interfaces reading from the same stream will interleave lines unpredictably, likely producing corrupted/duplicated data.

The scenario is unlikely in practice (10s is generous), but the code has no guard against it.

**Suggested fix:** Add a `bridgeStarted` flag:

```typescript
let bridgeStarted = false

const timeoutId = setTimeout(() => {
  console.error(
    `[log-swim-ui] renderer did not signal ready within ${RENDERER_READY_TIMEOUT_MS}ms, starting bridge anyway`
  )
  startBridge()
}, RENDERER_READY_TIMEOUT_MS)

ipcMain.once(IPC_CHANNELS.RENDERER_READY, () => {
  clearTimeout(timeoutId)
  startBridge()
})

function startBridge(): void {
  if (bridgeStarted) return
  bridgeStarted = true

  // ... rest of startBridge
}
```

Alternatively, call `ipcMain.removeAllListeners(IPC_CHANNELS.RENDERER_READY)` inside the timeout handler before calling `startBridge()`. The flag approach is simpler and more defensive.

---

## Suggestions

### 1. CLAUDE.md should be updated to reflect the RENDERER_READY handshake

**File:** `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/CLAUDE.md` line 198

The `src/main/index.ts` description should mention the RENDERER_READY handshake since it is now a key part of the startup orchestration:

```
# - index.ts: App startup orchestration (TTY check, CLI parse, config load, IPC handlers, RENDERER_READY handshake, bridge start, E2E test seam)
```

The `useLogIngestion.ts` description at line 212 could also mention the handshake signal:

```
# - useLogIngestion.ts: IPC wiring + log state (version, stream state, unparseable, view mode); signals RENDERER_READY after listener registration; accepts lanesRef + configRef for stable IPC callbacks
```

And the `types.ts` description at line 235 should include `RENDERER_READY` alongside `RESET_CONFIG`:

```
# - types.ts: LogEntry, LaneDefinition, AppConfig, ParsedLine, IpcLogLine, IPC_CHANNELS (incl. RESET_CONFIG, RENDERER_READY), ElectronApi (incl. resetConfig, signalReady), CliArgsResult, KNOWN_LOG_LEVELS, ViewMode, AppErrorType, CONFIG_CONSTRAINTS, createLaneDefinition
```

### 2. React StrictMode double-mount is not an issue, but worth noting

The app does NOT use `<StrictMode>` (verified in `src/renderer/src/main.tsx`), so the `useEffect` in `useLogIngestion` runs exactly once. If StrictMode were ever added, `signalReady()` would fire twice. Since main uses `ipcMain.once()`, the second signal would be harmless (no listener). This is fine as-is, no change needed. The WHY comment in `useLogIngestion` could optionally note this.

### 3. E2E test `CONFIG_ERROR` delivery in E2E mode is now immediate on `did-finish-load`

**File:** `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/main/index.ts` lines 102-108

Previously, `CONFIG_ERROR` was sent unconditionally after `did-finish-load` for both E2E and production modes. Now in production mode it is delayed until `RENDERER_READY`. This is actually **correct** -- the config-error listener is registered in `useLogIngestion`, so it would have been subject to the same race condition as `LOG_LINE`. Good catch by the implementor to move it inside `startBridge()`.

For E2E mode, `CONFIG_ERROR` is still sent on `did-finish-load` without waiting for `RENDERER_READY`. This works because E2E tests wait for `.swimlane-grid` before interacting, and in a config-error scenario the `ErrorScreen` would render instead. No issue here.

---

## Correctness Analysis

| Concern | Assessment |
|---------|-----------|
| Signal placement | Correct -- after all 4 `on*` listeners registered in `useLogIngestion`'s `useEffect` |
| `ipcMain.once` vs `ipcMain.on` | Correct -- `once` auto-removes, preventing stale listeners |
| `ipcRenderer.send` vs `invoke` | Correct -- fire-and-forget, no response expected |
| E2E exclusion | Correct -- E2E has implicit handshake via `waitForSelector('.swimlane-grid')` |
| Timeout value (10s) | Appropriate -- generous enough for slow cold starts, short enough to detect failures |
| `ElectronApi` contract | Correct -- `signalReady` added to interface, preload, and used in renderer |
| `electron-api.d.ts` | Does not need changes -- imports `ElectronApi` type from `types.ts` |
| Config error delivery timing | Correct -- delayed until renderer is ready in production, immediate in E2E |
| No tests removed | Confirmed -- all 238 unit tests and 14 E2E tests present and passing |

---

## Architecture Compliance

The implementation follows project standards:
- WHY comments on all non-obvious decisions
- `IPC_CHANNELS` remains the single source of truth for channel names (DRY)
- `ElectronApi` interface in `src/core/types.ts` enforces the contract across process boundaries
- No cross-boundary import violations
- Simple, minimal change with no over-engineering

---

## Final Verdict

```
STATUS: APPROVED
BLOCKING ISSUES: 0
IMPORTANT ISSUES: 1 (double startBridge guard)
SUGGESTIONS: 2 (CLAUDE.md updates, StrictMode note)
```

The one IMPORTANT issue (double `startBridge()` on timeout + late RENDERER_READY) should be addressed before merge. The fix is a one-line guard. The CLAUDE.md updates are nice-to-have and can be done in the same commit.
