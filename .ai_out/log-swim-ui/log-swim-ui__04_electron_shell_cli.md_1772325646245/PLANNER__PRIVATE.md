# PLANNER Private Context -- Phase 04

## Key Design Tensions Resolved

### StdinMessage vs IpcLogLine
The existing `StdinMessage` type in `src/core/types.ts` (Phase 03) has `{ type, data?: string }`. The task spec diagram shows sending `{ rawJson, fields, timestamp, level }`. These are incompatible. I resolved this by:
- Introducing `IpcLogLine` as the actual data payload for the `log-line` channel
- Keeping `StdinMessage` in types.ts untouched (backward compat, might be used elsewhere)
- Using separate IPC channels instead of multiplexing through a single type

### Where does parsing happen?
- **Main process**: StdinReader -> JsonParser -> TimestampDetector -> extract level -> send IpcLogLine
- **Renderer**: receives IpcLogLine -> constructs LogEntry (adding laneIndex via LaneClassifier) -> MasterList -> LogBuffer -> render
- This split is clear: main does I/O + parsing, renderer does classification + display

### Timestamp as number, not Date
Epoch millis over IPC is more explicit than relying on structured clone for Date objects. The renderer converts `new Date(ipcLogLine.timestamp)` when constructing LogEntry.

### Testability of Electron-dependent code
- CLI parser: zero Electron deps, fully testable
- Config manager: zero Electron deps (path injected), fully testable with real FS
- IPC bridge: depends on `IpcSender` abstraction, testable with mocks
- Main index.ts: composition root, NOT unit tested (E2E scope)
- Preload: NOT unit tested (Electron context only)

### `app.getPath('userData')` vs `$HOME/.config/log-swim-ui`
The task spec says `$HOME/.config/log-swim-ui/config.json` but also says "Use `app.getPath('userData')` for config directory on macOS/Linux". On Linux, Electron's `app.getPath('userData')` returns `~/.config/<app-name>`. The app name from package.json is `log-swim-ui`, so `app.getPath('userData')` = `~/.config/log-swim-ui`. These are the same on Linux. On macOS it would be `~/Library/Application Support/log-swim-ui`. I went with `app.getPath('userData')` since it's the Electron convention and cross-platform.

### bin/log-swim-ui.js
This file is the npm global install entry point. It currently just prints an error. The task spec says it's out of scope for now -- the bin entry will eventually do something like `electron path/to/app -- $@` but that's packaging detail. For dev, `npm run dev -- --key-level level --key-timestamp ts` works because electron-vite passes extra args to the main process.

### IPC Channel Naming
Used kebab-case constants centralized in `IPC_CHANNELS` object. This prevents typo bugs from string literals scattered across main/preload/renderer.

### Forward Compatibility in Config
Deep merge means if we add `config.performance.virtualScrollOverscan` in Phase 06, existing config files (which don't have that key) will get the default value from `DEFAULT_APP_CONFIG`. Users don't lose their customizations when we add new fields.

## Risks
1. `webContents.send` before window is ready -- addressed by waiting for `did-finish-load`
2. Large stdin volume overwhelming IPC -- not a Phase 04 concern, LogBuffer in renderer (Phase 05) handles batching
3. `npm run dev` may not pass CLI args through correctly -- need to verify electron-vite's arg passthrough

## File Inventory
- New files: 5 (cli-parser.ts, config-manager.ts, ipc-bridge.ts, electron-api.d.ts, 2 test files)
- Modified files: 3 (types.ts, preload/index.ts, main/index.ts)
- Config modified: 1 (vitest.config.ts for @main alias)
