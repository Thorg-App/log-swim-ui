# Exploration Summary

## Problem
When `cat` pipes log content into the app, stdin closes but the app stays in "Live" mode. It should auto-switch to "Scroll" mode since no more data is coming.

## Key Files
- `src/renderer/src/useLogIngestion.ts` — manages `mode` state and `streamEnded` state
- `src/renderer/src/components/ModeToggle.tsx` — Live/Scroll toggle UI
- `src/renderer/src/components/StreamEndIndicator.tsx` — shows "Stream ended" badge
- `src/renderer/src/components/SwimLaneGrid.tsx` — auto-scroll in Live mode
- `src/main/ipc-bridge.ts` — sends STREAM_END IPC on stdin close
- `src/core/types.ts` — ViewMode type, IPC_CHANNELS

## Current Flow
1. StdinReader detects `close` event → IpcBridge sends `STREAM_END` IPC
2. useLogIngestion receives signal → calls `logBuffer.close()` + `setStreamEnded(true)`
3. StreamEndIndicator shows "Stream ended" badge
4. **Mode stays "Live"** — no auto-switch to "Scroll"

## Fix Location
`src/renderer/src/useLogIngestion.ts` lines 82-85:
```typescript
const unsubStreamEnd = window.api.onStreamEnd(() => {
  logBuffer.close()
  setStreamEnded(true)
  // MISSING: setMode('scroll')
})
```

## Test Coverage Needed
- E2E test in `tests/e2e/app.spec.ts` — stream-end section (line ~187) should verify mode switches to Scroll
- Existing test only checks StreamEndIndicator appears, not mode change
