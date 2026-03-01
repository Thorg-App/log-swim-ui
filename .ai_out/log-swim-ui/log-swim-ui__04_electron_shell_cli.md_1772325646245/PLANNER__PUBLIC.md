# Phase 04: Electron Shell & CLI -- Implementation Plan

## 1. Problem Understanding

### Goal
Wire up the Electron main process so the app can be launched from CLI, parse arguments, load config, read stdin line-by-line, parse JSON, detect timestamp format, and send structured data to the renderer via IPC. After this phase, the full main-process pipeline works end-to-end and the preload bridge safely exposes IPC channels.

### Key Constraints
- Hand-rolled CLI parser (no external library) -- only 3 arguments
- `src/core/` cannot import Electron APIs; main-process modules live in `src/main/`
- Preload must use `contextBridge` -- never expose raw `ipcRenderer`
- Config file lives at `$HOME/.config/log-swim-ui/config.json` (use `app.getPath('userData')` in Electron, but for testability the path resolution should be injectable)
- Tests must run in Node (Vitest) without Electron -- design for testability by injecting dependencies
- `StdinMessage` type exists but only carries `type` + `data?: string`. The IPC bridge needs to send richer parsed data. See Design Decision DD-01 below.

### Assumptions
- The renderer will NOT process these IPC messages yet (Phase 05 scope)
- `LaneClassifier` and `MasterList` are renderer-side concerns; main process does NOT classify lanes
- The `bin/log-swim-ui.js` entry point does NOT need modification in this phase (it launches Electron via `electron .` -- the main process `index.ts` handles args)
- `app.getPath('userData')` on Linux returns `~/.config/log-swim-ui` (Electron convention)

---

## 2. Design Decisions

### DD-01: IPC Message Shape -- Raw Lines vs. Parsed Objects

**Problem**: The existing `StdinMessage` type (`{ type: 'line'|'end'|'error', data?: string }`) only carries a raw string. The task spec diagram shows sending `rawJson, fields, timestamp, level` -- structured parsed data.

**Decision**: **Send structured parsed data from main to renderer.** Rationale:
- Parsing in main avoids duplicate work (main already parses for timestamp detection)
- Structured data enables the renderer to directly construct `LogEntry` objects without re-parsing
- The `StdinMessage` type was designed as a phase-03 placeholder

**Implementation**:
- Define a new `IpcLogLine` interface in `src/core/types.ts` for the structured log line payload
- Use separate IPC channels for different message types (`log-line`, `stream-end`, `stream-error`, `config-error`) rather than multiplexing through `StdinMessage`
- `StdinMessage` remains in types.ts for backward compatibility but is not used by the IPC bridge

**`IpcLogLine` type** (add to `src/core/types.ts`):
```typescript
interface IpcLogLine {
  readonly rawJson: string
  readonly fields: Record<string, unknown>
  readonly timestamp: number  // epoch millis -- Date is not serializable over IPC
  readonly level: string
}
```

**WHY `timestamp: number` not `Date`**: Electron IPC uses structured clone. `Date` objects survive structured clone, but using epoch millis is more explicit, avoids any serialization surprises, and is consistent with a "data transfer object" pattern. The renderer converts to `Date` when constructing `LogEntry`.

### DD-02: Config Path -- `app.getPath` vs. Manual Path

**Problem**: `app.getPath('userData')` requires the Electron `app` module, making unit testing harder.

**Decision**: The `ConfigManager` class accepts the config directory path as a constructor parameter. The main process passes `app.getPath('userData')`. Tests pass a temp directory. This follows dependency inversion.

### DD-03: IPC Bridge -- What Happens When JSON Parsing Fails?

**Problem**: Not every stdin line will be valid JSON. What does the bridge send?

**Decision**:
- **Valid JSON with valid timestamp**: Send `IpcLogLine` on `log-line` channel
- **Valid JSON with unparseable timestamp** (after first line locks format): Send `IpcLogLine` with `timestamp: 0` and let the renderer handle it (unparseable panel)
- **Invalid JSON**: Skip the line. Main process logs a warning. We do NOT send every garbage line to the renderer. (The renderer has no unparseable panel for non-JSON lines in the current spec.)
- **First line special cases**: If the very first line fails JSON parse or timestamp detection, send an error on the `stream-error` channel with descriptive message. The renderer will show an error state.

**Clarification needed from spec**: The spec says "First line not valid JSON: send error to renderer" and "Timestamp parse failure on first line: send error to renderer". These are errors, not fatal -- the bridge should continue reading subsequent lines. Only "no stdin pipe" and "missing CLI args" are exit-1 situations.

### DD-04: Level Field Extraction

**Problem**: The IPC bridge needs to extract the `level` field from parsed JSON using the `--key-level` CLI arg.

**Decision**: The bridge reads `fields[keyLevel]` from the parsed JSON. If the field is missing or not a string, use `'unknown'` as the level value. This is not an error -- real-world logs may have missing level fields.

### DD-05: Timestamp Field on Non-First Lines

After the first line locks the timestamp format via `TimestampDetector.detectAndLock()`, subsequent lines use `TimestampDetector.parse()`. If parse fails (wrong format, missing field), the line still gets sent as `IpcLogLine` with `timestamp: 0`. The renderer's `MasterList` will need to handle `timestamp: 0` entries (likely placing them in an unparseable section).

---

## 3. High-Level Architecture

```
CLI Launch
    |
    v
main/index.ts (startup orchestrator)
    |
    +--> Check process.stdin.isTTY → exit 1 if true
    |
    +--> CliParser.parse(process.argv.slice(2))
    |       → CliArgs { keyLevel, keyTimestamp, lanePatterns }
    |       → exit 1 on validation failure
    |
    +--> ConfigManager.load(configDir)
    |       → AppConfig (merged with defaults)
    |       → error info if invalid (sent to renderer later)
    |
    +--> app.whenReady() → createWindow()
    |
    +--> IpcBridge.start(process.stdin, window, cliArgs, timestampDetector)
    |       → StdinReader → JsonParser → TimestampDetector → webContents.send
    |
    +--> Register IPC handlers (config get/save, CLI args query)

Preload (src/preload/index.ts)
    |
    +--> contextBridge.exposeInMainWorld('api', { ... })
            onLogLine(callback)
            onStreamEnd(callback)
            onStreamError(callback)
            onConfigError(callback)
            getConfig() → Promise<AppConfig>
            saveConfig(config) → Promise<void>
            getLanePatterns() → Promise<string[]>
            getKeyLevel() → Promise<string>
            getKeyTimestamp() → Promise<string>
```

### IPC Channels

| Channel Name | Direction | Payload | Purpose |
|-------------|-----------|---------|---------|
| `log-line` | main → renderer | `IpcLogLine` | Parsed log entry |
| `stream-end` | main → renderer | (none) | stdin closed |
| `stream-error` | main → renderer | `string` (error message) | Stream/parse error |
| `config-error` | main → renderer | `string` (error message) | Config load failure |
| `get-config` | renderer → main (invoke) | returns `AppConfig` | Request current config |
| `save-config` | renderer → main (invoke) | `AppConfig` → returns `void` | Save config to disk |
| `get-lane-patterns` | renderer → main (invoke) | returns `string[]` | CLI lane patterns |
| `get-key-level` | renderer → main (invoke) | returns `string` | CLI key-level arg |
| `get-key-timestamp` | renderer → main (invoke) | returns `string` | CLI key-timestamp arg |

**Channel name convention**: kebab-case, prefixed logically. Push channels (main→renderer) use `webContents.send` / `ipcRenderer.on`. Request channels (renderer→main) use `ipcMain.handle` / `ipcRenderer.invoke`.

---

## 4. Implementation Phases

### Phase 4A: Types Extension + CLI Parser

**Goal**: Add `IpcLogLine` type and implement the CLI argument parser with full test coverage.

**Files**:
- Modify: `src/core/types.ts`
- Create: `src/main/cli-parser.ts`
- Create: `tests/unit/main/cli-parser.test.ts`

#### 4A.1: Extend Types (`src/core/types.ts`)

Add `IpcLogLine` interface and export it:

```typescript
interface IpcLogLine {
  readonly rawJson: string
  readonly fields: Record<string, unknown>
  readonly timestamp: number  // epoch millis; 0 = unparseable
  readonly level: string      // extracted via --key-level; 'unknown' if missing
}
```

Also add an `IPC_CHANNELS` constant object for channel name centralization:

```typescript
const IPC_CHANNELS = {
  LOG_LINE: 'log-line',
  STREAM_END: 'stream-end',
  STREAM_ERROR: 'stream-error',
  CONFIG_ERROR: 'config-error',
  GET_CONFIG: 'get-config',
  SAVE_CONFIG: 'save-config',
  GET_LANE_PATTERNS: 'get-lane-patterns',
  GET_KEY_LEVEL: 'get-key-level',
  GET_KEY_TIMESTAMP: 'get-key-timestamp',
} as const
```

Export both from the existing exports block.

#### 4A.2: CLI Parser (`src/main/cli-parser.ts`)

**Interface**:
```typescript
interface CliArgs {
  readonly keyLevel: string
  readonly keyTimestamp: string
  readonly lanePatterns: string[]  // raw regex strings; empty if --lanes not provided
}
```

**Class**: `CliParser` (static methods, consistent with existing patterns like `JsonParser`)

**Methods**:
- `static parse(argv: readonly string[]): CliArgs` -- parse the argv array (expects `process.argv.slice(2)`)
  - Scans for `--key-level` and `--key-timestamp` (each followed by exactly one value)
  - Scans for `--lanes` followed by 1+ values until next `--` flag or end of argv
  - If required args missing: throws `CliValidationError` (custom error class)
  - If `--lanes` has zero values after it: throws `CliValidationError`
  - `--lanes` is optional (empty array if not provided)

- `static formatUsage(): string` -- returns the usage message string

**Usage message** (from spec):
```
Usage:
  cat logs.json | log-swim-ui --key-level <field> --key-timestamp <field> [--lanes <regex> ...]

Example:
  kubectl logs my-pod | log-swim-ui --key-level level --key-timestamp timestamp --lanes "error|ERROR|fatal" "auth"
```

**Custom error class**: `CliValidationError extends Error` -- carries the specific validation failure message. The caller (main/index.ts) catches this, prints usage + error to stderr, and exits 1.

**Parsing algorithm**:
1. Walk the argv array left to right
2. When encountering a known flag (`--key-level`, `--key-timestamp`, `--lanes`), consume its value(s)
3. A "flag" is any string starting with `--`
4. `--key-level` and `--key-timestamp` consume exactly 1 value after them
5. `--lanes` consumes all subsequent values until the next `--` flag or end of argv
6. Unknown flags: throw `CliValidationError` with message identifying the unknown flag
7. After scanning: validate that `keyLevel` and `keyTimestamp` are set
8. **Arg order does not matter** -- e.g. `--lanes X --key-level Y --key-timestamp Z` is valid

#### 4A.3: CLI Parser Tests (`tests/unit/main/cli-parser.test.ts`)

Test cases (BDD style, one assert per test):

**GIVEN valid argv with all required args**:
- WHEN `--key-level level --key-timestamp ts` THEN returns `{ keyLevel: 'level', keyTimestamp: 'ts', lanePatterns: [] }`
- WHEN `--key-level level --key-timestamp ts --lanes "err" "auth"` THEN lanePatterns is `['err', 'auth']`
- WHEN args are in reverse order THEN still parses correctly

**GIVEN missing --key-level**:
- WHEN parsed THEN throws CliValidationError

**GIVEN missing --key-timestamp**:
- WHEN parsed THEN throws CliValidationError

**GIVEN --lanes with no values (immediately followed by another flag or end of argv)**:
- WHEN `--lanes --key-level level --key-timestamp ts` THEN throws CliValidationError (no lane patterns after --lanes)

**GIVEN --lanes with values**:
- WHEN `--lanes "a" "b" "c" --key-level level --key-timestamp ts` THEN lanePatterns is `['a', 'b', 'c']`
- WHEN `--key-level level --key-timestamp ts --lanes "a"` THEN lanePatterns is `['a']` (lanes at end)

**GIVEN unknown flag**:
- WHEN `--key-level level --key-timestamp ts --unknown-flag` THEN throws CliValidationError

**GIVEN empty argv**:
- WHEN parsed THEN throws CliValidationError

**GIVEN duplicate flags**:
- WHEN `--key-level a --key-level b --key-timestamp ts` THEN last value wins (or throws -- implementor decides, document the behavior)

**Usage format test**:
- `CliParser.formatUsage()` THEN contains "Usage:" and "--key-level" and "--key-timestamp"

**Verification**: `npm test` passes with all new tests.

---

### Phase 4B: Config Manager

**Goal**: Implement config file loading, validation, deep merge, and saving.

**Files**:
- Create: `src/main/config-manager.ts`
- Create: `tests/unit/main/config-manager.test.ts`

#### 4B.1: Config Manager (`src/main/config-manager.ts`)

**Class**: `ConfigManager`

**Constructor**: `constructor(configDir: string)` -- the directory where `config.json` lives. For Electron, pass `app.getPath('userData')`. For tests, pass a temp directory.

**Instance fields**:
- `private configPath: string` -- resolved to `path.join(configDir, 'config.json')`
- `private currentConfig: AppConfig` -- the active config (starts as `DEFAULT_APP_CONFIG`)

**Methods**:

- `async load(): Promise<ConfigLoadResult>` -- Load and validate config from disk.

  `ConfigLoadResult` is a discriminated union:
  ```typescript
  interface ConfigLoadSuccess {
    readonly ok: true
    readonly config: AppConfig
    readonly source: 'file' | 'defaults'  // 'defaults' if file was missing and was created
  }

  interface ConfigLoadFailure {
    readonly ok: false
    readonly error: string
    readonly config: AppConfig  // always returns defaults so app can still run
  }

  type ConfigLoadResult = ConfigLoadSuccess | ConfigLoadFailure
  ```

  Flow:
  1. Check if config file exists
  2. If not: create directory (recursive), write `DEFAULT_APP_CONFIG` as JSON, return `{ ok: true, config: DEFAULT_APP_CONFIG, source: 'defaults' }`
  3. If exists: read and parse JSON
  4. If JSON parse fails: return `{ ok: false, error: 'Config file contains invalid JSON: <detail>', config: DEFAULT_APP_CONFIG }`
  5. If valid JSON: deep merge with defaults, validate types, store in `currentConfig`
  6. If validation fails: return `{ ok: false, error: '<validation detail>', config: DEFAULT_APP_CONFIG }`
  7. On success: return `{ ok: true, config: mergedConfig, source: 'file' }`

- `async save(config: AppConfig): Promise<void>` -- Write config to disk as formatted JSON. Updates `currentConfig`.

- `getConfig(): AppConfig` -- Returns current in-memory config (synchronous).

**Deep merge logic**:
- Recursive merge: for each key in `DEFAULT_APP_CONFIG`, if the loaded config has the key and it's an object, recurse. If it's a leaf value and passes type validation, use it. Otherwise fall back to the default.
- This means new config fields added in future versions automatically get their default values.
- Implement as a private static method: `static deepMerge(defaults: AppConfig, loaded: unknown): AppConfig`

**Validation rules**:
- Colors (hex strings): must match `/^#[0-9a-fA-F]{6}$/`
- `levels` record: each value must be a valid hex color
- `rowHeight`, `fontSize`, `flushIntervalMs`, `maxLogEntries`: must be positive numbers
- `fontFamily`: must be a non-empty string
- `viewTimestampFormat`: must be one of `VIEW_TIMESTAMP_FORMATS`
- Collect all validation errors into a single message (don't stop at first)

**File system**: Use `node:fs/promises` (`readFile`, `writeFile`, `mkdir`, `access`).

#### 4B.2: Config Manager Tests (`tests/unit/main/config-manager.test.ts`)

Use a temp directory (via `node:fs/promises` `mkdtemp`) for each test. Clean up in `afterEach`.

**Test cases**:

**GIVEN config file does not exist**:
- WHEN load() THEN creates file with defaults
- WHEN load() THEN returns `{ ok: true, source: 'defaults' }`
- WHEN load() THEN config matches DEFAULT_APP_CONFIG

**GIVEN valid config file with all fields**:
- WHEN load() THEN returns `{ ok: true, source: 'file' }`
- WHEN load() THEN values from file are used

**GIVEN config file with partial fields (missing some)**:
- WHEN load() THEN missing fields filled from defaults (forward compatibility)

**GIVEN config file with invalid JSON**:
- WHEN load() THEN returns `{ ok: false }` with error message
- WHEN load() THEN config is DEFAULT_APP_CONFIG (safe fallback)

**GIVEN config file with invalid types (e.g. rowHeight is a string)**:
- WHEN load() THEN returns `{ ok: false }` with validation error

**GIVEN config file with invalid hex color**:
- WHEN load() THEN returns `{ ok: false }` with validation error

**GIVEN save() called with new config**:
- WHEN getConfig() THEN returns the saved config
- WHEN file read from disk THEN contains the saved config as JSON

**Verification**: `npm test` passes.

---

### Phase 4C: IPC Bridge

**Goal**: Wire StdinReader -> JsonParser -> TimestampDetector -> IPC send. The bridge is the core data pipeline connector between main and renderer processes.

**Files**:
- Create: `src/main/ipc-bridge.ts`

#### 4C.1: IPC Bridge (`src/main/ipc-bridge.ts`)

**Class**: `IpcBridge`

**Constructor dependencies** (injected for testability):
```typescript
interface IpcBridgeDeps {
  readonly keyLevel: string
  readonly keyTimestamp: string
  readonly sender: IpcSender  // abstraction over webContents.send
}

interface IpcSender {
  send(channel: string, ...args: unknown[]): void
}
```

**WHY `IpcSender` abstraction**: `BrowserWindow.webContents` is an Electron type that cannot be instantiated in Vitest. By depending on the `IpcSender` interface (which `webContents` satisfies), we enable unit testing with mocks if desired in the future. For Phase 04, the IPC bridge does not have dedicated unit tests (its complexity is low, and it's tested via E2E in a later phase), but the interface enables them.

**Instance fields**:
- `private readonly timestampDetector: TimestampDetector` -- created internally
- `private firstLine: boolean` -- tracks whether the first valid JSON line has been processed
- `private readonly deps: IpcBridgeDeps`

**Methods**:

- `start(input: Readable): void` -- Start reading from the input stream. Calls `StdinReader.start()` with callbacks wired to the processing pipeline.

- **`onLine` callback** (private):
  1. Parse line with `JsonParser.parse(line)`
  2. If parse fails:
     - If `firstLine` is true: send `stream-error` with message "First line is not valid JSON: <error>"
     - If not first line: skip (line is not JSON; silently dropped)
     - Return
  3. Extract timestamp value: `fields[keyTimestamp]`
  4. If `firstLine`:
     - Try `timestampDetector.detectAndLock(timestampValue)`
     - If throws: send `stream-error` with "Failed to detect timestamp format: <error>"
     - Set `firstLine = false` regardless of success
  5. Parse timestamp:
     - If format locked: `timestampDetector.parse(timestampValue)`
     - If parse fails: use `0` as timestamp
  6. Extract level: `String(fields[keyLevel] ?? 'unknown')`
  7. Construct `IpcLogLine` and send on `log-line` channel

- **`onEnd` callback**: Send on `stream-end` channel.

- **`onError` callback**: Send `stream-error` with `error.message`.

**Note**: The IPC bridge does NOT do lane classification. That is a renderer concern (Phase 05). The bridge sends parsed lines with `rawJson`, `fields`, `timestamp` (epoch millis), and `level`.

**No dedicated unit tests for IpcBridge in Phase 04** -- the class is a thin orchestrator over already-tested components (StdinReader, JsonParser, TimestampDetector). It will be covered by E2E tests in later phases. If the implementor feels strongly about adding tests with a mock `IpcSender`, that is fine but not required.

---

### Phase 4D: Preload Script

**Goal**: Expose safe IPC API to the renderer via `contextBridge`.

**Files**:
- Modify: `src/preload/index.ts`

#### 4D.1: Preload Implementation

The preload script defines the `window.api` shape that the renderer will use.

**API shape** (exposed via `contextBridge.exposeInMainWorld('api', ...)`):

```typescript
// This is what window.api looks like to the renderer
interface ElectronApi {
  // Push channels (main → renderer): register callbacks
  onLogLine: (callback: (line: IpcLogLine) => void) => void
  onStreamEnd: (callback: () => void) => void
  onStreamError: (callback: (error: string) => void) => void
  onConfigError: (callback: (error: string) => void) => void

  // Request channels (renderer → main): invoke and await response
  getConfig: () => Promise<AppConfig>
  saveConfig: (config: AppConfig) => Promise<void>
  getLanePatterns: () => Promise<string[]>
  getKeyLevel: () => Promise<string>
  getKeyTimestamp: () => Promise<string>
}
```

**Implementation pattern**:
```typescript
import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../core/types'

contextBridge.exposeInMainWorld('api', {
  onLogLine: (callback) =>
    ipcRenderer.on(IPC_CHANNELS.LOG_LINE, (_event, line) => callback(line)),
  onStreamEnd: (callback) =>
    ipcRenderer.on(IPC_CHANNELS.STREAM_END, () => callback()),
  // ... etc for push channels

  getConfig: () => ipcRenderer.invoke(IPC_CHANNELS.GET_CONFIG),
  saveConfig: (config) => ipcRenderer.invoke(IPC_CHANNELS.SAVE_CONFIG, config),
  // ... etc for request channels
})
```

**Security constraints**:
- Never expose `ipcRenderer` directly
- Only whitelist known channels via `IPC_CHANNELS` constants
- No wildcard listeners

**TypeScript declaration**: Add a `src/preload/electron-api.d.ts` (or add to existing `env.d.ts` if present) so the renderer can access `window.api` with type safety:

```typescript
interface Window {
  api: ElectronApi
}
```

Check if there is an existing `env.d.ts` or `global.d.ts` in the renderer or preload. If not, create one and ensure it's included in `tsconfig.web.json`.

**Note on preload imports**: The preload script needs to import `IPC_CHANNELS` from `src/core/types.ts`. Check that `tsconfig.node.json` includes `src/core/**/*` (it does). The electron-vite bundler handles the preload build separately, so ensure the import resolves. Since `electron.vite.config.ts` currently has no aliases for preload, use a relative import: `import { IPC_CHANNELS } from '../core/types'`.

---

### Phase 4E: Main Process Orchestration

**Goal**: Wire everything together in `src/main/index.ts`.

**Files**:
- Modify: `src/main/index.ts`

#### 4E.1: Startup Flow

The main process startup sequence:

```
1. Check TTY:
   if (process.stdin.isTTY) {
     process.stderr.write(CliParser.formatUsage() + '\n')
     process.exit(1)
   }

2. Parse CLI:
   try {
     const cliArgs = CliParser.parse(process.argv.slice(2))
   } catch (e) {
     if (e instanceof CliValidationError) {
       process.stderr.write(e.message + '\n\n' + CliParser.formatUsage() + '\n')
       process.exit(1)
     }
     throw e  // unexpected error, let it crash
   }

3. Load config:
   const configManager = new ConfigManager(app.getPath('userData'))
   const configResult = await configManager.load()

4. app.whenReady():
   const mainWindow = createWindow()

5. Register IPC handlers (ipcMain.handle for request channels):
   - GET_CONFIG → configManager.getConfig()
   - SAVE_CONFIG → configManager.save(config)
   - GET_LANE_PATTERNS → cliArgs.lanePatterns
   - GET_KEY_LEVEL → cliArgs.keyLevel
   - GET_KEY_TIMESTAMP → cliArgs.keyTimestamp

6. If config error: send config-error to renderer after window loads

7. Start IPC bridge:
   const bridge = new IpcBridge({
     keyLevel: cliArgs.keyLevel,
     keyTimestamp: cliArgs.keyTimestamp,
     sender: mainWindow.webContents
   })
   bridge.start(process.stdin)
```

**Key timing**: The IPC bridge must start AFTER the window is ready (`did-finish-load` event), otherwise `webContents.send` will silently drop messages. Listen for `mainWindow.webContents.on('did-finish-load', ...)` before starting the bridge.

**Config error handling**: If `configResult.ok === false`, send the error message to the renderer after the window loads. The renderer will display an error state (Phase 05 scope, but the main process sends the message now).

**Window creation**: Keep existing `createWindow()` function, but extract the `BrowserWindow` reference so it can be passed to the IPC bridge and handlers.

#### 4E.2: IPC Handler Registration

Register `ipcMain.handle` for the request channels. These are simple pass-through handlers:

```typescript
import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../core/types'

ipcMain.handle(IPC_CHANNELS.GET_CONFIG, () => configManager.getConfig())
ipcMain.handle(IPC_CHANNELS.SAVE_CONFIG, (_event, config) => configManager.save(config))
ipcMain.handle(IPC_CHANNELS.GET_LANE_PATTERNS, () => cliArgs.lanePatterns)
ipcMain.handle(IPC_CHANNELS.GET_KEY_LEVEL, () => cliArgs.keyLevel)
ipcMain.handle(IPC_CHANNELS.GET_KEY_TIMESTAMP, () => cliArgs.keyTimestamp)
```

#### 4E.3: Maintain macOS Activate Behavior

Keep the existing `app.on('activate', ...)` handler for macOS window re-creation.

---

### Phase 4F: Final Verification

**Goal**: Ensure everything compiles and tests pass.

**Steps**:
1. `npm run typecheck` -- verify TypeScript compilation for both node and web configs
2. `npm test` -- all unit tests pass (including new cli-parser and config-manager tests)
3. Manual smoke test: `echo '{"level":"info","timestamp":"2024-01-01T00:00:00Z","msg":"hello"}' | npm run dev -- --key-level level --key-timestamp timestamp`
   - App should launch without crashing
   - Console in dev tools should show no IPC errors (renderer won't display data yet)

---

## 5. File-by-File Summary

| File | Action | Phase |
|------|--------|-------|
| `src/core/types.ts` | Add `IpcLogLine`, `IPC_CHANNELS`, `ElectronApi` type | 4A |
| `src/main/cli-parser.ts` | Create -- `CliParser` static class + `CliArgs` + `CliValidationError` | 4A |
| `tests/unit/main/cli-parser.test.ts` | Create -- full BDD test suite | 4A |
| `src/main/config-manager.ts` | Create -- `ConfigManager` class + `ConfigLoadResult` | 4B |
| `tests/unit/main/config-manager.test.ts` | Create -- full BDD test suite | 4B |
| `src/main/ipc-bridge.ts` | Create -- `IpcBridge` class + `IpcSender` + `IpcBridgeDeps` | 4C |
| `src/preload/index.ts` | Modify -- implement full `contextBridge` API | 4D |
| `src/preload/electron-api.d.ts` | Create -- TypeScript declaration for `window.api` | 4D |
| `src/main/index.ts` | Modify -- full startup orchestration | 4E |

---

## 6. Implementation Order

```
4A (types + CLI parser + tests)
    |
    v
4B (config manager + tests)
    |
    v
4C (IPC bridge)
    |
    v
4D (preload script)
    |
    v
4E (main process orchestration)
    |
    v
4F (verification: typecheck + test + smoke)
```

Phases 4A and 4B are independent and could be done in parallel, but sequencing them avoids merge conflicts in `types.ts`. Phase 4C depends on 4A (for `IpcLogLine` type and `IPC_CHANNELS`). Phase 4D depends on 4A (for types) and 4C (for channel names). Phase 4E depends on all previous phases.

---

## 7. Technical Considerations

### Electron IPC Serialization
- Data sent via `webContents.send` uses structured clone algorithm
- `Record<string, unknown>` is safe as long as values are JSON-serializable (they are -- they came from `JSON.parse`)
- `Date` objects survive structured clone but we use epoch millis (`number`) for explicitness
- Functions, Symbols, and DOM nodes cannot be cloned (not relevant here)

### Stream Backpressure
- `StdinReader` uses `node:readline` which handles backpressure internally
- The main process sends each line immediately via IPC -- no batching in main
- The renderer's `LogBuffer` (Phase 05) handles batching on the receiving end

### Config Directory Creation
- `node:fs/promises.mkdir(dir, { recursive: true })` is idempotent -- safe to call even if directory exists
- File write should use `writeFile` with `{ encoding: 'utf-8' }` and pretty-print JSON with 2-space indent

### Error Handling
- CLI errors: write to stderr, exit 1 (before Electron app starts)
- Config errors: non-fatal, app runs with defaults, error sent to renderer
- Stdin errors: non-fatal, error sent to renderer, bridge stops reading
- Stream end: normal lifecycle, signal sent to renderer

### Vitest and Electron Imports
- `src/main/` files import from `electron` which is not available in Vitest
- CLI parser: does NOT need Electron imports -- pure TypeScript, fully testable
- Config manager: does NOT need Electron imports -- uses `node:fs/promises`, fully testable
- IPC bridge: imports from `electron` only indirectly (via `IpcSender` abstraction). If we add tests for it, mock the sender.
- Main `index.ts`: NOT unit tested (it's the composition root). Tested via E2E later.

### Path Alias for Tests
- Tests in `tests/unit/main/` need to import from `src/main/`. There is no `@main` path alias currently.
- Options: (a) add `@main` alias to `vitest.config.ts`, or (b) use relative imports like `../../../src/main/cli-parser`
- **Recommendation**: Add `@main` alias to `vitest.config.ts` for consistency with `@core`. This requires NO changes to `tsconfig.node.json` (the tsconfig already includes `src/main/`). Only the vitest config needs the alias.

  Add to `vitest.config.ts`:
  ```typescript
  alias: {
    '@core': resolve('src/core'),
    '@main': resolve('src/main'),
  }
  ```

---

## 8. Testing Strategy

### Unit Tests (this phase)
- **CLI Parser**: ~12-15 test cases covering happy paths, validation failures, edge cases
- **Config Manager**: ~8-10 test cases covering file missing, valid, invalid, merge, save

### Integration Tests (NOT this phase, but designed for)
- The `IpcSender` abstraction enables integration testing of the full main-process pipeline (StdinReader → JsonParser → TimestampDetector → IpcBridge) with a mock sender
- The `ConfigManager` constructor injection enables testing with real filesystem in temp directories

### E2E Tests (future phase)
- Launching the full Electron app with piped stdin and verifying renderer receives data

---

## 9. Open Questions / Decisions for Implementor

1. **Duplicate CLI flags**: When `--key-level` appears twice, should the parser use the last value (lenient) or throw an error (strict)? Recommendation: throw `CliValidationError` -- it's likely a user mistake.

2. **Unknown positional args**: If argv contains values not associated with any flag (e.g. `log-swim-ui foo --key-level level ...`), should the parser throw? Recommendation: yes, throw `CliValidationError`.

3. **Empty `--lanes`**: The spec says `--lanes` is optional. But if `--lanes` is present with no values (e.g. `--lanes --key-level ...`), should it error or treat as no lanes? Recommendation: error -- if you typed `--lanes`, you probably meant to provide patterns.

4. **`ElectronApi` type location**: The `ElectronApi` interface needs to be accessible from both preload and renderer. Options:
   - Put in `src/core/types.ts` (but it references `IpcLogLine` which is already there -- clean)
   - Put in `src/preload/electron-api.d.ts` as an ambient declaration
   - Recommendation: Define the interface in `src/core/types.ts` and export it. Use it in the `.d.ts` file for `window.api` augmentation.

5. **Config file format**: Write with `JSON.stringify(config, null, 2)` for human readability. Trailing newline.
