# Phase 05: UI -- Swimlane Layout, Rows & Modes -- Implementation Plan

## Revision History

| Revision | Date | Trigger | Changes |
|----------|------|---------|---------|
| v1 | 2026-03-01 | Initial plan | Original plan |
| v2 | 2026-03-01 | PLAN_REVIEWER feedback | 3 issues accepted: (1) IPC listener cleanup via unsubscribe return, (2) @renderer vitest alias, (3) LogBuffer.close() on unmount. Also: explicit file location for convertIpcToLogEntry, unparseableEntries cap. |

---

## 1. Problem Understanding

### Goal
Replace the dev-only `DesignReferencePage` with a fully functional renderer that:
1. Receives `IpcLogLine` data from the main process via the preload bridge
2. Converts `IpcLogLine` to `LogEntry` (epoch millis -> Date), classifies into lanes, inserts into `MasterList`
3. Renders a CSS Grid swimlane layout with virtualized rows using `@tanstack/virtual`
4. Supports Live/Scroll mode toggle, stream-ended indicator, unparseable panel, and error states

### Key Constraints
- `@tanstack/react-virtual` must be added as a production dependency
- Renderer receives `IpcLogLine` (timestamp is epoch millis `number`, NOT `Date`)
- `LaneClassifier` runs in renderer, NOT in main process
- All CSS uses tokens from `tokens.css` and component classes from `components.css` -- no hardcoded values, no inline styles
- TypeScript strict mode, no `any`
- State management: React state + context only (no external libraries)
- `LogBuffer` runs in the renderer to batch incoming IPC lines before flushing into `MasterList`
- Existing tests must not be removed or skipped

### Assumptions
- The preload bridge `window.api` is typed via `src/preload/electron-api.d.ts` and available globally
- `LogBuffer` expects `LogEntry` objects (not `IpcLogLine`) -- conversion happens before pushing to buffer
- The "unmatched" lane is implicit (index `=== lanes.length`), not stored in the `LaneDefinition[]` array
- The virtualizer drives row rendering across a **single scroll container** -- rows span multiple grid columns but only render content in their assigned lane column
- For the `vitest` tests of renderer-side utilities (timestamp formatting, etc.), we use `environment: 'node'` since these are pure functions with no DOM dependency

---

## 2. High-Level Architecture

### Component Hierarchy

```
App (root)
 |
 +-- ErrorScreen (full-screen, shown for fatal errors: no stdin, stream error, config error)
 |
 +-- AppToolbar
 |    +-- ModeToggle (Live/Scroll pill)
 |    +-- StreamEndIndicator (conditional)
 |
 +-- SwimLaneGrid (CSS Grid + virtualization)
 |    +-- LaneHeader[] (one per lane + unmatched)
 |    +-- VirtualizedRows (single scroll container, rows span all columns)
 |         +-- LogRow[] (virtual, only visible ones rendered)
 |
 +-- UnparseablePanel (conditional, fixed at bottom)
```

### Data Flow

```
Main Process                    Renderer Process
-----------                    ----------------
stdin
  -> IpcBridge
    -> IPC send(IpcLogLine)  -->  window.api.onLogLine(cb) -> returns unsubscribe fn
                                    -> convertIpcToLogEntry()
                                    -> LaneClassifier.classify()
                                    -> logBuffer.push(entry)
                                    [every flushIntervalMs]:
                                    -> masterList.insertBatch(entries)
                                    -> setVersion(v+1) // trigger re-render
                                    -> if mode==='live': scrollToBottom()

IPC send(stream-end)         -->  window.api.onStreamEnd(cb) -> returns unsubscribe fn
                                    -> logBuffer.close()
                                    -> setStreamEnded(true)

IPC send(stream-error)       -->  window.api.onStreamError(cb) -> returns unsubscribe fn
                                    -> setErrorState(msg)

IPC send(config-error)       -->  window.api.onConfigError(cb) -> returns unsubscribe fn
                                    -> setConfigError(msg)
```

### Key Interfaces/Contracts

The renderer introduces these new concepts:

```typescript
// View mode discriminated union
type ViewMode = 'live' | 'scroll'

// App initialization state (before IPC data starts flowing)
type AppState =
  | { status: 'loading' }                              // waiting for config + cli args
  | { status: 'error'; errorType: AppErrorType; message: string }  // fatal error
  | { status: 'ready' }                               // normal operation

type AppErrorType = 'no-stdin' | 'stream-error' | 'config-error'
```

---

## 3. Implementation Phases

### Sub-phase 5A: Core App Shell + State + IPC Wiring

**Goal**: Wire the renderer to the main process, get data flowing from IPC into MasterList, and handle error states. No visual swimlane layout yet -- just prove the data pipeline works end-to-end.

**Dependencies**: Phases 01-04 complete.

#### Step 1: Add IPC Listener Cleanup to `ElectronApi` Interface

**RATIONALE (from PLAN_REVIEWER feedback)**: The preload API registers listeners via `ipcRenderer.on()` but exposes no unsubscribe mechanism. React strict mode (React 18+) double-mounts in dev, which would cause duplicate IPC listeners. Even though `main.tsx` does not currently use `<StrictMode>`, this is a correctness issue: React effects MUST be cleanable. The standard Electron+React pattern is to have `on*` methods return an unsubscribe function.

**Changes to `src/core/types.ts`** -- Modify `ElectronApi` interface:

```typescript
interface ElectronApi {
  // Push channels (main -> renderer): register callbacks, return unsubscribe function
  onLogLine: (callback: (line: IpcLogLine) => void) => () => void
  onStreamEnd: (callback: () => void) => () => void
  onStreamError: (callback: (error: string) => void) => () => void
  onConfigError: (callback: (error: string) => void) => () => void

  // Request channels (renderer -> main): invoke and await response (unchanged)
  getConfig: () => Promise<AppConfig>
  saveConfig: (config: AppConfig) => Promise<void>
  getCliArgs: () => Promise<CliArgsResult>
}
```

The return type changes from `void` to `() => void` for the four push channel methods.

**Changes to `src/preload/index.ts`** -- Return unsubscribe functions:

Each `on*` method must:
1. Create a wrapper function (to bridge the `(_event, data)` Electron signature to `(data)`)
2. Register it with `ipcRenderer.on(channel, wrapper)`
3. Return a cleanup function that calls `ipcRenderer.removeListener(channel, wrapper)`

Pattern:
```typescript
onLogLine: (callback) => {
  const handler = (_event: Electron.IpcRendererEvent, line: IpcLogLine) => callback(line)
  ipcRenderer.on(IPC_CHANNELS.LOG_LINE, handler)
  return () => ipcRenderer.removeListener(IPC_CHANNELS.LOG_LINE, handler)
},
```

**WHY the wrapper is needed**: `ipcRenderer.removeListener` requires the exact same function reference that was passed to `ipcRenderer.on`. Since we wrap the user callback in `(_event, data) => callback(data)`, we must store that wrapper reference and pass it to `removeListener`.

**Impact on existing code**: This is an additive change. The return type changes from `void` to `() => void`, which is backward-compatible -- any code that previously ignored the return value will continue to work. No existing tests should break.

#### Step 2: Add `@renderer` Path Alias to `vitest.config.ts`

**RATIONALE (from PLAN_REVIEWER feedback)**: The vitest config only has `@core` alias. Tests in `tests/unit/renderer/` will import renderer utilities using `@renderer/` paths for consistency with the project's alias convention (matching `electron.vite.config.ts` and `tsconfig.web.json`).

Add to `vitest.config.ts`:
```typescript
resolve: {
  alias: {
    '@core': resolve('src/core'),
    '@renderer': resolve('src/renderer/src')
  }
}
```

#### Step 3: Install `@tanstack/react-virtual`

```bash
npm install @tanstack/react-virtual
```

This adds it to `dependencies` in `package.json`. The import is `import { useVirtualizer } from '@tanstack/react-virtual'`.

#### Step 4: Create `src/renderer/src/timestamp-formatter.ts`

Pure utility module -- formats timestamps for display. Three formats:

- **`iso`**: `entry.timestamp.toISOString()` (e.g., `2024-01-15T10:30:00.000Z`)
- **`local`**: `entry.timestamp.toLocaleTimeString()` with 24h format, include seconds and millis
- **`relative`**: Offset from the first entry in the MasterList. Format as `+H:MM:SS.mmm` (hours only if >= 1 hour, otherwise `+MM:SS.mmm`)

Interface:
```typescript
function formatTimestamp(timestamp: Date, format: ViewTimestampFormat, firstTimestamp: Date | null): string
```

This is a pure function, easily testable with Vitest in node environment.

#### Step 5: Create `src/renderer/src/ipc-converters.ts` -- Pure Conversion Functions

**RATIONALE (from PLAN_REVIEWER feedback)**: The `convertIpcToLogEntry` function was described inline in the technical considerations but had no explicit file location. Extracting it as a named, exported pure function makes it unit-testable.

This file contains:

```typescript
import type { IpcLogLine, LogEntry, LaneDefinition } from '@core/types'
import { LaneClassifier } from '@core/lane-classifier'

function convertIpcToLogEntry(ipcLine: IpcLogLine, lanes: readonly LaneDefinition[]): LogEntry {
  return {
    rawJson: ipcLine.rawJson,
    fields: ipcLine.fields,
    timestamp: new Date(ipcLine.timestamp),
    level: ipcLine.level,
    laneIndex: LaneClassifier.classify(ipcLine.rawJson, lanes)
  }
}

export { convertIpcToLogEntry }
```

Unit test coverage (in `tests/unit/renderer/ipc-converters.test.ts`):
- GIVEN a valid IpcLogLine with timestamp 1705312200000, WHEN converted, THEN LogEntry.timestamp is a Date matching that epoch
- GIVEN an IpcLogLine matching lane 0 regex, WHEN converted, THEN laneIndex is 0
- GIVEN an IpcLogLine matching no lanes, WHEN converted, THEN laneIndex equals lanes.length (unmatched)
- GIVEN an IpcLogLine with timestamp 0, the CALLER (useLogIngestion) handles this before calling convert -- but convert itself does NOT special-case it (the hook filters before calling)

#### Step 6: Create `src/renderer/src/useAppInit.ts` -- Custom hook for app initialization

This hook encapsulates the async initialization sequence that runs once on mount:

1. Call `window.api.getConfig()` -> returns `AppConfig`
2. Call `window.api.getCliArgs()` -> returns `CliArgsResult`
3. Apply config to CSS: `applyConfigToCSS(config)`
4. Build initial `LaneDefinition[]` from `cliArgs.lanePatterns` using `createLaneDefinition()`
5. Create `MasterList(config.performance.maxLogEntries)`
6. Return `{ config, cliArgs, lanes, masterList }` or `{ error }`

Returns a discriminated union:
```typescript
type InitResult =
  | { status: 'loading' }
  | { status: 'ready'; config: AppConfig; lanes: LaneDefinition[]; masterList: MasterList }
  | { status: 'error'; errorType: AppErrorType; message: string }
```

**Why a hook**: Keeps `App.tsx` clean. The hook uses `useState` + `useEffect` internally. The `MasterList` instance is created inside a `useRef` (or `useState` with initializer) so it survives re-renders.

#### Step 7: Create `src/renderer/src/useLogIngestion.ts` -- Custom hook for IPC log ingestion

This hook wires the `window.api.onLogLine` callback to the data pipeline. It takes `masterList`, `lanes`, and `config` as parameters.

Responsibilities:
1. Create a `LogBuffer` with `config.performance.flushIntervalMs`
2. Register `window.api.onLogLine((ipcLine) => { ... })` to:
   - If `ipcLine.timestamp === 0`, add `ipcLine.rawJson` to unparseable entries list instead of buffer
   - Otherwise, convert via `convertIpcToLogEntry(ipcLine, lanes)` and push the `LogEntry` into the `LogBuffer`
3. The `LogBuffer`'s `onFlush` callback:
   - Calls `masterList.insertBatch(entries)`
   - Increments a `version` counter (triggers re-render via `useState`)
4. Register `window.api.onStreamEnd(() => { logBuffer.close(); setStreamEnded(true) })`
5. Register `window.api.onStreamError((msg) => { setError(msg) })`
6. Register `window.api.onConfigError((msg) => { setConfigError(msg) })`

**CRITICAL: useEffect Cleanup (v2 revision)**

The `useEffect` cleanup function MUST:
1. **Remove all IPC listeners** by calling the unsubscribe functions returned from `window.api.onLogLine()`, `window.api.onStreamEnd()`, `window.api.onStreamError()`, `window.api.onConfigError()`
2. **Close the LogBuffer** by calling `logBuffer.close()` to stop the `setInterval` timer and perform a final flush

Pattern:
```typescript
useEffect(() => {
  const logBuffer = new LogBuffer(
    { flushIntervalMs: config.performance.flushIntervalMs },
    (entries) => { masterList.insertBatch(entries); setVersion(v => v + 1) }
  )

  const unsubLogLine = window.api.onLogLine((ipcLine) => { /* ... */ })
  const unsubStreamEnd = window.api.onStreamEnd(() => { logBuffer.close(); setStreamEnded(true) })
  const unsubStreamError = window.api.onStreamError((msg) => { /* ... */ })
  const unsubConfigError = window.api.onConfigError((msg) => { /* ... */ })

  return () => {
    unsubLogLine()
    unsubStreamEnd()
    unsubStreamError()
    unsubConfigError()
    logBuffer.close()  // idempotent -- safe even if onStreamEnd already called it
  }
}, [masterList, lanes, config])
```

**WHY logBuffer.close() is safe here**: `LogBuffer.close()` is idempotent (documented in log-buffer.ts). If `onStreamEnd` already called `close()`, the cleanup call is a no-op.

**Unparseable entries cap (v2 revision)**: Cap the `unparseableEntries` array at 1000 entries to avoid unbounded memory growth over long sessions. When the cap is reached, stop collecting new unparseable entries (oldest are preserved, newest are dropped). Define `MAX_UNPARSEABLE_ENTRIES = 1000` as a named constant.

Returns:
```typescript
{
  version: number         // incremented on each flush, used as render trigger
  streamEnded: boolean
  error: { type: AppErrorType; message: string } | null
  unparseableEntries: readonly string[]   // raw JSON strings
  mode: ViewMode
  setMode: (mode: ViewMode) => void
}
```

**CRITICAL DESIGN DECISION -- Version counter for re-render**:
The `MasterList` is a mutable object. React does not detect mutations on refs. The `version` state variable is incremented on each buffer flush, which triggers a re-render. The virtualizer then reads from `masterList.length` and `masterList.get(index)` using the fresh count. This is the standard pattern for mutable data sources with React virtualization.

#### Step 8: Create `src/renderer/src/ErrorScreen.tsx`

Full-screen error component for fatal states. Uses existing CSS classes where applicable, adds new CSS classes to `components.css`.

Props:
```typescript
interface ErrorScreenProps {
  readonly errorType: AppErrorType
  readonly message: string
  readonly onRevertConfig?: () => void  // only for config-error
}
```

Error states:
- **`stream-error`**: Shows error message (first line parse failure, timestamp detection failure). No action button.
- **`config-error`**: Shows error message + "Revert to defaults" button. Button calls `window.api.saveConfig(DEFAULT_APP_CONFIG)` then reloads the window.
- **`no-stdin`**: Not actually rendered in the Electron app (process exits at TTY check in main), but included for completeness.

Add to `components.css`:
```css
.error-screen { /* full-screen centered error display */ }
.error-screen__title { /* error heading */ }
.error-screen__message { /* error detail text */ }
.error-screen__action { /* button container */ }
```

#### Step 9: Rewrite `src/renderer/src/App.tsx`

Replace `DesignReferencePage` with the real app shell.

Structure:
```tsx
function App() {
  const init = useAppInit()

  if (init.status === 'loading') return <div className="app-layout">Loading...</div>
  if (init.status === 'error') return <ErrorScreen ... />

  return <AppShell config={init.config} lanes={init.lanes} masterList={init.masterList} />
}
```

The `AppShell` component (can be in the same file or separate) uses `useLogIngestion` and renders:
- Toolbar with `ModeToggle` and `StreamEndIndicator` (placeholder/stub components in 5A)
- A placeholder `<div>` showing entry count and lane count (visual proof that data is flowing)
- Error overlay if runtime error occurs
- `UnparseablePanel` (placeholder/stub in 5A)

**NOTE**: The DesignReferencePage file is NOT deleted -- it remains as a dev reference. The import is simply removed from `App.tsx`.

#### Step 10: Tests for Sub-phase 5A

Create `tests/unit/renderer/timestamp-formatter.test.ts`:
- GIVEN a Date, WHEN format is 'iso', THEN returns ISO string
- GIVEN a Date, WHEN format is 'local', THEN returns local time string
- GIVEN a Date and a firstTimestamp, WHEN format is 'relative', THEN returns "+MM:SS.mmm"
- GIVEN a Date 1h5m after firstTimestamp, WHEN format is 'relative', THEN returns "+1:05:00.000"
- GIVEN a Date equal to firstTimestamp, WHEN format is 'relative', THEN returns "+0:00.000"

Create `tests/unit/renderer/ipc-converters.test.ts`:
- GIVEN a valid IpcLogLine, WHEN converted, THEN LogEntry.timestamp is correct Date
- GIVEN an IpcLogLine matching lane 0, WHEN converted, THEN laneIndex is 0
- GIVEN an IpcLogLine matching no lanes, WHEN converted, THEN laneIndex equals lanes.length

No React component tests in 5A -- those are better covered by E2E in Phase 06. The hooks contain mostly wiring code that is hard to unit test without mocking the entire Electron preload API. The pure functions (`formatTimestamp`, `convertIpcToLogEntry`) get unit tests.

#### Acceptance Criteria -- Sub-phase 5A
- [ ] `@tanstack/react-virtual` is in `package.json` dependencies
- [ ] `ElectronApi` push channel methods return `() => void` (unsubscribe function)
- [ ] `preload/index.ts` returns cleanup functions from all `on*` methods
- [ ] `@renderer` path alias added to `vitest.config.ts`
- [ ] `npm test` passes (all existing + new tests)
- [ ] `npm run typecheck` passes
- [ ] `App.tsx` no longer renders `DesignReferencePage`
- [ ] `useAppInit` hook loads config and CLI args from preload API
- [ ] `applyConfigToCSS` is called during initialization
- [ ] `useLogIngestion` hook converts `IpcLogLine` -> `LogEntry`, classifies, buffers, flushes into MasterList
- [ ] `useLogIngestion` useEffect cleanup removes IPC listeners AND closes LogBuffer
- [ ] Unparseable entries (timestamp === 0) are collected separately, capped at 1000
- [ ] `ErrorScreen` renders for stream-error and config-error states
- [ ] "Revert to defaults" button on config error calls `saveConfig` + reloads
- [ ] `formatTimestamp` function handles all three formats correctly with tests
- [ ] `convertIpcToLogEntry` function is testable and tested
- [ ] Commit at this milestone

---

### Sub-phase 5B: Swimlane Grid + Virtualization + LogRow

**Goal**: Render the actual swimlane grid with virtualized rows, lane headers, expand/collapse, and level colorization.

**Dependencies**: Sub-phase 5A complete.

#### Step 1: Create `src/renderer/src/components/LaneHeader.tsx`

Props:
```typescript
interface LaneHeaderProps {
  readonly pattern: string      // regex pattern string
  readonly isError: boolean     // regex compilation failed
  readonly isUnmatched: boolean // the implicit "unmatched" lane
}
```

Renders using existing CSS classes: `.lane-header`, `.lane-header--error`, `.lane-header--unmatched`, `.lane-header__pattern`.

Behavior:
- Pattern text truncated with `text-overflow: ellipsis` (already in CSS)
- `title` attribute on the pattern span for native tooltip on hover
- No drag handle in Phase 05 (that is Phase 06), but render the `__drag-handle` span as a visual indicator (non-functional, keep the grab cursor for visual consistency -- will be wired in Phase 06)
- If `isError`, apply `.lane-header--error` class
- If `isUnmatched`, apply `.lane-header--unmatched` class, pattern text = "unmatched"

#### Step 2: Create `src/renderer/src/log-row-utils.ts`

Pure utility functions extracted for testability:

```typescript
function getLevelCssClass(level: string): string
function getMessagePreview(entry: LogEntry): string
function getGridColumn(laneIndex: number): number  // returns laneIndex + 1 (CSS grid is 1-indexed)
```

The `getGridColumn` function provides a named, testable mapping from zero-based `laneIndex` to 1-based CSS grid column. This avoids the off-by-one risk called out by the reviewer.

Named constant for the total lane count calculation:
```typescript
function getTotalLaneCount(lanes: readonly LaneDefinition[]): number {
  return lanes.length + 1  // +1 for implicit "unmatched" lane
}
```

Known levels set (defined as a constant):
```typescript
const KNOWN_LOG_LEVELS = new Set(['trace', 'debug', 'info', 'notice', 'warn', 'warning', 'error', 'fatal', 'critical'])
```

Message preview logic:
- If `entry.fields.message` exists and is a string, use it (truncated)
- Else if `entry.fields.msg` exists and is a string, use it (truncated)
- Else show truncated `entry.rawJson`

#### Step 3: Create `src/renderer/src/components/LogRow.tsx`

Props:
```typescript
interface LogRowProps {
  readonly entry: LogEntry
  readonly isExpanded: boolean
  readonly timestampFormat: ViewTimestampFormat
  readonly firstTimestamp: Date | null
  readonly onToggleExpand: () => void
  readonly laneCount: number  // total lanes including unmatched
}
```

Rendering approach -- **this is the most important architectural decision in Phase 05**:

Each virtual row spans ALL grid columns. Content is rendered only in the column matching `entry.laneIndex`. Other columns are empty `<div>` elements.

```
Row (grid-column: 1 / -1, display: grid, grid-template-columns: repeat(N, 1fr))
  [empty] | [empty] | [log content] | [empty]
```

WHY this approach (single virtualizer, full-width rows):
- `@tanstack/virtual` provides one virtualizer per scroll container
- All lanes must scroll together (single scroll container, per spec)
- Each row is a full-width element positioned by the virtualizer
- Inside the row, CSS grid places content in the correct lane column
- This avoids multiple virtualizers or complex column synchronization

Row content structure:
- **Collapsed**: timestamp + message preview (truncated)
- **Expanded**: full pretty-printed JSON with `JSON.stringify(entry.fields, null, 2)`

Level colorization:
- Apply CSS class `log-row--{level}` for known levels
- Apply `log-row--unrecognized` for levels not in the known set

**SIMPLER APPROACH for grid column placement**: Use `gridColumn` on a single child:

```tsx
<div className="log-row-grid" style={{ display: 'grid', gridTemplateColumns: `repeat(${laneCount}, 1fr)` }}>
  <div style={{ gridColumn: getGridColumn(entry.laneIndex) }} className={`log-row log-row--${levelClass}`}>
    <span className="log-row__timestamp">...</span>
    <span className="log-row__message">...</span>
  </div>
</div>
```

This uses CSS Grid's `gridColumn` to place the log row content in the correct lane column. The row wrapper has the same grid template as the swimlane grid. This is clean and explicit.

**WHY inline gridColumn**: The column index is data-driven (from `entry.laneIndex`). There is no way to express this purely in CSS without inline styles or data attributes + nth-child selectors (which would be more complex).

#### Step 4: Create `src/renderer/src/components/SwimLaneGrid.tsx`

This is the main grid component. It combines lane headers, virtualization, and log rows.

Props:
```typescript
interface SwimLaneGridProps {
  readonly masterList: MasterList
  readonly lanes: readonly LaneDefinition[]
  readonly version: number           // render trigger
  readonly timestampFormat: ViewTimestampFormat
  readonly rowHeight: number
  readonly mode: ViewMode
  readonly onScrollUp: () => void    // callback to switch to scroll mode
}
```

Internal state:
- `expandedRowIndex: number | null` -- index of currently expanded row (single expansion)
- `scrollRef: React.RefObject<HTMLDivElement>` -- scroll container ref

Structure:
```
<div className="swimlane-grid" style={gridTemplateColumns}>    // WHY inline style: dynamic column count
  <LaneHeader /> x N
  <div ref={scrollRef} className="swimlane-scroll-container">  // single scroll container
    <div style={{ height: virtualizer.getTotalSize() }}>       // total height spacer
      {virtualRows.map(vRow => (
        <LogRow
          key={vRow.index}
          entry={masterList.get(vRow.index)}
          style={{ position: absolute, top, height }}          // virtualizer positioning
          ...
        />
      ))}
    </div>
  </div>
</div>
```

**NOTE on inline styles**: The virtualizer requires `position: absolute` + `top` + `height` on each virtual row for positioning. This is a `@tanstack/virtual` requirement, not a design choice. The `grid-template-columns` value is also dynamic (based on lane count). These are the ONLY acceptable inline styles. Document with `// WHY: @tanstack/virtual requires absolute positioning for virtual rows` and `// WHY: dynamic lane count requires runtime grid-template-columns`.

**CSS addition to `components.css`**:
```css
.swimlane-scroll-container {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  grid-column: 1 / -1;   /* span all lane columns */
}
```

**Scroll handling for Live mode auto-scroll**:
- After each flush (version change), if `mode === 'live'`, scroll to bottom: `scrollRef.current.scrollTop = scrollRef.current.scrollHeight`
- Use `useEffect` keyed on `[version, mode]`

**Scroll-up detection for auto-switch to Scroll mode**:
- Attach `onScroll` handler to scroll container
- Track `lastScrollTop` in a ref
- If `currentScrollTop < lastScrollTop` and `mode === 'live'`, call `onScrollUp()` (which sets mode to 'scroll' in parent)
- Add a small threshold (e.g., 5px) to avoid false triggers from sub-pixel rendering
- Update `lastScrollTop` after check

**Expand/collapse**:
- When a row is clicked, toggle `expandedRowIndex`
- The virtualizer's `estimateSize` callback returns `config.ui.rowHeight` for collapsed rows
- For expanded rows, we need dynamic sizing. Use `measureElement` from the virtualizer (or a fixed expanded height estimate, then refine)
- PRAGMATIC APPROACH: Use `estimateSize` for the default, and let `@tanstack/virtual`'s `measureElement` handle dynamic row heights when rows are expanded. Each `LogRow` div gets `ref={virtualizer.measureElement}` with `data-index={virtualRow.index}`.

#### Step 5: Wire `SwimLaneGrid` into `App.tsx`

Replace the placeholder `<div>` from Sub-phase 5A with `<SwimLaneGrid>`.

The `AppShell` component now renders:
```
<div className="app-layout">
  <div className="app-toolbar">
    <ModeToggle mode={mode} onModeChange={setMode} />
    {streamEnded && <StreamEndIndicator />}
  </div>
  <div className="app-main">
    <SwimLaneGrid
      masterList={masterList}
      lanes={lanes}
      version={version}
      timestampFormat={config.ui.viewTimestampFormat}
      rowHeight={config.ui.rowHeight}
      mode={mode}
      onScrollUp={() => setMode('scroll')}
    />
  </div>
  {unparseableEntries.length > 0 && <UnparseablePanel entries={unparseableEntries} />}
</div>
```

#### Step 6: Tests for Sub-phase 5B

Create `tests/unit/renderer/log-row-utils.test.ts`:
- GIVEN a level 'error', WHEN getLevelCssClass is called, THEN returns 'log-row--error'
- GIVEN a level 'WARN', WHEN getLevelCssClass is called with lowercase, THEN returns 'log-row--warn'
- GIVEN an unknown level 'custom', WHEN getLevelCssClass is called, THEN returns 'log-row--unrecognized'
- GIVEN entry.fields has 'message', WHEN getMessagePreview is called, THEN returns the message value
- GIVEN entry.fields has 'msg' but not 'message', WHEN getMessagePreview is called, THEN returns the msg value
- GIVEN entry.fields has neither, WHEN getMessagePreview is called, THEN returns truncated rawJson
- GIVEN laneIndex 0, WHEN getGridColumn is called, THEN returns 1
- GIVEN laneIndex equals lanes.length (unmatched), WHEN getGridColumn is called, THEN returns lanes.length + 1
- GIVEN 3 lane definitions, WHEN getTotalLaneCount is called, THEN returns 4

**NOTE**: Extract `getLevelCssClass(level: string): string`, `getMessagePreview(entry: LogEntry): string`, `getGridColumn(laneIndex: number): number`, and `getTotalLaneCount(lanes)` as pure utility functions in `src/renderer/src/log-row-utils.ts` so they are unit-testable.

#### Acceptance Criteria -- Sub-phase 5B
- [ ] `SwimLaneGrid` renders correct number of columns based on lane count
- [ ] Lane headers show regex pattern (truncated with title tooltip)
- [ ] Invalid regex lanes show error styling
- [ ] "unmatched" lane header appears last with italic styling
- [ ] Log rows appear in the correct lane column (other columns empty)
- [ ] Log row left border colored by level (all standard levels + unrecognized=orange)
- [ ] Timestamp formatted according to config (iso/local/relative)
- [ ] Click on row expands to show full pretty-printed JSON
- [ ] Click again collapses expanded row
- [ ] Virtualization works: DOM node count stays bounded regardless of total entries
- [ ] Auto-scroll in Live mode works after flush
- [ ] Scrolling up triggers switch to Scroll mode
- [ ] `npm test` passes (all existing + new tests)
- [ ] `npm run typecheck` passes
- [ ] Commit at this milestone

---

### Sub-phase 5C: ModeToggle + StreamEndIndicator + UnparseablePanel

**Goal**: Complete all remaining UI components: the mode toggle, stream-ended indicator, and unparseable panel.

**Dependencies**: Sub-phase 5B complete.

#### Step 1: Create `src/renderer/src/components/ModeToggle.tsx`

Props:
```typescript
interface ModeToggleProps {
  readonly mode: ViewMode
  readonly onModeChange: (mode: ViewMode) => void
}
```

Uses existing CSS classes: `.mode-toggle`, `.mode-toggle__option`, `.mode-toggle__option--active`.

Behavior:
- Two buttons: "Live" and "Scroll"
- Active button gets `mode-toggle__option--active` class
- Clicking "Live" calls `onModeChange('live')` -- the parent handles scrolling to bottom
- Clicking "Scroll" calls `onModeChange('scroll')`

#### Step 2: Create `src/renderer/src/components/StreamEndIndicator.tsx`

No props (or just `readonly visible: boolean` for conditional rendering at parent level).

Uses existing CSS classes: `.stream-ended`, `.stream-ended__dot`.

Renders a small badge: dot + "Stream ended" text.

#### Step 3: Create `src/renderer/src/components/UnparseablePanel.tsx`

Props:
```typescript
interface UnparseablePanelProps {
  readonly entries: readonly string[]  // raw JSON strings that failed timestamp parse
}
```

Uses existing CSS classes: `.unparseable-panel`, `.unparseable-panel__header`, `.unparseable-panel__badge`, `.unparseable-panel__row`.

Behavior:
- Shows count badge with `entries.length`
- Lists each raw JSON string in a scrollable panel
- Panel has `max-height` from token `--unparseable-panel-max-height` (already in CSS)
- Only rendered when `entries.length > 0` (conditional rendering in parent)

#### Step 4: Wire Live mode scroll-to-bottom on mode change

In `SwimLaneGrid` or `AppShell`, when mode changes from 'scroll' to 'live':
- Scroll to bottom immediately: `scrollRef.current.scrollTop = scrollRef.current.scrollHeight`
- Use a `useEffect` keyed on `mode` to trigger this

#### Step 5: Add CSS classes for ErrorScreen to `components.css`

```css
.error-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  padding: var(--space-8);
  text-align: center;
}

.error-screen__icon {
  font-size: var(--text-2xl);
  color: var(--color-error);
  margin-bottom: var(--space-4);
}

.error-screen__title {
  font-size: var(--text-xl);
  font-weight: var(--weight-semibold);
  color: var(--color-text-primary);
  margin-bottom: var(--space-2);
}

.error-screen__message {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  max-width: 600px;
  margin-bottom: var(--space-6);
  word-break: break-word;
}

.error-screen__action-btn {
  padding: var(--space-2) var(--space-6);
  background-color: var(--color-primary);
  color: var(--color-grey-50);
  border: none;
  border-radius: var(--border-radius-md);
  font-size: var(--text-base);
  font-weight: var(--weight-medium);
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

.error-screen__action-btn:hover {
  background-color: var(--color-primary-hover);
}
```

#### Step 6: Tests for Sub-phase 5C

No new unit tests for simple presentational components (ModeToggle, StreamEndIndicator, UnparseablePanel). These are thin wrappers around CSS classes with trivial logic. They will be covered by E2E/screenshot tests in Phase 06.

However, verify the scroll-up detection logic if extracted:

Create or extend `tests/unit/renderer/scroll-utils.test.ts`:
- GIVEN lastScrollTop=100 and currentScrollTop=80, WHEN isScrollingUp is checked, THEN returns true
- GIVEN lastScrollTop=100 and currentScrollTop=102, WHEN isScrollingUp is checked, THEN returns false
- GIVEN lastScrollTop=100 and currentScrollTop=98, WHEN diff < threshold(5), THEN returns false

**NOTE**: Extract scroll-up detection as a pure function `isScrollingUp(lastTop: number, currentTop: number, threshold: number): boolean` in a `src/renderer/src/scroll-utils.ts` file. The PLAN_REVIEWER suggested inlining this as a simplification, and the implementor may choose to inline it if they prefer -- both approaches are acceptable.

#### Acceptance Criteria -- Sub-phase 5C
- [ ] ModeToggle renders pill-shaped toggle with Live/Scroll options
- [ ] Active mode button has `mode-toggle__option--active` class
- [ ] Clicking Live mode scrolls to bottom
- [ ] Clicking Scroll mode freezes scroll position
- [ ] Scrolling up auto-switches from Live to Scroll
- [ ] StreamEndIndicator appears when stream ends
- [ ] UnparseablePanel appears when there are unparseable entries, hidden when none
- [ ] UnparseablePanel shows count badge and scrollable list of raw JSON
- [ ] ErrorScreen shows for stream-error with error message
- [ ] ErrorScreen shows for config-error with "Revert to defaults" button
- [ ] "Revert to defaults" saves DEFAULT_APP_CONFIG and reloads
- [ ] `npm test` passes (all existing + new tests)
- [ ] `npm run typecheck` passes
- [ ] Commit at this milestone

---

## 4. Technical Considerations

### 4.1 IpcLogLine to LogEntry Conversion

This is a critical transformation that happens in the renderer. The function lives in `src/renderer/src/ipc-converters.ts` (see Sub-phase 5A, Step 5).

**Edge case**: If `ipcLine.timestamp === 0`, the entry has an unparseable timestamp. These entries should NOT be inserted into the MasterList (which sorts by timestamp). Instead, their `rawJson` is collected in a separate `unparseableEntries` list and displayed in the `UnparseablePanel`. The filtering happens in `useLogIngestion`, BEFORE calling `convertIpcToLogEntry`.

### 4.2 Virtualization Strategy

Using `@tanstack/react-virtual`'s `useVirtualizer`:

```typescript
const virtualizer = useVirtualizer({
  count: masterList.length,
  getScrollElement: () => scrollRef.current,
  estimateSize: () => rowHeight,           // collapsed row height
  overscan: 10,                            // render 10 extra rows outside viewport
  measureElement: (el) => el.getBoundingClientRect().height  // for dynamic expanded rows
})
```

The `count` changes on each flush (keyed on `version`). The virtualizer automatically adjusts.

### 4.3 Performance: Flush-Triggered Re-render

The `LogBuffer` flushes at `flushIntervalMs` (default 200ms). Each flush:
1. Inserts batch into MasterList
2. Increments `version` state
3. React re-renders `SwimLaneGrid`
4. Virtualizer recalculates with new `count`
5. Only visible rows (~50-100) are rendered

This means React re-renders at most 5 times/second (200ms interval). Each render only touches the visible rows. This is efficient.

### 4.4 Relative Timestamp Formatting

```
diffMs = timestamp.getTime() - firstTimestamp.getTime()
hours = Math.floor(diffMs / 3_600_000)
minutes = Math.floor((diffMs % 3_600_000) / 60_000)
seconds = Math.floor((diffMs % 60_000) / 1000)
millis = diffMs % 1000

if hours > 0: "+{hours}:{minutes:02d}:{seconds:02d}.{millis:03d}"
else:         "+{minutes}:{seconds:02d}.{millis:03d}"
```

### 4.5 CSS Grid: Dynamic Column Count

The `grid-template-columns` must be set dynamically based on lane count:

```typescript
// WHY: dynamic lane count requires runtime grid-template-columns
const gridStyle = { gridTemplateColumns: `repeat(${getTotalLaneCount(lanes)}, 1fr)` }
```

Use `getTotalLaneCount(lanes)` (from `log-row-utils.ts`) to avoid duplicating the `lanes.length + 1` calculation.

Alternative: set a CSS custom property `--lane-count` on the element and use `repeat(var(--lane-count), 1fr)` in CSS. PREFER the CSS custom property approach for consistency with the design system:

```typescript
const gridRef = useRef<HTMLDivElement>(null)
useEffect(() => {
  gridRef.current?.style.setProperty('--lane-count', String(getTotalLaneCount(lanes)))
}, [lanes.length])
```

Then in CSS (already partially there in `.swimlane-grid`):
```css
.swimlane-grid {
  grid-template-columns: repeat(var(--lane-count), 1fr);
}
```

### 4.6 Row Rendering in Grid Columns

Each log row is a full-width element (spans all columns). Inside it, the content is placed in the correct column using CSS Grid's `gridColumn`.

Use `getGridColumn(entry.laneIndex)` from `log-row-utils.ts` which returns `laneIndex + 1` (CSS grid columns are 1-indexed). This provides a single, named, tested location for the off-by-one-prone calculation.

```tsx
<div className="log-row-grid" style={{ display: 'grid', gridTemplateColumns: `repeat(${laneCount}, 1fr)` }}>
  <div style={{ gridColumn: getGridColumn(entry.laneIndex) }} className={`log-row log-row--${levelClass}`}>
    <span className="log-row__timestamp">...</span>
    <span className="log-row__message">...</span>
  </div>
</div>
```

**WHY inline gridColumn**: The column index is data-driven (from `entry.laneIndex`). There is no way to express this purely in CSS without inline styles or data attributes + nth-child selectors (which would be more complex).

### 4.7 Error Handling Strategy

| Error | Source | Handling |
|-------|--------|----------|
| No stdin pipe | Main process (TTY check) | Process exits before window creation. Not handled in renderer. |
| First line not JSON | IPC `stream-error` | Full-screen `ErrorScreen` with message |
| Timestamp detection failure | IPC `stream-error` | Full-screen `ErrorScreen` with message |
| Stream read error | IPC `stream-error` | Full-screen `ErrorScreen` with message |
| Config validation error | IPC `config-error` | Full-screen `ErrorScreen` with "Revert to defaults" button |
| Subsequent line not JSON | Silently skipped by IpcBridge | No renderer impact |
| Subsequent unparseable timestamp | `timestamp === 0` in IpcLogLine | Added to UnparseablePanel |

### 4.8 IPC Listener Lifecycle (v2 addition)

The IPC listener lifecycle follows this pattern:

1. **Registration**: `useLogIngestion` `useEffect` registers all four IPC listeners on mount
2. **Active**: Listeners process incoming data during the component's lifetime
3. **Cleanup**: `useEffect` cleanup function removes all listeners AND closes LogBuffer
4. **React Strict Mode Safety**: In dev mode with strict mode, the effect runs mount -> cleanup -> mount. The cleanup properly removes the first set of listeners, and the second mount registers fresh ones. No duplicate processing.

The `LogBuffer` lifecycle is tied to the `useEffect`:
- Created at the start of the effect body
- Closed in the cleanup function (idempotent)
- Also closed when `onStreamEnd` fires (normal termination)

---

## 5. File-by-File Breakdown

### New Files

| File | Sub-phase | Purpose |
|------|-----------|---------|
| `src/renderer/src/timestamp-formatter.ts` | 5A | Pure function: format Date for display |
| `src/renderer/src/ipc-converters.ts` | 5A | Pure function: IpcLogLine -> LogEntry conversion |
| `src/renderer/src/useAppInit.ts` | 5A | Hook: async init (config + CLI args + MasterList) |
| `src/renderer/src/useLogIngestion.ts` | 5A | Hook: IPC callbacks + LogBuffer + version counter |
| `src/renderer/src/ErrorScreen.tsx` | 5A | Full-screen error component |
| `src/renderer/src/log-row-utils.ts` | 5B | Pure functions: level CSS class, message preview, grid column |
| `src/renderer/src/scroll-utils.ts` | 5C | Pure function: scroll-up detection (optional -- may inline) |
| `src/renderer/src/components/LaneHeader.tsx` | 5B | Lane header with regex pattern |
| `src/renderer/src/components/LogRow.tsx` | 5B | Virtualized log row with expand/collapse |
| `src/renderer/src/components/SwimLaneGrid.tsx` | 5B | CSS Grid + virtualization container |
| `src/renderer/src/components/ModeToggle.tsx` | 5C | Live/Scroll pill toggle |
| `src/renderer/src/components/StreamEndIndicator.tsx` | 5C | Stream ended badge |
| `src/renderer/src/components/UnparseablePanel.tsx` | 5C | Bottom panel for unparseable entries |
| `tests/unit/renderer/timestamp-formatter.test.ts` | 5A | Tests for timestamp formatting |
| `tests/unit/renderer/ipc-converters.test.ts` | 5A | Tests for IpcLogLine -> LogEntry conversion |
| `tests/unit/renderer/log-row-utils.test.ts` | 5B | Tests for level CSS class, message preview, grid column |
| `tests/unit/renderer/scroll-utils.test.ts` | 5C | Tests for scroll-up detection (if extracted) |

### Modified Files

| File | Sub-phase | Changes |
|------|-----------|---------|
| `src/core/types.ts` | 5A | `ElectronApi` push channel methods return `() => void` instead of `void` |
| `src/preload/index.ts` | 5A | Store handler wrapper, return unsubscribe function from each `on*` method |
| `vitest.config.ts` | 5A | Add `@renderer` path alias |
| `package.json` | 5A | Add `@tanstack/react-virtual` to dependencies |
| `src/renderer/src/App.tsx` | 5A, 5B | Replace DesignReferencePage with real app shell |
| `src/renderer/theme/components.css` | 5A, 5C | Add `.error-screen*`, `.swimlane-scroll-container` classes |
| `src/renderer/src/main.tsx` | -- | No changes needed |
| `src/renderer/theme/tokens.css` | -- | No changes needed (all tokens already exist) |

### Files NOT Modified (beyond the above)

| File | Why |
|------|-----|
| `src/core/master-list.ts` | Already complete |
| `src/core/log-buffer.ts` | Already complete |
| `src/core/lane-classifier.ts` | Already complete |
| `src/main/index.ts` | Already complete |
| `src/main/ipc-bridge.ts` | Already complete |
| `src/renderer/src/DesignReferencePage.tsx` | Keep as dev reference, just remove import from App.tsx |

---

## 6. Testing Strategy

### Unit Tests (Vitest)

All tests use BDD GIVEN/WHEN/THEN style with explicit imports.

| Test File | What it Tests |
|-----------|---------------|
| `tests/unit/renderer/timestamp-formatter.test.ts` | `formatTimestamp()` for iso, local, relative |
| `tests/unit/renderer/ipc-converters.test.ts` | `convertIpcToLogEntry()` -- timestamp conversion, lane classification, edge cases |
| `tests/unit/renderer/log-row-utils.test.ts` | `getLevelCssClass()`, `getMessagePreview()`, `getGridColumn()`, `getTotalLaneCount()` |
| `tests/unit/renderer/scroll-utils.test.ts` | `isScrollingUp()` with threshold (if extracted) |

### Integration Testing (Manual / Dev Mode)

After each sub-phase, verify visually with `npm run dev` piping sample JSON:
```bash
echo '{"level":"info","timestamp":"2024-01-15T10:30:00.000Z","message":"hello"}' | npm run dev -- --key-level level --key-timestamp timestamp --lanes "error" "info"
```

### E2E Tests

E2E visual tests are explicitly deferred to Phase 06 per the task spec. Phase 05 focuses on getting the components working; Phase 06 adds Playwright E2E tests with screenshots.

### Vitest Config Note

The vitest config uses `environment: 'node'`. All renderer tests in this phase are pure function tests that do not require DOM. If a future test needs `jsdom`, the test file can use `// @vitest-environment jsdom` pragma, or a separate vitest config can be created. For Phase 05, `node` environment is sufficient.

---

## 7. Dependency Installation

```bash
npm install @tanstack/react-virtual
```

No other dependencies needed. The project already has React 19, TypeScript, Vitest, and all other tools.

---

## 8. Open Questions / Decisions Needed

### Resolved During Planning

1. **Single virtualizer vs. per-lane virtualizer**: Single virtualizer over MasterList. All lanes scroll together. Rows span full width and place content in the correct column. This is simpler and aligns with the spec requirement of "single scroll container -- all lanes scroll together."

2. **Expanded row height**: Use `@tanstack/virtual`'s `measureElement` for dynamic row heights. The virtualizer measures the actual DOM element after render. No need to pre-calculate expanded height.

3. **Where to run LaneClassifier**: In the renderer, during `IpcLogLine` to `LogEntry` conversion. This is per spec and keeps the main process lean.

4. **State management**: React state + hooks. No Context needed in Phase 05 -- all state lives in `App.tsx` / `AppShell` and is passed down as props. Context may be introduced in Phase 06/07 if prop drilling becomes excessive, but for Phase 05's component tree depth (~3 levels), direct props are simpler and more explicit.

5. **IPC listener cleanup** (v2): Push channel methods in `ElectronApi` return unsubscribe functions. This follows the standard Electron+React pattern and ensures correct cleanup in `useEffect`.

6. **LogBuffer cleanup** (v2): `logBuffer.close()` is called in `useEffect` cleanup. This is idempotent and prevents timer leaks.

7. **convertIpcToLogEntry location** (v2): Extracted to `src/renderer/src/ipc-converters.ts` as a named, exported, testable pure function.

### Remaining Open Questions

None -- all requirements are clear from the task spec and high-level design.

---

## 9. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| `@tanstack/virtual` row measurement with CSS Grid nested grids | Medium | Medium | Test with expanded rows early. Fall back to fixed expanded height estimate if measurement is unreliable. |
| Scroll-up detection triggers falsely on momentum scroll | Medium | Low | Use threshold (5px) and debounce. Adjust threshold based on manual testing. |
| Performance with 20K entries in MasterList | Low | High | MasterList uses binary search insert. Virtualizer only renders visible rows. LogBuffer batches at 200ms. This design is inherently performant. |
| Preload API type safety (`window.api`) | Low | Medium | Already typed via `electron-api.d.ts`. TypeScript strict mode catches mismatches at compile time. |
| IPC listener leak in React strict mode | Low (after fix) | High | Fixed in v2: `on*` methods return unsubscribe functions, cleanup in `useEffect` teardown. |
| LogBuffer timer leak on unmount | Low (after fix) | Medium | Fixed in v2: `logBuffer.close()` in `useEffect` cleanup. Idempotent. |
