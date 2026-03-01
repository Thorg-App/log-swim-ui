# Phase 6E Implementation: E2E Tests with Playwright

## Status: COMPLETE

## What Was Implemented

Phase 6E sets up Playwright Electron E2E testing infrastructure and writes 11 focused tests covering core user flows. Tests inject data via IPC (same path as production stdin) and verify UI behavior.

### New Files

| File | Purpose |
|------|---------|
| `tests/e2e/app.spec.ts` | 11 E2E test cases covering: lane headers, log row rendering, expand/collapse, filtering, lane addition, mode toggle, stream-end indicator |
| `tests/e2e/helpers/electron-app.ts` | Reusable helpers: `launchApp`, `injectLogLines`, `sendStreamEnd`, `waitForFlush`, `createIpcLogLine` |
| `tests/e2e/fixtures/sample-logs.jsonl` | 10-line test fixture with mixed log levels and services |

### Modified Files

| File | Changes |
|------|---------|
| `src/main/index.ts` | Added E2E test seam (env `E2E_TEST=1`): skip TTY check, offscreen rendering, Chromium flag filtering, skip IpcBridge stdin reading |
| `playwright.config.ts` | Configured for Electron testing: serial workers, no browser projects, no webServer |

## Design Decisions

### 1. Headless Electron on Linux Without X Display

The environment has no X display server (Xvfb unavailable, no sudo). Solved by:
- Chromium flags: `--no-sandbox --disable-gpu --enable-features=UseOzonePlatform --ozone-platform=headless`
- BrowserWindow config: `show: false` + `webPreferences.offscreen: true` (required for headless ozone to fire CDP window target events Playwright listens for)
- These are enabled only when `E2E_TEST=1` env is set, zero impact on production behavior

### 2. E2E Test Seam via `E2E_TEST` Env Variable

Rather than modifying production code paths, a controlled test seam in `main/index.ts` handles four concerns:
1. **TTY check bypass**: Skip `process.stdin.isTTY` check (stdin is Playwright's control pipe)
2. **Offscreen rendering**: `show: false` + `offscreen: true` for headless operation
3. **Chromium flag filtering**: `extractAppArgs()` finds the first known app flag (`--key-level`, `--key-timestamp`, `--lanes`) and takes everything from there, discarding Chromium flags and the app entry path that Playwright's loader leaves in `process.argv`
4. **IpcBridge skip**: Don't read stdin as log data (test data injected via `webContents.send()`)

### 3. IPC Injection Instead of stdin Piping

Tests use `electronApp.evaluate(({ BrowserWindow }, data) => win.webContents.send('log-line', data), ipcLine)` to inject test data. This tests the same IPC path (preload -> renderer) that production stdin data follows after the IpcBridge processes it.

### 4. Virtualized Row Click Workaround

The expand/collapse test uses `dispatchEvent('click')` instead of Playwright's `.click()` because the virtualized layout with absolute-positioned rows causes Playwright's actionability check to detect overlapping elements.

### 5. IpcLogLine Type Duplication

`tests/e2e/helpers/electron-app.ts` duplicates the `IpcLogLine` interface locally instead of importing from `@core/types`. This avoids TypeScript path alias issues in E2E test context (Playwright uses its own TS compilation, not Vite's).

## Test Scenarios

| # | Test | Description |
|---|------|-------------|
| 1 | Lane headers rendered | 3 headers: error, auth, unmatched |
| 2 | Unmatched CSS class | `.lane-header--unmatched` present |
| 3 | Log rows appear | Injected entries render as `.log-row` elements |
| 4 | Message previews | `.log-row__message` contains expected text |
| 5 | Row expand | Click reveals `.log-row__expanded-content` with JSON |
| 6 | Row collapse | Click again hides expanded content |
| 7 | Filter bar | Add raw filter, only matching rows visible |
| 8 | Lane addition | Type regex in LaneAddInput, new header appears before unmatched |
| 9 | Default mode | Mode toggle shows "Live" active |
| 10 | Mode toggle | Click "Scroll" switches active mode |
| 11 | Stream-ended | Send stream-end, `.stream-ended` indicator appears |

## Test Results

```
E2E:   11 passed (6.7s)
Unit:  207 passed (197ms) -- 15 test files
Typecheck: PASS (zero errors)
```

## Prerequisites for Running E2E Tests

1. `npm run build` must be run before `npm run test:e2e`
2. Linux headless environments work automatically via ozone headless platform
3. Environments with X display work without any special flags (the `E2E_TEST=1` env handles offscreen mode)
