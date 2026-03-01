# Phase 07: Settings Panel -- Implementation Plan

## Problem Understanding

Build a slide-out settings panel that allows users to view and edit all `config.json` options at runtime. The panel opens via a gear icon in the toolbar, shows organized sections (Colors, UI, Performance), applies changes live via CSS custom property updates, and persists to disk via IPC. A "Reset to Defaults" button is also required. This is the final feature phase -- the app becomes feature-complete for v1 after this.

### Key Constraints
- Settings CSS classes already exist in `components.css` (`.settings-panel`, `.settings-backdrop`, `.settings-panel__section`, etc.) and tokens in `tokens.css` (`--color-backdrop`, `--color-panel-bg`, `--settings-panel-width`)
- `applyConfigToCSS()` already exists and handles CSS variable injection from `AppConfig`
- `ConfigManager.save()` already handles writing config to disk
- `ElectronApi` interface needs a `resetConfig` method; `IPC_CHANNELS` needs `RESET_CONFIG`
- `MasterList` has a private `maxEntries` field -- eviction on `maxLogEntries` decrease needs a new public method
- The `config` passed to `AppShell` is currently immutable after init -- it needs to become mutable state
- `useLogIngestion` currently uses `config` directly in its effect dependency array with a comment noting Phase 07 may need ref pattern

### Assumptions
- Collapsible sections are a "nice to have" per spec wording ("should be") -- implementing them as always-open sections is acceptable for 80/20. Collapsibility can be added later with trivial CSS toggle if desired.
- Font family uses a text input (not dropdown) since the spec says "dropdown or text input" and text input is simpler.
- Debouncing hex color input for live preview is needed (spec calls it out). A 150ms debounce on `applyConfigToCSS` calls is sufficient.

---

## High-Level Architecture

```
User clicks gear icon
  -> AppShell sets settingsOpen = true
  -> SettingsPanel renders with current config as initial state
  -> User edits fields
  -> Each edit updates local draft config state
  -> applyConfigToCSS(draftConfig) called on each change (debounced)
  -> CSS variables update live
  -> User clicks Save
    -> window.api.saveConfig(draftConfig) -> main process -> ConfigManager.save()
    -> AppShell's authoritative config state updated
  -> User clicks Reset
    -> window.api.resetConfig() -> main process -> ConfigManager.reset()
    -> Returns DEFAULT_APP_CONFIG
    -> Draft and authoritative config both reset
    -> applyConfigToCSS(defaults) applied
  -> Closing panel does NOT discard live preview changes
```

### Data Flow for Config Changes

```
AppShell (source of truth: config state)
  |
  +-- passes config to SettingsPanel as initialConfig
  |
  +-- SettingsPanel maintains local draftConfig state
  |     |
  |     +-- on field change: update draftConfig + applyConfigToCSS(draftConfig)
  |     |
  |     +-- on Save: call window.api.saveConfig(draftConfig)
  |     |             then call onConfigChange(draftConfig) callback to update AppShell state
  |     |
  |     +-- on Reset: call window.api.resetConfig()
  |                    then call onConfigChange(defaults) callback
  |                    then reset draftConfig to defaults
  |
  +-- passes config to SwimLaneGrid (timestampFormat, rowHeight)
  +-- passes config to useLogIngestion (performance settings)
```

### Key Design Decision: Config as State in AppShell

Currently `config` is received as a prop from `useAppInit` and never changes. For settings to work, `config` must become React state in `AppShell`. When settings are saved, the authoritative config updates, which flows to all consumers.

However, `useLogIngestion` creates a `LogBuffer` with `config.performance.flushIntervalMs` on mount. Changing flush interval mid-session would require recreating the LogBuffer. For 80/20, flush interval changes take effect on next app restart (the save persists to disk, but the in-memory LogBuffer is not recreated). This is documented in the UI ("takes effect on restart").

For `maxLogEntries` changes, immediate eviction IS required per spec. `MasterList` needs a `setMaxEntries(n)` method.

---

## Implementation Phases

### Phase 7A: Backend/IPC Layer (Types, ConfigManager, Main Process, Preload)

**Goal**: Wire up the `resetConfig` IPC channel and add `MasterList.setMaxEntries()`.

**Components Affected**:
- `src/core/types.ts`
- `src/core/master-list.ts`
- `src/main/config-manager.ts`
- `src/main/index.ts`
- `src/preload/index.ts`

**Key Steps**:

1. **Add `RESET_CONFIG` to `IPC_CHANNELS`** in `src/core/types.ts`:
   - Add `RESET_CONFIG: 'reset-config'` to the `IPC_CHANNELS` const object

2. **Add `resetConfig` to `ElectronApi`** in `src/core/types.ts`:
   - Add `resetConfig: () => Promise<AppConfig>` to the `ElectronApi` interface

3. **Add `reset()` method to `ConfigManager`** in `src/main/config-manager.ts`:
   - Writes `DEFAULT_APP_CONFIG` to disk via existing `save()` method
   - Updates `currentConfig` to `DEFAULT_APP_CONFIG`
   - Returns `DEFAULT_APP_CONFIG`

4. **Register `RESET_CONFIG` IPC handler** in `src/main/index.ts`:
   - `ipcMain.handle(IPC_CHANNELS.RESET_CONFIG, () => configManager.reset())`

5. **Add `resetConfig` to preload bridge** in `src/preload/index.ts`:
   - `resetConfig: () => ipcRenderer.invoke(IPC_CHANNELS.RESET_CONFIG)`

6. **Add `setMaxEntries(n)` to `MasterList`** in `src/core/master-list.ts`:
   - Public method that updates the private `maxEntries` field
   - Calls existing private `evict()` to trim if new limit is below current count
   - Note: `maxEntries` must be changed from `readonly` to `private` (it is already private, just add mutability)

7. **Export `DEFAULT_APP_CONFIG` validation constants** from `src/core/types.ts`:
   - Add validation constraints as named constants for reuse in both `ConfigValidator` and the settings panel UI:
     ```typescript
     const CONFIG_CONSTRAINTS = {
       ROW_HEIGHT_MIN: 16,
       ROW_HEIGHT_MAX: 128,
       FONT_SIZE_MIN: 8,
       FONT_SIZE_MAX: 32,
       FLUSH_INTERVAL_MIN: 50,
       FLUSH_INTERVAL_MAX: 5000,
       MAX_ENTRIES_MIN: 100,
       MAX_ENTRIES_MAX: 1_000_000
     } as const
     ```
   - Update `ConfigValidator` to use these constants instead of just checking `> 0`

**Dependencies**: None (first phase)

**Verification**:
- Unit tests for `ConfigManager.reset()` (write defaults to disk, return defaults)
- Unit tests for `MasterList.setMaxEntries()` (eviction when decreased, no-op when increased)
- Unit test for `ConfigValidator` with boundary values using `CONFIG_CONSTRAINTS`
- `npm test` passes
- `npm run typecheck` passes

---

### Phase 7B: Settings Panel UI (Component, App.tsx Integration, E2E)

**Goal**: Build the `SettingsPanel` component and integrate it with `AppShell`.

**Components Affected**:
- `src/renderer/src/components/SettingsPanel.tsx` (NEW)
- `src/renderer/src/App.tsx`
- `src/renderer/theme/components.css` (minor additions for new field types)
- `tests/e2e/app.spec.ts` (new settings test)

**Key Steps**:

#### Step 1: Settings Panel Component (`SettingsPanel.tsx`)

Create `src/renderer/src/components/SettingsPanel.tsx`:

- **Props interface**:
  ```typescript
  interface SettingsPanelProps {
    readonly isOpen: boolean
    readonly config: AppConfig
    readonly onConfigChange: (config: AppConfig) => void
    readonly onClose: () => void
  }
  ```

- **Internal state**: `draftConfig` -- initialized from `config` prop. All field edits update this draft.

- **Live preview**: On every draft change, call `applyConfigToCSS(draftConfig)`. Debounce this call by 150ms for rapidly-changing inputs (hex color typing).

- **Sections** (all always-open for simplicity):
  - **Colors**: One hex input per level color (from `KNOWN_LOG_LEVELS`), plus `unrecognizedLevel`, `swimlaneHeaders`, `background`, `rowHover`, `expandedRow`. Each field shows a small color swatch preview next to the input.
  - **UI**: `rowHeight` (number), `fontFamily` (text), `fontSize` (number), `viewTimestampFormat` (3-option segmented control).
  - **Performance**: `flushIntervalMs` (number, note "takes effect on restart"), `maxLogEntries` (number).

- **Validation**: Inline validation on each field:
  - Hex colors: validate with `/^#[0-9a-fA-F]{6}$/`
  - Numbers: check against `CONFIG_CONSTRAINTS` min/max
  - Invalid fields show red border (`.is-error` class) and prevent Save

- **Buttons** at bottom:
  - **Reset to Defaults**: Calls `window.api.resetConfig()`, receives defaults, updates draft, calls `onConfigChange(defaults)`, calls `applyConfigToCSS(defaults)`
  - **Save**: Validates all fields. If valid, calls `window.api.saveConfig(draftConfig)`, then `onConfigChange(draftConfig)`. If invalid, do nothing (fields already show errors).

- **Close behavior**: Click backdrop or X button calls `onClose()`. Per spec: "Closing panel does NOT discard unsaved changes from the live preview" -- meaning the CSS variables stay as applied. The `onClose` just hides the panel. The draft config is maintained in AppShell state.

- **Re-open behavior**: When panel re-opens, draft should reflect the current config state (which includes any unsaved live preview changes from last open).

#### Step 2: CSS Additions for Settings Fields

Add to `components.css` (after existing `.settings-panel__label`):

- `.settings-panel__input` -- reuse the shared mono text input pattern (same as `.filter-bar__input`)
- `.settings-panel__color-field` -- flex row with color swatch + hex input
- `.settings-panel__color-swatch` -- small colored square preview
- `.settings-panel__segmented-control` -- flex row of options (reuse `.filter-bar__type-toggle` pattern)
- `.settings-panel__actions` -- footer bar with buttons
- `.settings-panel__btn` -- base button style
- `.settings-panel__btn--primary` -- Save button (accent color)
- `.settings-panel__btn--secondary` -- Reset button (subtle)
- `.settings-panel__header` -- panel title + close button row
- `.settings-panel__hint` -- small muted text for hints like "takes effect on restart"

#### Step 3: App.tsx Integration

Modify `AppShell` in `src/renderer/src/App.tsx`:

1. **Promote `config` to state**: Change from prop to state with `useState(config)`. The prop value initializes it.

2. **Add settings state**: `const [settingsOpen, setSettingsOpen] = useState(false)`

3. **Config change handler**:
   ```typescript
   const handleConfigChange = useCallback((newConfig: AppConfig) => {
     setConfig(newConfig)
     applyConfigToCSS(newConfig)
     // Handle maxLogEntries decrease -> immediate eviction
     if (newConfig.performance.maxLogEntries < masterList.length) {
       masterList.setMaxEntries(newConfig.performance.maxLogEntries)
       bumpVersion() // trigger re-render
     }
   }, [masterList, bumpVersion])
   ```

4. **Gear icon**: Add to `.app-toolbar` after `StreamEndIndicator`:
   ```tsx
   <button className="settings-trigger" onClick={() => setSettingsOpen(true)}>
     ⚙
   </button>
   ```

5. **Render SettingsPanel**: Add at the end of the AppShell return, outside `.app-layout`:
   ```tsx
   {settingsOpen && (
     <>
       <div className="settings-backdrop" onClick={() => setSettingsOpen(false)} />
       <SettingsPanel
         isOpen={settingsOpen}
         config={config}
         onConfigChange={handleConfigChange}
         onClose={() => setSettingsOpen(false)}
       />
     </>
   )}
   ```

6. **Pass dynamic config values**: Update `SwimLaneGrid` props to use state `config` instead of the static prop:
   - `timestampFormat={config.ui.viewTimestampFormat}`
   - `rowHeight={config.ui.rowHeight}`

#### Step 4: Settings Trigger CSS

Add to `components.css`:
- `.settings-trigger` -- gear icon button style (borderless, transparent background, hover effect, matches toolbar aesthetic)

#### Step 5: E2E Test

Add a new test block in `tests/e2e/app.spec.ts`:

```
GIVEN the Electron app launched
  WHEN the gear icon is clicked
    THEN the settings panel appears
    AND the backdrop is visible
  WHEN a color value is changed
    THEN the CSS variable updates immediately (live preview)
  WHEN Save is clicked
    THEN the panel remains open with saved state
  WHEN the backdrop is clicked
    THEN the settings panel closes
```

Specific E2E test implementation:
1. Launch app with default CLI args
2. Click gear icon button
3. Verify `.settings-panel` is visible
4. Verify `.settings-backdrop` is visible
5. Find the "background" color input, change its value to a known hex color (e.g. `#FF0000`)
6. Verify the CSS variable `--color-bg` updated on `document.documentElement`
7. Click backdrop to close
8. Verify panel is hidden

**Dependencies**: Phase 7A complete

**Verification**:
- E2E test passes
- `npm test` passes
- `npm run typecheck` passes
- All existing E2E tests still pass

---

## Technical Considerations

### Debouncing Live Preview

Use a simple debounce utility (inline, not a library). The debounce should:
- Fire on the trailing edge (after 150ms of no input)
- Call `applyConfigToCSS(draftConfig)` with the latest draft

Implementation: Use `useRef` for a timer ID, clear and restart on each draft change.

### Config State Lifecycle

```
useAppInit loads config from main process
  -> AppShell initializes config state
  -> Settings panel edits create draft state
  -> Save persists to disk AND updates AppShell state
  -> Reset persists defaults to disk AND updates AppShell + draft state
  -> Close panel preserves live preview (CSS vars stay applied)
```

Important: When the panel is closed without saving, the CSS variables reflect the unsaved draft. This is per spec. If the user opens settings again, the draft should match what was last applied. This means `AppShell` should track the "effective config" (including unsaved preview changes). The simplest approach:

- `AppShell` keeps `config` state as the authoritative config
- `SettingsPanel` keeps its own `draftConfig` state, initialized from `config` prop
- On every draft change in SettingsPanel, it also calls `onConfigChange(draftConfig)` to update AppShell
- On Save, it additionally persists to disk
- On Reset, it persists defaults to disk AND calls `onConfigChange(defaults)`

This means every live preview change updates AppShell state. The only difference between "preview" and "save" is whether `window.api.saveConfig()` is called.

### MasterList.setMaxEntries Eviction

When `maxLogEntries` is decreased:
1. `handleConfigChange` in AppShell detects the decrease
2. Calls `masterList.setMaxEntries(newMax)`
3. `setMaxEntries` internally calls `evict()` which splices from index 0
4. `bumpVersion()` triggers re-render
5. `SwimLaneGrid` sees updated `masterList.length` and re-virtualizes

### Flush Interval Changes

NOT applied in-session. The `LogBuffer` is created once in `useLogIngestion`'s effect with the initial `flushIntervalMs`. Recreating the buffer mid-session would require:
- Closing the old buffer (draining pending entries)
- Creating a new buffer with the new interval
- Re-wiring the IPC callback

This is complex for minimal value. The setting persists to disk and takes effect on restart. Add a hint text: "Takes effect on restart".

### Validation Strategy

Validation is shared between `ConfigValidator` (main process, file loading) and `SettingsPanel` (renderer, user input). The `CONFIG_CONSTRAINTS` constants in `src/core/types.ts` serve as the single source of truth for min/max values. The hex pattern is already in `ConfigValidator` -- consider exporting it or defining a shared `isValidHexColor()` utility in `src/core/types.ts`.

Create a small pure validation utility in `src/core/config-validation.ts`:
```typescript
// Pure validation functions for config fields, usable in both main and renderer processes
export function isValidHexColor(value: string): boolean
export function isInRange(value: number, min: number, max: number): boolean
```

This avoids duplicating validation logic between ConfigValidator and SettingsPanel.

---

## Testing Strategy

### Unit Tests (Phase 7A)

1. **`tests/unit/main/config-manager.test.ts`** (extend existing):
   - `GIVEN a ConfigManager with loaded config WHEN reset() is called THEN getConfig() returns DEFAULT_APP_CONFIG`
   - `GIVEN a ConfigManager with loaded config WHEN reset() is called THEN config file on disk matches DEFAULT_APP_CONFIG`

2. **`tests/unit/core/master-list.test.ts`** (extend existing):
   - `GIVEN a MasterList with 100 entries and maxEntries=100 WHEN setMaxEntries(50) is called THEN length is 50`
   - `GIVEN a MasterList with 100 entries and maxEntries=100 WHEN setMaxEntries(50) is called THEN oldest 50 entries are removed`
   - `GIVEN a MasterList with 50 entries and maxEntries=100 WHEN setMaxEntries(200) is called THEN length is still 50`

3. **`tests/unit/core/config-validation.test.ts`** (new):
   - `GIVEN a valid hex color WHEN isValidHexColor is called THEN returns true`
   - `GIVEN an invalid hex color WHEN isValidHexColor is called THEN returns false`
   - Various boundary tests for `isInRange` with CONFIG_CONSTRAINTS values

### E2E Test (Phase 7B)

In `tests/e2e/app.spec.ts`:
- Open settings via gear icon
- Verify panel and backdrop visible
- Change a color value
- Verify CSS variable updated (via `page.evaluate`)
- Close via backdrop
- Verify panel hidden

### What NOT to Test

- Individual React component rendering (no React Testing Library in the project)
- CSS animations/transitions
- Debounce timing (implementation detail)

---

## Open Questions / Decisions Needed

1. **DEFAULT_APP_CONFIG color reconciliation**: Phase 03 callout noted that `DEFAULT_APP_CONFIG` colors differ from the high-level spec. Phase 07 was identified as the place to reconcile. Should we update `DEFAULT_APP_CONFIG` to match the spec colors, or keep the current ones? The spec colors and current code colors differ for: trace, debug, info, warn, error, fatal, unrecognizedLevel, swimlaneHeaders, background, rowHover, expandedRow. **Recommendation**: Update to match spec colors as part of this phase, since settings panel is the config-related phase. This is a one-time mechanical change in `types.ts` DEFAULT_APP_CONFIG.

2. **Collapsible sections**: The spec says "each section should be a collapsible group". For 80/20, always-open sections deliver the same functionality with less code. Collapsibility is a visual convenience that can be trivially added later with a CSS class toggle. **Recommendation**: Ship without collapsibility.

---

## File Summary

### New Files
| File | Purpose |
|------|---------|
| `src/renderer/src/components/SettingsPanel.tsx` | Settings slide-out panel component |
| `src/core/config-validation.ts` | Shared validation utilities (hex color, range check) |
| `tests/unit/core/config-validation.test.ts` | Unit tests for validation utilities |

### Modified Files
| File | Changes |
|------|---------|
| `src/core/types.ts` | Add `RESET_CONFIG` to `IPC_CHANNELS`, `resetConfig` to `ElectronApi`, `CONFIG_CONSTRAINTS` const |
| `src/core/master-list.ts` | Add `setMaxEntries(n)` public method |
| `src/main/config-manager.ts` | Add `reset()` method; update `ConfigValidator` to use `CONFIG_CONSTRAINTS` |
| `src/main/index.ts` | Register `RESET_CONFIG` IPC handler |
| `src/preload/index.ts` | Add `resetConfig` to preload bridge |
| `src/renderer/src/App.tsx` | Promote config to state, add settings open/close state, gear icon, SettingsPanel rendering, handleConfigChange with eviction |
| `src/renderer/theme/components.css` | Add settings field CSS classes (input, color swatch, segmented control, actions, trigger button) |
| `tests/unit/main/config-manager.test.ts` | Add tests for `reset()` |
| `tests/unit/core/master-list.test.ts` | Add tests for `setMaxEntries()` |
| `tests/e2e/app.spec.ts` | Add settings panel E2E test |

### Documentation Updates
| File | Changes |
|------|---------|
| `CLAUDE.md` | Add `SettingsPanel.tsx` to component inventory, add `config-validation.ts` to core modules, add `CONFIG_CONSTRAINTS` to types |
| `doc/ralph/log-swim-ui/log-swim-ui-high-level.md` | Update Phase 07 status, add any callouts |
