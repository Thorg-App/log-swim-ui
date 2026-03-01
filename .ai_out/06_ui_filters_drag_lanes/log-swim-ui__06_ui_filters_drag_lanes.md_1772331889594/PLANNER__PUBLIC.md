# Phase 06 Implementation Plan: UI Filters, Drag & Lane Management

## 1. Problem Understanding

### Goal
Add three interactive features to the swimlane UI plus E2E test coverage:
1. **Global Filter Bar** -- AND-logic filtering across all lanes (field filters + raw regex filters)
2. **Ad-hoc Lane Addition** -- runtime regex lane input, inserted before "unmatched"
3. **Draggable Lane Reordering** -- HTML5 drag-and-drop on lane headers, triggers full re-classification
4. **E2E Tests** -- Playwright tests for core user flows

### Key Constraints
- Filter state lives at the App level; filtering is a render-time operation (does not mutate MasterList)
- Lane order is mutable at runtime; lane changes trigger `LaneClassifier.reclassifyAll()` + version bump
- Ad-hoc lanes are session-only (not persisted to config)
- "Unmatched" lane is always last, cannot be dragged
- All existing tests must continue to pass
- Re-classification is O(n * m) -- acceptable for 20K entries * <10 lanes

### Assumptions
- No external drag-and-drop library needed; HTML5 DnD API is sufficient
- Filter regex compilation is debounced; filter application is not (filtering a 20K array is fast)
- New log entries arriving during a filtered view use the current lane order
- Filter bar is always visible (even when empty -- shows "+" button)

---

## 2. High-Level Architecture

### Data Flow Changes

```
BEFORE (Phase 05):
  useAppInit → lanes (static), masterList, config
  useLogIngestion → version counter, IPC wiring
  SwimLaneGrid → render all entries from masterList

AFTER (Phase 06):
  useAppInit → initialLanes, masterList, config
  App.tsx → lanes (mutable state), filters (state)
  useLogIngestion → version counter, IPC wiring (uses current lanes ref)
  SwimLaneGrid → render filtered entries from masterList
```

### State Ownership

```
App.tsx (AppShell)
  ├── lanes: LaneDefinition[]         [state] -- lifted from useAppInit (now mutable)
  ├── filters: Filter[]               [state] -- new filter state
  ├── lanesRef: MutableRefObject      [ref]   -- current lanes for IPC callback
  ├── useLogIngestion(masterList, lanesRef, config)
  │   └── version, streamEnded, error, mode, setMode, bumpVersion
  ├── FilterBar                        [component] -- manages filter CRUD
  ├── LaneAddInput                     [component] -- adds lanes
  └── SwimLaneGrid                     [component] -- applies filters at render time
        ├── LaneHeader (draggable)
        └── LogRow (filtered)
```

### Component Tree (Phase 06)

```
App
  └── AppShell
        ├── .app-toolbar
        │     ├── ModeToggle
        │     ├── StreamEndIndicator
        │     └── LaneAddInput         [NEW]
        ├── FilterBar                   [NEW]
        │     ├── FilterChip (per filter)  [NEW]
        │     └── FilterAddButton
        ├── .app-main
        │     └── SwimLaneGrid          [MODIFIED]
        │           ├── LaneHeader      [MODIFIED -- drag events]
        │           └── LogRow
        └── UnparseablePanel
```

---

## 3. Implementation Phases

### Phase 6A: Core Filter Types + Logic + Unit Tests

**Goal**: Implement pure filter logic in `src/core/` with full unit test coverage. No UI changes yet.

**New File**: `src/core/filter.ts`

#### Types

```typescript
// Filter type discriminated union
interface FieldFilter {
  readonly id: string
  readonly type: 'field'
  readonly field: string        // JSON field name to match against
  readonly pattern: string      // user-entered pattern string
  readonly regex: RegExp | null // compiled regex (null if invalid)
  readonly enabled: boolean
}

interface RawFilter {
  readonly id: string
  readonly type: 'raw'
  readonly pattern: string
  readonly regex: RegExp | null
  readonly enabled: boolean
}

type Filter = FieldFilter | RawFilter
```

**Design Decision**: Use discriminated union (`FieldFilter | RawFilter`) rather than a single interface with optional `field`. This is cleaner for pattern matching and type narrowing. The `id` field uses a simple incrementing counter (no need for UUIDs -- session-only, never persisted).

#### Pure Functions (static class `FilterEngine`)

1. `FilterEngine.createFieldFilter(field: string, pattern: string): Filter` -- compiles regex, returns filter with `regex: null` if invalid
2. `FilterEngine.createRawFilter(pattern: string): Filter` -- same for raw filters
3. `FilterEngine.matchesAllFilters(entry: LogEntry, filters: readonly Filter[]): boolean` -- AND logic over enabled filters
4. `FilterEngine.matchesFilter(entry: LogEntry, filter: Filter): boolean` -- single filter match
5. `FilterEngine.toggleFilter(filter: Filter): Filter` -- returns new filter with toggled `enabled`

**Key Behavior**:
- `matchesAllFilters` skips disabled filters AND filters with `regex === null` (invalid regex never matches/blocks)
- Field filter: extracts `String(entry.fields[field] ?? '')` and tests against regex
- Raw filter: tests `entry.rawJson` against regex
- Empty active filters list = everything passes (vacuously true)

#### Unit Tests: `tests/unit/core/filter.test.ts`

Test scenarios:
- GIVEN a raw filter with pattern "error" WHEN matched against entry containing "error" THEN returns true
- GIVEN a field filter on "level" with pattern "warn" WHEN matched against entry with level "warning" THEN returns true (regex match)
- GIVEN two active filters (AND) WHEN one does not match THEN returns false
- GIVEN a disabled filter WHEN matched THEN it is skipped (entry passes)
- GIVEN an invalid regex filter WHEN matched THEN it is skipped (entry passes)
- GIVEN no active filters WHEN matched THEN returns true (vacuous truth)
- GIVEN a field filter on non-existent field WHEN matched THEN tests against empty string

**Dependencies**: None (pure logic, depends only on `LogEntry` type)

**Verification**: `npm test` passes with new filter tests

---

### Phase 6B: State Management Refactor (Mutable Lanes + Filter State)

**Goal**: Lift lane state from `useAppInit` into `AppShell` so lanes can be mutated at runtime. Add filter state. Wire re-classification.

**Components Affected**:
- `src/renderer/src/App.tsx` -- major refactor
- `src/renderer/src/useLogIngestion.ts` -- accept `lanesRef` instead of `lanes`

#### Key Design Decisions

**Decision 1: Lanes become `useState` in AppShell**

Currently `useAppInit` returns `lanes` as a static array. We lift lanes into `AppShell` state:

```
// In AppShell:
const [lanes, setLanes] = useState(init.lanes)
```

This allows `setLanes` to be called from lane-add and lane-reorder operations.

**Decision 2: useLogIngestion uses a ref for lanes**

Problem: `useLogIngestion`'s `useEffect` depends on `lanes`. If lanes is state that changes on reorder/add, the effect would re-run, tearing down and re-creating IPC listeners and LogBuffer. This is wasteful and causes flicker.

Solution: Pass a `React.MutableRefObject<readonly LaneDefinition[]>` (`lanesRef`) to `useLogIngestion`. The effect captures the ref, and the IPC callback always reads `lanesRef.current` for classification. The effect dependency list does NOT include `lanesRef.current` -- it only runs once.

```typescript
// In AppShell:
const lanesRef = useRef(lanes)
useEffect(() => { lanesRef.current = lanes }, [lanes])
```

**Decision 3: Re-classification on lane change**

When lanes change (reorder or add):
1. `setLanes(newLanes)` -- update state
2. `LaneClassifier.reclassifyAll(masterList.entries, newLanes)` -- mutate entries
3. `bumpVersion()` -- trigger re-render

`bumpVersion` is a new function exposed by `useLogIngestion` (or we add a separate `forceRerender` mechanism). Simplest: expose `bumpVersion` from `useLogIngestion` so AppShell can call it after reclassification.

**Decision 4: Filter state in AppShell**

```typescript
const [filters, setFilters] = useState<Filter[]>([])
```

Filters are passed to `SwimLaneGrid` which applies them at render time.

#### Changes to `useLogIngestion`

- Change signature: accept `lanesRef: React.RefObject<readonly LaneDefinition[]>` instead of `lanes: readonly LaneDefinition[]`
- Inside the `onLogLine` callback, use `lanesRef.current` for classification
- Expose `bumpVersion: () => void` in the return object so external callers can trigger re-render after reclassification
- Remove `lanes` from the `useEffect` dependency array (it is now a ref)

#### Changes to `App.tsx` (AppShell)

- Add `const [lanes, setLanes] = useState(init.lanes)`
- Add `const lanesRef = useRef(lanes)` + sync effect
- Add `const [filters, setFilters] = useState<Filter[]>([])`
- Create handler functions:
  - `handleAddLane(pattern: string)` -- creates LaneDefinition, inserts before last position, reclassifies, bumps version
  - `handleReorderLanes(fromIndex: number, toIndex: number)` -- reorders array, reclassifies, bumps version
  - `handleAddFilter(filter: Filter)` -- appends to filters
  - `handleRemoveFilter(id: string)` -- removes from filters
  - `handleToggleFilter(id: string)` -- toggles enabled on filter

#### Verification
- Existing unit tests pass (no logic changes in core)
- App compiles with `npm run typecheck`
- Manual smoke test: app still renders logs correctly

---

### Phase 6C: FilterBar + FilterChip + LaneAddInput Components

**Goal**: Implement the three new UI components and integrate them into AppShell.

#### New File: `src/renderer/src/components/FilterBar.tsx`

**Props**:
```typescript
interface FilterBarProps {
  readonly filters: readonly Filter[]
  readonly onAddFilter: (filter: Filter) => void
  readonly onRemoveFilter: (id: string) => void
  readonly onToggleFilter: (id: string) => void
}
```

**Behavior**:
- Renders a horizontal bar at the top of the app (below toolbar, above grid)
- Shows existing filters as `FilterChip` components
- Has "+" button that opens an inline add-filter form
- The add-filter form has:
  - A dropdown/toggle to select filter type: "Field" or "Raw"
  - If "Field": a text input for the field name
  - A text input for the pattern (regex)
  - A submit button (or Enter to submit)
- On submit: calls `onAddFilter` with a new filter created via `FilterEngine.createFieldFilter` or `FilterEngine.createRawFilter`

**UX Simplification (80/20)**:
- The add-filter form can be a simple inline expansion (not a modal or popover)
- Field name input uses a plain text input (no autocomplete from known fields -- that is a later enhancement)
- Pattern input validates on submit; invalid regex creates a filter with `regex: null` that is effectively disabled (never matches)

#### New File: `src/renderer/src/components/FilterChip.tsx`

**Props**:
```typescript
interface FilterChipProps {
  readonly filter: Filter
  readonly onToggle: () => void
  readonly onRemove: () => void
}
```

**Behavior**:
- Displays filter summary: `field:pattern` for field filters, `pattern` for raw filters
- Click body toggles enabled/disabled (visual: `.filter-chip--disabled` adds strikethrough + opacity)
- Click X button removes the filter
- CSS classes: `.filter-chip`, `.filter-chip--disabled`, `.filter-chip__remove` (all pre-defined)

#### New File: `src/renderer/src/components/LaneAddInput.tsx`

**Props**:
```typescript
interface LaneAddInputProps {
  readonly onAddLane: (pattern: string) => void
}
```

**Behavior**:
- Renders in the toolbar area (next to ModeToggle)
- A text input with placeholder "Add lane regex..."
- On Enter or button click: calls `onAddLane(pattern)`, clears input
- CSS class: `.lane-add-input`, `.lane-add-input__field` (pre-defined)

#### Changes to `SwimLaneGrid.tsx`

- New prop: `filters: readonly Filter[]`
- Before rendering virtual items, compute filtered entries:
  - For each virtual row, check `FilterEngine.matchesAllFilters(entry, filters)`
  - If a filter is active, the virtualizer count should be the filtered count, not `masterList.length`

**Filtering Strategy**:

This is the most architecturally important decision in Phase 06. Two approaches:

**Option A: Filter at render time with index mapping**
- Compute `filteredIndices: number[]` -- indices into masterList that pass all filters
- `virtualizer.count = filteredIndices.length`
- Map virtual index to master list index via `filteredIndices[virtualRow.index]`
- Recompute `filteredIndices` on every render (when version or filters change)

**Option B: useMemo the filtered list**
- `const filteredEntries = useMemo(() => masterList.entries.filter(e => matchesAllFilters(e, filters)), [version, filters])`

**Recommendation: Option A (index mapping)**. It avoids creating a new array on every flush. With 20K entries and 200ms flush intervals, Option B would allocate a new 20K array every 200ms. Option A computes the index array once per render cycle and avoids copying LogEntry references.

Implementation detail:
```typescript
// Computed on each render (cheap -- just boolean checks, no allocation of LogEntry copies)
const filteredIndices = useMemo(() => {
  const activeFilters = filters.filter(f => f.enabled)
  if (activeFilters.length === 0) {
    // No filters: return identity mapping (all indices)
    return null // signal: use masterList directly
  }
  const indices: number[] = []
  for (let i = 0; i < masterList.length; i++) {
    const entry = masterList.get(i)
    if (entry !== undefined && FilterEngine.matchesAllFilters(entry, filters)) {
      indices.push(i)
    }
  }
  return indices
}, [version, filters])

const displayCount = filteredIndices !== null ? filteredIndices.length : masterList.length
```

#### Changes to `App.tsx` Layout

Update the AppShell JSX to include FilterBar and LaneAddInput in the layout:

```
<div className="app-layout">
  <div className="app-toolbar">
    <ModeToggle ... />
    <LaneAddInput onAddLane={handleAddLane} />
    <StreamEndIndicator ... />
  </div>
  <FilterBar
    filters={filters}
    onAddFilter={handleAddFilter}
    onRemoveFilter={handleRemoveFilter}
    onToggleFilter={handleToggleFilter}
  />
  <div className="app-main">
    <SwimLaneGrid
      ...existing props
      filters={filters}
    />
  </div>
  {unparseableEntries.length > 0 && <UnparseablePanel ... />}
</div>
```

**Note**: FilterBar renders conditionally or always. Recommendation: always render it (even if empty, shows the "+" button). The `--filter-bar-height: 48px` token is pre-defined.

#### Verification
- App renders with FilterBar visible
- Can add a raw filter, see rows filtered
- Can add a field filter
- Can toggle a filter on/off
- Can remove a filter
- Can add a lane via LaneAddInput
- New lane appears before "unmatched"
- Invalid regex shows lane in error state

---

### Phase 6D: Drag-and-Drop Lane Reordering

**Goal**: Make lane headers draggable with HTML5 DnD. Dropping reorders lanes and re-classifies all entries.

#### Changes to `LaneHeader.tsx`

**New Props**:
```typescript
interface LaneHeaderProps {
  readonly pattern: string
  readonly isError: boolean
  readonly isUnmatched: boolean
  readonly laneIndex: number              // NEW: position in lanes array
  readonly isDraggable: boolean           // NEW: false for unmatched
  readonly onDragStart?: (index: number) => void   // NEW
  readonly onDragOver?: (index: number) => void    // NEW
  readonly onDrop?: (index: number) => void        // NEW
  readonly isDragOver?: boolean           // NEW: visual feedback
}
```

**HTML5 DnD Integration on the drag handle**:

The drag handle (`<span className="lane-header__drag-handle">`) becomes the drag initiator:

```
<div
  className={classNames.join(' ')}
  draggable={isDraggable}
  onDragStart={(e) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(laneIndex))
    onDragStart?.(laneIndex)
  }}
  onDragOver={(e) => {
    e.preventDefault()         // required to allow drop
    e.dataTransfer.dropEffect = 'move'
    onDragOver?.(laneIndex)
  }}
  onDrop={(e) => {
    e.preventDefault()
    onDrop?.(laneIndex)
  }}
  onDragEnd={() => {
    // clear drag state
  }}
>
```

**Visual Feedback**:
- During drag-over, the target lane header gets a visual indicator (e.g., left border highlight)
- New CSS class: `.lane-header--drag-over` with a left border or highlight effect

#### Drag State Management in `SwimLaneGrid.tsx` (or AppShell)

Keep it simple with local state in SwimLaneGrid:

```typescript
const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null)
const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
```

On drop: call `onReorderLanes(dragSourceIndex, dragOverIndex)` (callback from AppShell).

#### Reorder Logic in AppShell

```typescript
function handleReorderLanes(fromIndex: number, toIndex: number): void {
  if (fromIndex === toIndex) return

  const newLanes = [...lanes]
  const [moved] = newLanes.splice(fromIndex, 1)
  newLanes.splice(toIndex, 0, moved)

  setLanes(newLanes)
  LaneClassifier.reclassifyAll(masterList.entries, newLanes)
  bumpVersion()
}
```

**Constraint**: "Unmatched" lane is implicit (always last, not in the `lanes` array), so the drag-drop indices only cover `0..lanes.length-1`. The unmatched LaneHeader has `isDraggable={false}` and no drag event handlers.

#### New CSS

```css
.lane-header--drag-over {
  border-left: var(--border-width-thick) solid var(--color-primary);
}

.lane-header[draggable="true"] {
  /* subtle hint that header is draggable */
  user-select: none;
}
```

#### Verification
- Can grab a lane header drag handle
- Dragging over another lane shows visual indicator
- Dropping reorders the lanes
- All entries re-classify to new order
- "Unmatched" lane cannot be dragged
- Dragging to same position is a no-op

---

### Phase 6E: E2E Tests (Playwright + Electron)

**Goal**: Set up Electron Playwright testing and write tests for core user flows.

#### E2E Setup

Electron Playwright testing requires a different approach from web Playwright. We need to:

1. **Build the app first** (`npm run build`)
2. **Launch Electron as a Playwright browser** using `electron.launch()`
3. **Pipe test data to stdin** of the Electron process

**New Dev Dependency**: `electron` is already a devDependency. Playwright needs `electron` package to launch it.

**New File**: `tests/e2e/electron-app.ts` -- shared test helper

```typescript
import { _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { resolve } from 'path'

interface TestApp {
  electronApp: ElectronApplication
  page: Page
}

/**
 * Launch the built Electron app with test stdin data.
 * Caller provides JSON lines to pipe as stdin.
 */
async function launchApp(args: string[], stdinLines?: string[]): Promise<TestApp> {
  const electronApp = await electron.launch({
    args: [
      resolve(__dirname, '../../out/main/index.js'),  // built main process entry
      ...args
    ],
    env: {
      ...process.env,
      // Provide stdin via a temp file or programmatic pipe
    }
  })
  const page = await electronApp.firstWindow()

  // If stdinLines provided, pipe them
  // ...

  return { electronApp, page }
}
```

**Challenge: stdin piping in E2E tests**

The app reads from `process.stdin`. In E2E tests, we need to programmatically feed data. Two approaches:

**Option A**: Write test JSON to a temp file, launch Electron with stdin redirected from the file. This requires shell-level piping or a wrapper script.

**Option B**: Launch Electron with `electron.launch()` and use the `ELECTRON_RENDERER_URL` approach with a mock IPC. This is complex.

**Option C (Recommended)**: Write a small Node.js helper script (`tests/e2e/test-launcher.js`) that:
1. Takes a test data file path as an argument
2. Spawns Electron with the app, piping the file content to stdin
3. Playwright connects to this running Electron instance

Actually, the simplest approach for Electron Playwright:

**Recommended Approach**: Use `_electron.launch()` with programmatic stdin. Playwright's Electron support allows launching with custom arguments. We can:

1. Create a test fixture JSON file (`tests/e2e/fixtures/sample-logs.json`)
2. In the test, launch Electron and pipe data into it
3. Use `electronApp.evaluate()` to interact with the main process if needed

However, `_electron.launch()` does not directly support stdin piping. The workaround:

**Practical Solution**: Create a wrapper script that reads a file and pipes it to the Electron app:

```javascript
// tests/e2e/pipe-launcher.js
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const dataFile = process.argv[2]
const electronArgs = process.argv.slice(3)
const electronPath = require('electron')
const appPath = path.resolve(__dirname, '../../')

const child = spawn(electronPath, [appPath, ...electronArgs], {
  stdio: ['pipe', 'inherit', 'inherit']
})

fs.createReadStream(dataFile).pipe(child.stdin)
```

Then in Playwright tests, use `_electron.launch()` pointing to Node.js running this script. Actually, even simpler:

**Simplest E2E Approach**: Use `_electron.launch()` with environment variable or IPC to inject test data, bypassing stdin entirely for E2E tests. But this changes the app behavior...

**Final Recommendation**: Use Playwright's `_electron.launch()` and send test data via IPC from the test. Add a test-only IPC channel (`test-inject-lines`) that the main process handles when `process.env.E2E_TEST === '1'`. This is a small, controlled test seam.

**Alternative (even simpler)**: Since `_electron.launch()` returns an `ElectronApplication`, we can use `app.evaluate()` to directly call functions in the main process. We can:

1. Launch with `--key-level level --key-timestamp timestamp --lanes "error" "auth"`
2. Use `electronApp.evaluate(...)` to access the main process and inject data via `IpcBridge` or directly via `webContents.send()`
3. Wait for the renderer to process and render

This avoids stdin piping entirely for tests. The main process's `webContents.send(IPC_CHANNELS.LOG_LINE, ...)` is the same path stdin data takes.

#### Test File: `tests/e2e/fixtures/sample-logs.jsonl`

Pre-created test data file with ~20 JSON log lines covering different levels, lanes, and fields.

#### Test File: `tests/e2e/app-launch.spec.ts`

Test scenarios:

1. **App launches and renders logs in correct lanes**
   - Launch app with `--lanes "error" "auth"` and inject test log lines
   - Assert lane headers visible: "error", "auth", "unmatched"
   - Assert log rows appear in correct columns

2. **Filter bar filters across lanes**
   - Inject logs, add a raw filter for "error"
   - Assert only error-containing rows visible

3. **Ad-hoc lane addition**
   - Launch with no lanes
   - All logs in "unmatched"
   - Add "error" lane via LaneAddInput
   - Assert error logs move to new lane

4. **Lane drag reorder triggers re-classification**
   - Launch with `--lanes "error" "auth"`
   - Drag "auth" before "error"
   - Assert entries re-classified (auth entries now first priority)

5. **Mode toggle (Live/Scroll)**
   - Assert default is Live mode
   - Click Scroll mode
   - Assert mode indicator changes

6. **Row expand/collapse**
   - Click a row
   - Assert expanded content visible (pretty-printed JSON)
   - Click again
   - Assert collapsed

7. **Stream-ended indicator**
   - Send stream-end signal
   - Assert indicator appears

#### Playwright Config Update

Update `playwright.config.ts` to not use `webServer` (we launch Electron directly).

#### Verification
- `npm run build` succeeds
- `npm run test:e2e` runs all E2E tests and they pass

---

## 4. Technical Considerations

### Filter Performance

- `matchesAllFilters` runs for every visible virtual row on every render
- With 20K entries, filtering the full list takes ~1-2ms (simple regex tests)
- The `filteredIndices` computation is memoized with `useMemo([version, filters])`
- No debounce needed on filter application; debounce only on regex compilation (user typing)

### Re-classification Performance

- `reclassifyAll` iterates all entries and re-runs classify per entry
- With 20K entries and 10 lanes, that is 200K regex tests at worst
- Each regex test is ~microseconds, so total is ~10-50ms
- Acceptable for a user-initiated action (drag-drop)
- No need for web worker or async processing

### Filter ID Generation

Use a module-level counter in `filter.ts`:

```typescript
let nextFilterId = 0
function generateFilterId(): string {
  return `filter-${nextFilterId++}`
}
```

No need for UUIDs -- filters are session-only and never serialized.

### New Log Entries During Active Filters

New entries arriving via IPC are classified against the current lane order (via `lanesRef.current`) and added to MasterList. On the next render, `filteredIndices` is recomputed and the new entry will be visible only if it passes all active filters. No special handling needed.

### Error Handling for Invalid Regex

- `FilterEngine.createFieldFilter` / `createRawFilter`: wrap `new RegExp()` in try/catch, set `regex: null` on failure
- Filters with `regex: null` are effectively skipped (never block entries)
- The FilterChip should show a visual error indicator when `filter.regex === null`
- Similarly, `createLaneDefinition` already handles invalid regex (sets `isError: true`)

---

## 5. CSS Additions

Most CSS classes are already pre-defined. New additions:

### Drag Feedback

```css
/* Drop target indicator during lane drag */
.lane-header--drag-over {
  background-color: var(--color-surface-hover);
  border-left: var(--border-width-thick) solid var(--color-primary);
}

/* Dragged element opacity */
.lane-header--dragging {
  opacity: 0.5;
}
```

### Filter Bar Additions

```css
/* Inline filter creation form */
.filter-bar__form {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.filter-bar__input {
  padding: var(--space-1) var(--space-3);
  background-color: var(--color-surface);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--border-radius-md);
  color: var(--color-text-primary);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  outline: none;
}

.filter-bar__input:focus {
  border-color: var(--color-border-focus);
}

/* Filter type selector */
.filter-bar__type-toggle {
  padding: var(--space-1) var(--space-2);
  background: none;
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--border-radius-md);
  color: var(--color-text-secondary);
  font-size: var(--text-xs);
  cursor: pointer;
}

.filter-bar__type-toggle--active {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-grey-50);
}

/* Invalid filter indicator */
.filter-chip--error {
  border-color: var(--color-error);
}
```

### Lane Error Body Message

```css
/* Error message shown in the lane body area for invalid-regex lanes */
.lane-error-message {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-error);
  font-size: var(--text-sm);
  font-style: italic;
  padding: var(--space-4);
  text-align: center;
}
```

---

## 6. Testing Strategy

### Unit Tests (Vitest)

#### `tests/unit/core/filter.test.ts` (Phase 6A)

| GIVEN | WHEN | THEN |
|-------|------|------|
| Raw filter "error" + entry with "error" in rawJson | matchesFilter called | returns true |
| Raw filter "error" + entry without "error" in rawJson | matchesFilter called | returns false |
| Field filter on "level" with "warn" + entry with level="warning" | matchesFilter called | returns true (regex match) |
| Field filter on non-existent field + entry | matchesFilter called | tests against "" (returns false for non-trivial regex) |
| Two enabled filters, one matches, one does not | matchesAllFilters called | returns false (AND logic) |
| Two enabled filters, both match | matchesAllFilters called | returns true |
| Disabled filter that would not match + enabled filter that matches | matchesAllFilters called | returns true (disabled skipped) |
| Filter with null regex (invalid) | matchesAllFilters called | skipped (entry passes) |
| Zero active filters | matchesAllFilters called | returns true (vacuous truth) |
| createRawFilter with valid regex | called | returns filter with compiled regex |
| createRawFilter with invalid regex | called | returns filter with regex: null |
| createFieldFilter with field and pattern | called | returns FieldFilter with correct properties |
| toggleFilter on enabled filter | called | returns filter with enabled: false |

#### `tests/unit/core/lane-reorder.test.ts` (or extend `lane-classifier.test.ts`)

Lane reorder is just array manipulation + `reclassifyAll` which is already tested. May add one integration-style test:

| GIVEN | WHEN | THEN |
|-------|------|------|
| Lanes [error, auth] with 3 classified entries | reorder to [auth, error] and reclassifyAll | entries re-classified to new order |

### E2E Tests (Playwright) (Phase 6E)

Covered in Phase 6E section above. Key scenarios:
1. App launches and renders logs in correct lanes
2. Filter bar filters across lanes
3. Ad-hoc lane addition
4. Lane drag reorder re-classifies
5. Mode toggle
6. Row expand/collapse
7. Stream-ended indicator

---

## 7. Acceptance Criteria Mapping

| Acceptance Criterion | Implementation Phase | Specific Item |
|---------------------|---------------------|---------------|
| Filter bar renders at top of UI | 6C | FilterBar component in AppShell layout |
| Field filters can be added | 6C | FilterBar add-filter form with "Field" type |
| Raw filters can be added | 6C | FilterBar add-filter form with "Raw" type |
| Filters can be toggled on/off | 6C | FilterChip click-to-toggle |
| Filters can be removed | 6C | FilterChip X button |
| AND logic: only rows matching ALL active filters visible | 6A+6C | FilterEngine.matchesAllFilters + SwimLaneGrid filtering |
| Filtering affects all lanes simultaneously | 6C | filteredIndices computed across entire masterList |
| Ad-hoc lane regex input available | 6C | LaneAddInput in toolbar |
| New lane inserted before "unmatched" on submit | 6B+6C | handleAddLane in AppShell |
| Invalid regex in ad-hoc input creates lane in error state | 6B | createLaneDefinition handles this already |
| Lane headers are draggable (except "unmatched") | 6D | LaneHeader HTML5 DnD integration |
| Dropping a lane reorders and re-classifies all entries | 6D | handleReorderLanes in AppShell |
| Visual drag feedback (handle, drop indicator) | 6D | CSS classes + drag state |
| E2E tests pass for core user flows | 6E | Playwright test suite |
| All unit tests still pass | All | Verify at each phase |

---

## 8. File Summary (New + Modified)

### New Files

| File | Purpose |
|------|---------|
| `src/core/filter.ts` | FilterEngine static class + Filter types |
| `src/renderer/src/components/FilterBar.tsx` | Filter management UI |
| `src/renderer/src/components/FilterChip.tsx` | Individual filter display with toggle/remove |
| `src/renderer/src/components/LaneAddInput.tsx` | Ad-hoc lane regex input |
| `tests/unit/core/filter.test.ts` | Filter logic unit tests |
| `tests/e2e/app-launch.spec.ts` | E2E tests for core flows |
| `tests/e2e/helpers/electron-test-utils.ts` | E2E test helpers for launching Electron |
| `tests/e2e/fixtures/sample-logs.jsonl` | Test log data |

### Modified Files

| File | Changes |
|------|---------|
| `src/core/types.ts` | Export Filter types (or keep in filter.ts -- prefer filter.ts for SRP) |
| `src/renderer/src/App.tsx` | Lift lanes to state, add filter state, wire handlers, add FilterBar + LaneAddInput to layout |
| `src/renderer/src/useLogIngestion.ts` | Accept lanesRef, expose bumpVersion |
| `src/renderer/src/components/SwimLaneGrid.tsx` | Accept filters prop, compute filteredIndices, pass drag handlers to LaneHeader |
| `src/renderer/src/components/LaneHeader.tsx` | Add drag-and-drop event handlers and visual feedback |
| `src/renderer/theme/components.css` | Add drag feedback + filter form + lane error message styles |
| `playwright.config.ts` | Update for Electron testing |

---

## 9. Implementation Order + Commit Strategy

| Step | Phase | Commit Message |
|------|-------|---------------|
| 1 | 6A | `feat(core): add FilterEngine with pure filter matching logic and unit tests` |
| 2 | 6B | `refactor(renderer): lift lanes to AppShell state, use lanesRef in useLogIngestion` |
| 3 | 6C-part1 | `feat(renderer): add FilterBar, FilterChip, LaneAddInput components` |
| 4 | 6C-part2 | `feat(renderer): integrate filtering into SwimLaneGrid with filtered index mapping` |
| 5 | 6D | `feat(renderer): add HTML5 drag-and-drop lane reordering with re-classification` |
| 6 | 6E | `test(e2e): add Playwright E2E tests for core user flows` |
| 7 | docs | `docs: update CLAUDE.md and high-level spec for Phase 06 completion` |

---

## 10. Open Questions / Decisions Needed

1. **Filter bar visibility**: Should the filter bar always be visible (with a "+" button), or should it only appear when the first filter is added? **Recommendation**: Always visible -- simpler, matches pre-defined CSS `--filter-bar-height`.

2. **E2E stdin injection**: The recommended approach uses `electronApp.evaluate()` to inject test data via `webContents.send()`, bypassing stdin. This is a pragmatic test seam. If the team prefers testing the full stdin path, a wrapper script approach is needed (more complex). **Recommendation**: Use `webContents.send()` for E2E -- it tests the same IPC path that stdin data follows.

3. **Filter persistence**: Filters are session-only per the spec. No persistence needed. But should we consider using URL search params or IPC for filter state? **Recommendation**: No -- simple React state is sufficient.

---

## 11. Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Re-classification is slow with 20K entries | Janky UI on lane reorder | Profile early in Phase 6D. If >100ms, debounce or use requestIdleCallback. Expected: <50ms. |
| HTML5 DnD quirks across Linux/macOS | Drag-drop may not work consistently | Test on both platforms. HTML5 DnD is well-supported in Electron (Chromium). |
| Filter bar layout overflows with many filters | Horizontal scrollbar or wrapping | CSS already has `overflow-x: auto` on `.filter-bar` |
| Electron E2E test flakiness | Unreliable CI | Add generous timeouts, wait-for-selector patterns, avoid timing-dependent assertions |
| useLogIngestion re-runs on lane change (if not using ref) | IPC listeners torn down and re-created, causing missed messages | Phase 6B explicitly uses lanesRef to avoid this |
