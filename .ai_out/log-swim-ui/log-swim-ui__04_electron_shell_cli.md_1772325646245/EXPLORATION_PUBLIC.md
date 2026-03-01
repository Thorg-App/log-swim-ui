# Exploration: Phase 04 - Electron Shell & CLI

## Current Codebase State

### Main Process (`src/main/index.ts`)
- Minimal stub: creates BrowserWindow (1200x800), loads preload, loads HMR URL or index.html
- No CLI parsing, no stdin handling, no config loading, no IPC bridge

### Preload (`src/preload/index.ts`)
- Stub: `contextBridge.exposeInMainWorld('api', {})`
- No IPC channels exposed

### Core Types (`src/core/types.ts`)
- `LogEntry`: rawJson, fields, timestamp, level, laneIndex (mutable)
- `LaneDefinition`: pattern, regex (RegExp|null), isError
- `ParsedLine`: JsonParseSuccess | JsonParseFailure (discriminated union)
- `StdinMessage`: type ('line'|'end'|'error'), data? (string)
- `AppConfig`: colors (levels, unrecognizedLevel, swimlaneHeaders, bg, hover, expanded), ui (rowHeight, fontFamily, fontSize, viewTimestampFormat), performance (flushIntervalMs, maxLogEntries)
- `DEFAULT_APP_CONFIG` exported with concrete values
- `createLaneDefinition(pattern)` factory

### Core Pipeline Classes
- `JsonParser` (static): `parse(rawLine) → ParsedLine` (never throws)
- `TimestampDetector` (stateful): `detectAndLock(value) → Date` (throws on fail), `parse(value) → ParseResult<Date>` (never throws), `getLockedFormat()`
- `LaneClassifier` (static): `classify(rawJson, lanes) → number`, `reclassifyAll(entries, lanes)`
- `MasterList` (stateful): sorted by timestamp, binary-search insert, eviction
- `LogBuffer` (stateful): timer-based flush with callback
- `StdinReader` (static): `start(input: Readable, callbacks)` - line-by-line reading via node:readline

### Build Config
- `electron.vite.config.ts`: separate main/preload/renderer configs, `@renderer` and `@core` aliases in renderer
- `tsconfig.node.json`: strict, includes src/main, src/preload, src/core
- `tsconfig.web.json`: strict, excludes stdin-reader.ts, has path aliases
- `vitest.config.ts`: node env, `@core` alias, tests in tests/unit/ and src/

### Package Info
- Electron 40.6.1, electron-vite 5.0, TypeScript 5.9.3, Vitest 4.0.18
- bin entry: `./bin/log-swim-ui.js` (stub that prints error and exits)
- No external CLI parsing library

### Test Patterns
- BDD: GIVEN/WHEN/THEN nested describes
- Explicit imports from vitest
- One assert per test preferred
- Tests in `tests/unit/core/` for all Phase 03 classes

## Files To Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/main/cli-parser.ts` | Create | Parse --key-level, --key-timestamp, --lanes |
| `src/main/config-manager.ts` | Create | Load/save/validate config from $HOME/.config/log-swim-ui/config.json |
| `src/main/ipc-bridge.ts` | Create | Wire stdin→parse→IPC to renderer |
| `src/main/index.ts` | Modify | Wire CLI, config, IPC, error handling |
| `src/preload/index.ts` | Modify | Expose safe IPC API via contextBridge |
| `tests/unit/main/cli-parser.test.ts` | Create | CLI parser unit tests |
| `tests/unit/main/config-manager.test.ts` | Create | Config manager unit tests |
