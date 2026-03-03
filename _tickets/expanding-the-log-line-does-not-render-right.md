---
closed_iso: 2026-03-02T20:06:13Z
id: hvhuhemsr252gdrim2qttq1ch
title: "expanding the log line does not render right"
status: closed
deps: []
links: []
created_iso: 2026-03-01T14:37:26Z
status_updated_iso: 2026-03-02T20:06:13Z
type: task
priority: 0
assignee: nickolaykondratyev
---

Expanding the log lines when we click on a log line renders incorrectly. The log line appears to be overlayed over other log lines. While it should render as expansion of the log lines we clicked on and move ALL the other rows in our visual table to account for this.

## Resolution

**Root cause:** `SwimLaneGrid.tsx` set `height: virtualRow.size` (a fixed pixel value) on the virtual row wrapper div. This constrained the wrapper to its estimated height, so `@tanstack/react-virtual`'s `ResizeObserver` (attached via `ref={virtualizer.measureElement}`) always saw the wrapper at the fixed size — never the actual expanded content height. Subsequent rows stayed at stale `translateY` positions, causing the visual overlay.

**Fix (commit `81da0d5`):**
- Removed `height: virtualRow.size` from the wrapper inline style (`SwimLaneGrid.tsx`). Without a fixed height, the wrapper grows to match content; the `ResizeObserver` fires with the actual height; the virtualizer repositions subsequent rows correctly.
- Updated existing collapse E2E test: replaced `dispatchEvent('click')` with `.click()` (the workaround was only needed because overlapping rows triggered Playwright's actionability check).
- Added new E2E test: `THEN expanding a row pushes subsequent rows down without overlaying them` — verifies via bounding box comparison that subsequent rows are not overlaid.

**Test results:** 274 unit tests pass, 22 E2E tests pass (1 new).

