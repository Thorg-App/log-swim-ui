---
id: iw1eeu0jh52ee6n1azb605el3
title: "Make sure we are able to cat the content of logs into the app"
status: done
deps: []
links: []
created_iso: 2026-03-01T13:02:21Z
status_updated_iso: 2026-03-01T14:18:00Z
type: task
priority: 0
assignee: nickolaykondratyev
---

Right now when I tried to cat  '/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/test_data/sample-logs/sample-logs-10-lines.jsonl' into `log-swim-ui` UI opened, but I didn't see any logs or columns.

Root cause and fix this issue so that we can actually see the logs per original spec

### References
- /home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/doc/ralph/log-swim-ui/log-swim-ui-high-level.md
- /home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/doc/starting_spec/start_spec.md

---

## Resolution

### Root Cause
**IPC Race Condition**: When `cat file.jsonl | log-swim-ui` is run, all stdin data arrives instantly and is buffered by the OS. On `did-finish-load`, the main process starts `IpcBridge` which reads all buffered stdin via readline and sends LOG_LINE + STREAM_END IPC messages immediately. However, the renderer's React app hasn't mounted yet — it needs two async IPC round-trips (`getConfig()`, `getCliArgs()`) before `useLogIngestion` registers its IPC listeners. All messages are sent and silently dropped before listeners exist.

### Fix
Added a **RENDERER_READY handshake**:
1. Renderer registers all IPC listeners in `useLogIngestion`, then calls `window.api.signalReady()`
2. Main process waits for `RENDERER_READY` IPC signal before starting `IpcBridge.start(process.stdin)`
3. 10-second safety timeout prevents infinite hang if renderer fails to signal
4. Double-invocation guard on `startBridge()` prevents race between timeout and signal

### Files Modified
- `src/core/types.ts` — Added `RENDERER_READY` to `IPC_CHANNELS`, `signalReady()` to `ElectronApi`
- `src/preload/index.ts` — Added `signalReady` implementation
- `src/main/index.ts` — Wrapped bridge start in `ipcMain.once(RENDERER_READY)` with timeout
- `src/renderer/src/useLogIngestion.ts` — Added `window.api.signalReady()` after listener registration
- `CLAUDE.md` — Updated to document RENDERER_READY handshake

### Tests
- 238 unit tests: PASS
- 14 E2E tests: PASS
- TypeScript typecheck: PASS