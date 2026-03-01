# Implementation: Auto-switch to Scroll mode on stream end

## What was done
When stdin closes (e.g., `cat file.log | log-swim-ui`), the app now auto-switches from "Live" mode to "Scroll" mode. Previously, it stayed in "Live" mode even though no more data was coming.

## Changes

### Code Change
- **`src/renderer/src/useLogIngestion.ts`**: Added `setMode('scroll')` to the `onStreamEnd` callback, so when the stream-end IPC signal arrives, the mode automatically switches.

### E2E Test
- **`tests/e2e/app.spec.ts`**: Added test "THEN mode switches to Scroll" in the "WHEN stream-end is signaled" describe block. Verifies that the active mode toggle option changes from "Live" to "Scroll" after `sendStreamEnd`.

## Test Results
- Unit tests: 264 passed (16 files)
- E2E tests: 15 passed (14 existing + 1 new)
