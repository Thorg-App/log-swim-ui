# PLANNER Private Context -- Phase 05

## Plan Iteration History

### v1 -> v2 (PLAN_REVIEWER feedback)

**3 issues raised, all 3 accepted:**

1. **BLOCKER -- IPC Listener Cleanup (ACCEPTED)**
   - The reviewer correctly identified that `ipcRenderer.on()` with no unsubscribe mechanism is a correctness bug.
   - Even though `main.tsx` does NOT currently use `<StrictMode>`, this is still the right fix: (a) StrictMode should be added eventually, (b) React effects MUST be cleanable by contract, (c) if `useLogIngestion` ever remounts for any reason (parent key change, error boundary recovery), listeners would double without cleanup.
   - Changed `ElectronApi` push channel return types from `void` to `() => void`.
   - Changed `preload/index.ts` to store handler wrappers and return cleanup functions.
   - Moved `types.ts` and `preload/index.ts` from "Files NOT Modified" to "Modified Files" table.

2. **MAJOR -- @renderer vitest alias (ACCEPTED)**
   - Straightforward. Added to Step 2 of Sub-phase 5A.
   - Matches the alias in `electron.vite.config.ts` and `tsconfig.web.json`.

3. **MAJOR -- LogBuffer.close() on unmount (ACCEPTED)**
   - LogBuffer creates a `setInterval` in constructor. If the component unmounts without calling `close()`, the timer leaks.
   - Added explicit `logBuffer.close()` to the `useEffect` cleanup in `useLogIngestion`.
   - `LogBuffer.close()` is idempotent (documented in source), so calling it in cleanup is safe even if `onStreamEnd` already called it.

**Additional changes incorporated from PLAN_REVIEWER minor suggestions:**

4. `convertIpcToLogEntry` now has an explicit file location (`src/renderer/src/ipc-converters.ts`) and its own test file.

5. Added `MAX_UNPARSEABLE_ENTRIES = 1000` cap to the unparseable entries collection.

6. Added `getGridColumn()` and `getTotalLaneCount()` helper functions to `log-row-utils.ts` to prevent off-by-one errors in grid column calculations.

**Rejected/deferred suggestions:**

- The reviewer suggested inlining `isScrollingUp` as a simplification. I kept the extraction as-is in the plan but added a note that the implementor may choose to inline it. Both approaches are fine.

- The reviewer's suggestion about `ErrorScreen.onRevertConfig` being self-contained vs. prop was explicitly acknowledged as a matter of taste. No change.

## Key Observations from Codebase Exploration

### Types Already Complete
All types needed for Phase 05 exist in `src/core/types.ts`:
- `IpcLogLine` (timestamp: number epoch ms, level: string)
- `LogEntry` (timestamp: Date, laneIndex: mutable number)
- `LaneDefinition` (pattern, regex, isError) + `createLaneDefinition()` factory
- `AppConfig` (colors, ui, performance subsections)
- `CliArgsResult` (keyLevel, keyTimestamp, lanePatterns)
- `ViewTimestampFormat` ('iso' | 'local' | 'relative')
- `ElectronApi` (preload bridge contract) -- **WILL BE MODIFIED in 5A (return types)**
- `DEFAULT_APP_CONFIG` constant

### CSS Design System Complete
- `tokens.css`: 96 tokens covering colors, spacing, typography, shadows, borders, layout, transitions
- `components.css`: All component classes pre-built: `.log-row`, `.lane-header`, `.swimlane-grid`, `.mode-toggle`, `.stream-ended`, `.unparseable-panel`, etc.
- Missing: `.error-screen*` classes and `.swimlane-scroll-container` -- need to add these

### Preload API Already Wired -- WILL BE MODIFIED
- `src/preload/index.ts` exposes `window.api` via `contextBridge`
- Push channels: `onLogLine`, `onStreamEnd`, `onStreamError`, `onConfigError`
- Request channels: `getConfig`, `saveConfig`, `getCliArgs`
- Typed via `src/preload/electron-api.d.ts` on `Window`
- **v2 CHANGE**: Push channels will return `() => void` unsubscribe functions

### React StrictMode Status
- `main.tsx` does NOT currently use `<StrictMode>` -- renders `<App />` directly
- The IPC cleanup fix is still correct regardless -- effects must be cleanable by contract

### applyConfigToCSS Exists But Not Called
- Function in `src/renderer/src/applyConfigToCSS.ts` maps config to CSS custom properties
- Uses its own local interfaces (`PartialConfig`, `ConfigColors`, `ConfigUI`)
- NOT yet called by renderer -- Phase 05 must wire it in `useAppInit`
- NOTE: The local interfaces in applyConfigToCSS.ts are slightly different from AppConfig (uses PartialConfig). This is fine -- the function accepts a subset. Pass `config` directly; TypeScript structural typing handles the mismatch.

### IpcBridge Pipeline
- Main process: stdin -> StdinReader -> JsonParser -> TimestampDetector -> IPC send(IpcLogLine)
- IpcBridge does NOT classify lanes -- sends raw IpcLogLine
- Renderer must: convert IpcLogLine->LogEntry, classify via LaneClassifier, buffer via LogBuffer, insert into MasterList

### LogBuffer Expects LogEntry
- `LogBuffer.push(entry: LogEntry)` -- the conversion from IpcLogLine must happen BEFORE pushing
- LogBuffer owns its timer; creates interval in constructor
- `onFlush` callback receives `readonly LogEntry[]`
- **v2 NOTE**: `close()` is idempotent -- safe to call multiple times

### MasterList Quirks
- `insertBatch` inserts one-by-one with binary search (could be optimized but fine for Phase 05 volumes)
- `entries` property returns `readonly LogEntry[]` for re-classification
- Eviction removes from front (oldest)

### LaneClassifier Quirks
- `classify()` tests regex against FULL rawJson string (not individual fields)
- Returns `lanes.length` for unmatched (not -1)
- `reclassifyAll()` mutates `laneIndex` in place

### DesignReferencePage
- Large file with visual swatches and component previews
- Uses inline styles in a few places (swatch colors, spacing bars) -- acceptable for dev-only page
- DO NOT DELETE -- keep as dev reference, just stop importing in App.tsx
- `design-reference.css` is imported INSIDE DesignReferencePage.tsx, so it tree-shakes out when the component is not imported

### Vitest Config
- `environment: 'node'` -- no jsdom by default
- Path alias: `@core` -> `src/core`
- **v2 CHANGE**: Will add `@renderer` -> `src/renderer/src` alias

### tsconfig.web.json
- Includes `src/renderer/src/**/*` and `src/core/**/*`
- Excludes `src/core/stdin-reader.ts` (Node.js only)
- Has path aliases: `@renderer/*` -> `src/renderer/src/*`, `@core/*` -> `src/core/*`
- New renderer files in `src/renderer/src/` are automatically included

## Architectural Decisions Made

### Single Virtualizer Approach
Using one `useVirtualizer` instance over the MasterList. Rows span all columns in a CSS Grid. Content is placed in the correct column via `gridColumn`. This avoids:
- Multiple synchronized virtualizers (complex, error-prone)
- Manual scroll synchronization between columns
- Per-column scroll containers

### Version Counter Pattern
MasterList is mutable. React needs a signal to re-render. Using a simple `version` state counter incremented on each LogBuffer flush. This is the standard pattern for external mutable stores with React.

### No React Context in Phase 05
Props are passed max 3 levels deep (App -> SwimLaneGrid -> LogRow). Context would add indirection without benefit. Context can be introduced in Phase 06/07 if needed.

### Inline Styles Policy
Only THREE cases of inline styles are acceptable:
1. `gridTemplateColumns` on swimlane grid (dynamic lane count) -- OR use CSS custom property `--lane-count`
2. Virtual row positioning (`position: absolute`, `top`, `height`) -- required by @tanstack/virtual
3. `gridColumn` on log row content to place in correct lane column

All other styling uses CSS classes from components.css.

### IPC Listener Cleanup (v2)
Push channel methods return unsubscribe functions. Standard Electron+React pattern. Cleanup happens in `useEffect` teardown.

### LogBuffer Lifecycle (v2)
LogBuffer is created in `useEffect` body, closed in cleanup. Also closed on `onStreamEnd`. Both paths are idempotent.

## Potential Issues to Watch

1. **CSS Grid + Virtual Rows**: The virtualizer positions rows absolutely. They must span all grid columns. Verify that `grid-column: 1 / -1` works with absolutely positioned children inside a grid container.
   - LIKELY SOLUTION: The scroll container is a separate div that spans all columns and uses `position: relative`. Virtual rows are absolutely positioned within it. The grid is only for the headers row.

2. **LogRow expanded height measurement**: @tanstack/virtual's measureElement needs the row to be rendered in the DOM first, then measures it. On first expand, there might be a brief layout shift.
   - ACCEPTABLE: Minor visual artifact on first expand. Not worth over-engineering.

3. **applyConfigToCSS type mismatch**: The function takes `PartialConfig` which has optional `colors` and `ui`. `AppConfig` has required fields. TypeScript structural typing should allow passing `AppConfig` where `PartialConfig` is expected (AppConfig is a subtype).

4. **Scroll-to-bottom timing in Live mode**: Must scroll AFTER React has committed the new rows to DOM. Use `useEffect` or `requestAnimationFrame` after the flush-triggered re-render.

## Implementation Order Notes

The sub-phases are designed so each produces a committable, working state:
- 5A: Data flows from IPC to MasterList, error states work, but no visual grid yet
- 5B: Full visual rendering with grid, virtualization, rows -- the main deliverable
- 5C: Polish components (mode toggle, stream indicator, unparseable panel)

The implementor should commit after each sub-phase.
