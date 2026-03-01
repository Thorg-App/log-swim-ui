# Phase 04: Electron Shell & CLI

## Objective
Wire up the Electron main process with CLI argument parsing, config file management, stdin-to-renderer IPC bridge, and all startup error states. After this phase, the app can be launched from the CLI, read stdin, parse config, and send log data to the renderer.

## Prerequisites
- Phase 01 complete (project scaffold)
- Phase 03 complete (core data pipeline: StdinReader, JsonParser, TimestampDetector, types)

## Scope
### In Scope
- Implement CLI argument parser (`src/main/cli-parser.ts`):
  - `--key-level <field>` — required
  - `--key-timestamp <field>` — required
  - `--lanes <regex1> <regex2> ...` — optional (all values until next `--` flag)
  - Validate required args present; print usage + exit 1 if missing
  - Parse lane regexes into `LaneDefinition[]` (using `LaneClassifier` from Phase 03)
- Implement config manager (`src/main/config-manager.ts`):
  - Read `$HOME/.config/log-swim-ui/config.json`
  - If missing: create directory + write defaults
  - If present and valid: load and merge with defaults (for forward compatibility)
  - If present and invalid: pass error info to renderer for UI error state
  - Write config back to disk (for settings panel changes in Phase 07)
- Implement stdin-to-renderer IPC bridge (`src/main/ipc-bridge.ts`):
  - Main process reads stdin via `StdinReader` (Phase 03)
  - Parses each line via `JsonParser`
  - Detects timestamp format on first valid line via `TimestampDetector`
  - Sends `StdinMessage` objects to renderer via `ipcMain`/`webContents.send`
  - Handles stdin close: sends `{ type: 'end' }` message
  - Handles errors: sends `{ type: 'error', data: errorInfo }` message
- Implement preload script (`src/preload/index.ts`):
  - Expose safe IPC channels via `contextBridge.exposeInMainWorld`
  - Channels: `onLogLine`, `onStreamEnd`, `onStreamError`, `onConfigError`
  - Channel for config operations: `getConfig`, `saveConfig`
  - Channel for CLI args: `getLaneDefinitions`, `getKeyLevel`, `getKeyTimestamp`
- Implement startup error handling:
  - No stdin pipe (`process.stdin.isTTY === true`): print usage to stderr, exit 1
  - Invalid config: send error to renderer for UI error state display
  - Timestamp parse failure on first line: send error to renderer
  - First line not valid JSON: send error to renderer
- Update Electron main process (`src/main/index.ts`):
  - Parse CLI args on startup
  - Check stdin pipe
  - Load config
  - Create BrowserWindow
  - Start IPC bridge after window ready
- Unit tests for CLI parser and config manager

### Out of Scope
- Renderer-side handling of IPC messages (Phase 05)
- UI components (Phase 05+)
- Settings save-back flow (Phase 07)
- npm global install packaging details (can be refined later)

## Implementation Guidance

### CLI Parser
Use a simple hand-rolled parser (no external CLI library needed for 3 args):
```typescript
interface CliArgs {
  keyLevel: string;
  keyTimestamp: string;
  lanePatterns: string[];
}
```

Usage message on error:
```
Usage:
  cat logs.json | log-swim-ui --key-level <field> --key-timestamp <field> [--lanes <regex> ...]

Example:
  kubectl logs my-pod | log-swim-ui --key-level level --key-timestamp timestamp --lanes "error|ERROR|fatal" "auth"
```

### Config Manager
- Use `app.getPath('userData')` for config directory on macOS/Linux
- Deep-merge loaded config with defaults so new config fields in future versions get their defaults
- Validate types of loaded values (string for hex colors, number for numeric fields, etc.)
- On validation failure: treat as invalid config

### IPC Bridge
```
Main Process                        Renderer Process
─────────────                       ─────────────────
StdinReader
  → JsonParser
  → TimestampDetector (first line)
  → webContents.send('log-line', {  ──→  window.api.onLogLine(callback)
      rawJson, fields, timestamp,
      level
    })
  → webContents.send('stream-end')  ──→  window.api.onStreamEnd(callback)
  → webContents.send('error', err)  ──→  window.api.onStreamError(callback)
```

### Preload Security
- Use `contextBridge.exposeInMainWorld` — never expose `ipcRenderer` directly
- Whitelist specific channels

## Acceptance Criteria
- [ ] `log-swim-ui --key-level level --key-timestamp timestamp` launches with piped stdin
- [ ] Missing required args prints usage and exits with code 1
- [ ] No stdin pipe prints help and exits with code 1
- [ ] Config file created with defaults if missing
- [ ] Invalid config file detected and error info sent to renderer
- [ ] Stdin lines are parsed and sent to renderer via IPC
- [ ] Timestamp format detected on first valid line
- [ ] First-line parse failures (bad JSON, bad timestamp) sent as errors to renderer
- [ ] Stream end signal sent when stdin closes
- [ ] Preload script exposes safe IPC API via `contextBridge`
- [ ] CLI parser and config manager have unit tests
- [ ] All tests pass

## Notes
- The renderer won't have components to display data yet (that's Phase 05). For now, the renderer can log received IPC messages to verify the bridge works.
- Config write-back (for Settings panel) will be wired in Phase 07, but the `configManager.save()` method should be implemented here.
