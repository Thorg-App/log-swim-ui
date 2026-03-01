---
id: rpi2mmtxdkktn9k0u6yzggfel
title: "When we have cat some log content into the app we should show scroll as pipe is over"
status: done
deps: []
links: []
created_iso: 2026-03-01T15:36:49Z
status_updated_iso: 2026-03-01T15:37:04Z
type: task
priority: 0
assignee: nickolaykondratyev
---

Right now we when we have catted some log content into the app we should show scroll instead of live, right now we show live. We should show scroll as the pipe has ended from cat so we should have proper pipe end detection.

## Resolution

**Fixed.** Added `setMode('scroll')` to the `onStreamEnd` callback in `useLogIngestion.ts`. When stdin closes (e.g., from `cat file.log | log-swim-ui`), the app now automatically switches from "Live" to "Scroll" mode.

### Changes
- `src/renderer/src/useLogIngestion.ts` — one line added in `onStreamEnd` callback
- `tests/e2e/app.spec.ts` — new E2E test verifying mode switches to Scroll on stream end
- `CLAUDE.md` — updated docs (E2E count 14→15, noted auto-scroll behavior)

### Tests
- 264 unit tests pass
- 15 E2E tests pass (1 new)
