# Root Cause Review -- PUBLIC Summary

## Overall Assessment: VALIDATED -- Root Cause Confirmed

**Verdict: `APPROVE`** -- The proposed root cause is accurate and the proposed fix is sound.

---

## Root Cause: IPC Race Condition -- VALIDATED

### Evidence Chain (verified by reading source code)

| Step | File | What Happens |
|------|------|-------------|
| 1 | `src/main/index.ts:97` | `did-finish-load` fires, triggers `IpcBridge.start(process.stdin)` |
| 2 | `src/core/stdin-reader.ts:32-34` | `readline.createInterface` reads all buffered stdin (from `cat`) immediately |
| 3 | `src/main/ipc-bridge.ts:112,116` | `webContents.send()` dispatches LOG_LINE x10 + STREAM_END to renderer |
| 4 | `src/preload/index.ts:9-12` | No buffering -- `ipcRenderer.on()` not yet called -- **messages dropped** |
| 5 | `src/renderer/src/useAppInit.ts:40-43` | Two async IPC round-trips (`getConfig` + `getCliArgs`) still in flight |
| 6 | `src/renderer/src/App.tsx:25-33` | Renders "Loading..." div; `<AppShell>` not mounted yet |
| 7 | `src/renderer/src/useLogIngestion.ts:68` | `window.api.onLogLine(...)` finally registered -- **too late** |

### Why E2E Tests Pass (Further Confirming the Race)

E2E tests use `await page.waitForSelector('.swimlane-grid')` before injecting data (`tests/e2e/helpers/electron-app.ts:65`). The `.swimlane-grid` selector only appears after `<AppShell>` mounts and `useLogIngestion` listeners are active. This is an **implicit handshake** that the production stdin path does not have.

### Buffering/Queuing Check: None Found

- **IpcBridge**: Direct `webContents.send()`, no outbound queue
- **Preload bridge**: Thin wrapper, no message buffering or replay
- **LogBuffer**: Buffers entries *after* renderer receives them, does not help with the IPC gap
- **Electron IPC**: `webContents.send()` silently drops messages with no registered listener

---

## Strengths of the Root Cause Analysis

1. **Precise timing sequence** -- correctly identified the 2 async IPC round-trips in `useAppInit` as the critical delay
2. **Correctly identified that `did-finish-load` does not mean React effects have run** -- a subtle but crucial Electron/React timing distinction
3. **Identified the `cat` behavior** -- `cat` completes before Electron even starts, so all data is pre-buffered in the kernel pipe

---

## Proposed Fix Assessment: RENDERER_READY Handshake

### Verdict: APPROVED

The fix is simple, explicit, and directly addresses the root cause.

### Implementation Requirements

| Requirement | Details |
|-------------|---------|
| New IPC channel | `RENDERER_READY` in `IPC_CHANNELS` constant |
| Renderer signal | Sent from inside `useLogIngestion`'s `useEffect`, **after** `window.api.onLogLine()` is registered |
| Main wait | Replace `did-finish-load` direct bridge start with: wait for both `did-finish-load` AND `RENDERER_READY` |
| Preload/ElectronApi | Add `signalReady: () => void` to `ElectronApi` interface and preload bridge |

### **[CRITICAL]** Signal must fire from the correct location

- **Issue:** The signal MUST be sent from inside `useLogIngestion`'s `useEffect` (after listeners are registered), NOT from `useAppInit` or `AppShell`'s mount.
- **Impact:** If signaled too early (e.g., on `AppShell` mount but before `useEffect` fires), the same race can still occur.
- **Recommendation:** Place `window.api.signalReady()` as the last line inside `useLogIngestion`'s `useEffect`, after all `window.api.on*()` calls.

### **[SUGGESTION]** Add a safety timeout on main side

- **Issue:** If the renderer crashes or fails to signal, main will wait forever with stdin data buffered.
- **Impact:** App hangs silently on renderer init failure.
- **Recommendation:** Add a 10-second timeout. If `RENDERER_READY` is not received, log a warning and start the bridge anyway (data may be lost, but the app does not hang indefinitely).

### **[SUGGESTION]** E2E mode does not need the handshake

- **Issue:** E2E mode skips `IpcBridge` entirely (`isE2eTest` guard at `src/main/index.ts:105`).
- **Impact:** No functional issue, but the renderer will send `RENDERER_READY` with no listener.
- **Recommendation:** Renderer sends signal unconditionally (harmless). Main only waits for it when `!isE2eTest`.

---

## Missing Perspectives: None Critical

The analysis is thorough. One minor observation: if the app is later extended to support re-openable windows or hot-reload in dev mode, the handshake pattern will need to be re-evaluated. But that is a future concern, not a current gap.

---

## Final Verdict

```
STATUS: VALIDATED
FIX:    APPROVED (with critical placement note above)
```

The root cause is an IPC race condition between `IpcBridge.start()` (triggered by `did-finish-load`) and `useLogIngestion` listener registration (delayed by `useAppInit`'s two async IPC round-trips). The RENDERER_READY handshake fix is the correct, minimal solution.
