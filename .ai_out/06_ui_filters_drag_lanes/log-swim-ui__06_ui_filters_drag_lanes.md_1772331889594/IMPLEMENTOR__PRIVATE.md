# Phase 6E -- Implementor Private State

## Completed
- Phase 6A: Core Filter Types + Logic + Unit Tests
- Phase 6B: State Management Refactor (Mutable Lanes + Filter State)
- Phase 6C: FilterBar, FilterChip, LaneAddInput UI Components + Filter Integration
- Phase 6D: Draggable Lane Reordering (HTML5 DnD)
- Phase 6E: E2E Tests with Playwright (Electron integration)

## Files Created in 6E
- `tests/e2e/app.spec.ts` -- 11 E2E test cases
- `tests/e2e/helpers/electron-app.ts` -- Launch, IPC injection, and test data helpers
- `tests/e2e/fixtures/sample-logs.jsonl` -- Test fixture data (10 JSON log lines)

## Files Modified in 6E
- `src/main/index.ts` -- Added `isE2eTest` flag, `extractAppArgs()`, offscreen BrowserWindow, skip TTY check, skip IpcBridge in E2E
- `playwright.config.ts` -- Configured for Electron (serial workers, no browser projects)

## Key Implementation Notes

### Headless Electron Resolution
- Environment: Debian 12 (bookworm), no X display, no Xvfb, no sudo
- Chromium flags: `--no-sandbox --disable-gpu --enable-features=UseOzonePlatform --ozone-platform=headless`
- Required: `BrowserWindow({ show: false, webPreferences: { offscreen: true } })` -- without `offscreen: true`, Playwright's `firstWindow()` times out because CDP window target events don't fire on headless ozone
- These are ONLY active when `E2E_TEST=1` env is set

### Playwright Electron argv Issue
- When Playwright launches Electron, it prepends `--inspect=0` and `--remote-debugging-port=0`
- Playwright's loader (`-r loader.js`) splices these from `process.argv` via `process.argv.splice(1, process.argv.indexOf("--remote-debugging-port=0"))`
- But Chromium flags and the app entry path remain in `process.argv`
- The `extractAppArgs()` function finds the first known app flag (`--key-level`, `--key-timestamp`, or `--lanes`) and takes everything from that point, ignoring Chromium flags and the app path

### Expand/Collapse Test
- Playwright's `.click()` fails on expanded rows because virtualized layout uses absolute positioning
- Other row's `.log-row-grid` elements intercept pointer events from Playwright's perspective
- Solution: `dispatchEvent('click')` instead of `.click()` for the collapse action

### IpcLogLine Type
- Duplicated in `tests/e2e/helpers/electron-app.ts` to avoid `@core` path alias issues
- E2E tests run through Playwright's own TS compilation, not Vite's alias resolver

## Removed File
- `tests/e2e/.gitkeep` -- replaced by actual test files

## Test State
- 207 unit tests passing (15 test files)
- 11 E2E tests passing
- Typecheck passes

## Phase 06 Complete
All five sub-phases (6A through 6E) are now implemented:
1. 6A: FilterEngine + unit tests
2. 6B: Mutable lanes + filter state in AppShell
3. 6C: FilterBar, FilterChip, LaneAddInput components
4. 6D: HTML5 drag-and-drop lane reordering
5. 6E: Playwright E2E tests (11 test cases)
