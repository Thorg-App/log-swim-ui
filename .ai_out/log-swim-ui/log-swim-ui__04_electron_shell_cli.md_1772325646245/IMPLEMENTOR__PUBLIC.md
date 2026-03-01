# Phase 04: Electron Shell & CLI -- Implementation Summary

## Status: COMPLETE

All items implemented, all tests green, typecheck clean.

## Results

- **10 test files, 132 tests passing** (57 new tests added: 33 CLI parser + 24 config manager)
- **TypeScript typecheck clean** (both `tsconfig.node.json` and `tsconfig.web.json`)

## Files Created

| File | Purpose |
|------|---------|
| `src/main/cli-parser.ts` | CLI argument parser: `--key-level`, `--key-timestamp`, `--lanes` |
| `src/main/config-manager.ts` | Config file loading, validation, deep merge, and saving |
| `src/main/ipc-bridge.ts` | Stdin -> JsonParser -> TimestampDetector -> IPC send pipeline |
| `src/preload/electron-api.d.ts` | TypeScript declaration for `window.api` |
| `tests/unit/main/cli-parser.test.ts` | 33 BDD tests for CLI parser |
| `tests/unit/main/config-manager.test.ts` | 24 BDD tests for config manager |

## Files Modified

| File | Change |
|------|--------|
| `src/core/types.ts` | Added `IpcLogLine`, `IPC_CHANNELS`, `ElectronApi`, `CliArgsResult` |
| `src/core/stdin-reader.ts` | Added `StdinReaderHandle` return type with `stop()` method |
| `src/preload/index.ts` | Full `contextBridge` API implementation with whitelisted channels |
| `src/main/index.ts` | Full startup orchestration: TTY check, CLI parse, config load, IPC handlers, bridge start |
| `tsconfig.web.json` | Added `src/preload/electron-api.d.ts` to include |
| `bin/log-swim-ui.js` | Updated from stub to spawn Electron with args and stdin forwarding |

## Design Decisions & Deviations

### D1: Adopted SO-01 -- Collapsed CLI arg channels into single `get-cli-args`
Per review suggestion SO-01, collapsed `get-lane-patterns`, `get-key-level`, `get-key-timestamp` into a single `get-cli-args` IPC channel returning `CliArgsResult { keyLevel, keyTimestamp, lanePatterns }`. Reduces channel count from 9 to 7, fewer handlers and preload methods.

### D2: MC-01 incorporated -- First-line errors HALT ingestion
Per review MC-01, the IPC bridge halts stdin reading when the first line fails JSON parse or timestamp detection. Implementation:
- Added `StdinReaderHandle.stop()` to `StdinReader` (backward-compatible extension)
- `IpcBridge.haltIngestion()` calls `handle.stop()` to close readline interface
- Error message sent to renderer via `stream-error` channel before halting

### D3: MC-02 incorporated -- `bin/log-swim-ui.js` updated
Updated from stub to functional CLI entry point that:
- Resolves `electron` binary path via `require('electron')`
- Spawns Electron with app path + forwarded CLI args
- Pipes parent stdin to child process stdin
- Inherits stdout/stderr for terminal output

### D4: TF-05 incorporated -- Relative imports in tests
Used relative imports (`../../../src/main/...`) in test files instead of adding an `@main` path alias. Simpler for just 2 test files.

### D5: MI-05 incorporated -- Test for `--lanes` at end with no values
Added explicit test case for `--lanes` being the last arg with no values after it.

### D6: Duplicate flags throw errors (strict behavior)
When `--key-level`, `--key-timestamp`, or `--lanes` appears twice, `CliValidationError` is thrown. Rationale: likely a user mistake.

### D7: ConfigManager -- validation before merge
Validation runs on the raw loaded JSON before deep merge. If validation fails, defaults are returned as fallback. This ensures the app always runs even with a corrupted config file.

### D8: StdinReader backward-compatible extension
`StdinReader.start()` return type changed from `void` to `StdinReaderHandle`. Existing callers that ignore the return value continue to work. All 6 existing stdin-reader tests pass unchanged.

---

## Review Feedback Addressed (Post-Review Iteration)

### I-02 (MUST FIX): Added `// WHY:` comments to all `as` type assertions
Added WHY comments to all 11 `as` type assertions in `src/main/config-manager.ts`:
- 7 assertions narrowing `unknown` to `Record<string, unknown>` after `typeof`/`null` guards
- 2 assertions widening `VIEW_TIMESTAMP_FORMATS` literal union to `string[]` for `.includes()` compatibility
- 1 assertion narrowing `parsed` after `typeof`+`null`+`Array.isArray` guards
- 1 assertion narrowing validated `viewTimestampFormat` to its literal union type

### I-03 (EVALUATE): ConfigValidator refactored to static pattern
**Changed.** Converted `ConfigValidator` from a stateful class (with `this.errors` array cleared via `length = 0`) to a fully static class. This follows the project's existing static utility patterns (`JsonParser`, `CliParser`, `LaneClassifier`). Changes:
- `validate()` is now `static validate()` returning `readonly string[]`
- Private methods (`validateColors`, `validateUI`, `validatePerformance`) are now `private static` and accept `errors: string[]` as first parameter
- Call site changed from `new ConfigValidator().validate(...)` to `ConfigValidator.validate(...)`
- Eliminates unnecessary instantiation and the unusual `errors.length = 0` reset

### S-03 (QUICK FIX): Removed dead macOS `activate` handler
Removed the macOS `activate` handler from `src/main/index.ts`. Since `window-all-closed` unconditionally calls `app.quit()`, the activate handler could never fire. If it somehow did fire, it would create a non-functional window (no IPC bridge, no config error). Added a WHY comment explaining the rationale.

### Not Addressed (deliberate decisions per instructions)
- **I-01**: Preload importing from core is accepted (DRY). CLAUDE.md update deferred to DOC_FIXER phase.
- **I-04**: Strict validation before merge is intentional (D7).
- **S-01**: `CliArgs`/`CliArgsResult` structural duplication is minimal and serves clarity.
- **S-02**: Listener leak in preload is theoretical; Electron manages this.
- **S-04**: CJS bin script is standard Node.js pattern.
- **S-05**: Free-floating merge functions are module-private and cohesive.
