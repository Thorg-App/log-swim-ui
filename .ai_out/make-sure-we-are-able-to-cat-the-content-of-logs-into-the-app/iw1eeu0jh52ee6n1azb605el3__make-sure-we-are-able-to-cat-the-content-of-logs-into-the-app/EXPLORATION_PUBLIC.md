# EXPLORATION: cat logs into log-swim-ui shows no data

## Issue
User runs `cat sample-logs-10-lines.jsonl | log-swim-ui [args]` → UI opens but no logs or columns visible.

## Root Cause: IPC Race Condition

**Timing sequence (the bug):**

1. `did-finish-load` fires in main process
2. Main starts `IpcBridge.start(process.stdin)` → readline reads ALL buffered stdin data immediately
3. For each line: `webContents.send(IPC_CHANNELS.LOG_LINE, ipcLine)` — sent immediately
4. `webContents.send(IPC_CHANNELS.STREAM_END)` — sent immediately
5. **Meanwhile in renderer**: `useAppInit()` is doing async IPC calls (`getConfig()`, `getCliArgs()`)
6. After async calls resolve → React renders `AppShell` → `useLogIngestion` registers IPC listeners
7. **All LOG_LINE and STREAM_END messages were already sent in step 3-4 → LOST**

**Why this only affects small/fast stdin (like `cat`):**
- `cat` dumps all data and closes immediately → all data in stdin buffer before `did-finish-load`
- readline reads entire buffer synchronously → all IPC messages sent before React listener registration
- For streaming sources (like `kubectl logs`), data continues arriving after listeners are ready, so most data is captured

## Key Files

| File | Role |
|------|------|
| `src/main/index.ts:97-114` | `did-finish-load` handler starts IpcBridge |
| `src/main/ipc-bridge.ts:54-60` | `start()` creates readline on stdin |
| `src/core/stdin-reader.ts:31-51` | readline reads from Readable stream |
| `src/renderer/src/useAppInit.ts:40-43` | Async IPC calls (`getConfig`, `getCliArgs`) create timing gap |
| `src/renderer/src/useLogIngestion.ts:59-105` | IPC listener registration (happens AFTER useAppInit resolves) |
| `src/preload/index.ts:9-13` | `onLogLine` registers listener lazily (factory pattern) |

## Data Flow (normal path)

```
stdin → StdinReader (readline) → IpcBridge.handleLine()
  → JsonParser.parse() → TimestampDetector → webContents.send(LOG_LINE)
  → preload bridge → ipcRenderer.on(LOG_LINE) → useLogIngestion callback
  → convertIpcToLogEntry() → LogBuffer.push()
  → [200ms flush] → MasterList.insertBatch() → version++ → React re-render
```

## Fix: RENDERER_READY Handshake

Add a `RENDERER_READY` IPC channel. Main process waits for this signal before starting IpcBridge. Renderer sends this signal after `useLogIngestion` registers all IPC listeners.

### Files to modify
1. `src/core/types.ts` — Add `RENDERER_READY` to `IPC_CHANNELS`, add `signalReady()` to `ElectronApi`
2. `src/preload/index.ts` — Implement `signalReady` via `ipcRenderer.send()`
3. `src/main/index.ts` — Wait for `RENDERER_READY` before starting IpcBridge and sending CONFIG_ERROR
4. `src/renderer/src/useLogIngestion.ts` — Call `window.api.signalReady()` after registering listeners
5. `src/preload/electron-api.d.ts` — Update type declaration

### E2E Tests
E2E tests (`E2E_TEST=1`) skip IpcBridge entirely. They inject data via `webContents.send()` AFTER waiting for `.swimlane-grid` to be visible (React has mounted, listeners are registered). No E2E changes needed.

## Sample Log File
`test_data/sample-logs/sample-logs-10-lines.jsonl`:
- Field `"level"` → "info", "debug"
- Field `"timestamp"` → ISO8601 (`"2026-03-01T00:00:24.239303875Z"`)
- Correct invocation: `cat file.jsonl | log-swim-ui --key-level level --key-timestamp timestamp`
