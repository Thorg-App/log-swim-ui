# Phase 07: Settings Panel

## Objective
Implement the slide-out settings panel accessible via a gear icon, allowing users to view and edit all config.json options at runtime, with changes persisted to disk.

## Prerequisites
- Phase 04 complete (config manager with read/write capability)
- Phase 05 complete (UI shell, CSS token injection)
- Phase 06 complete (all other interactive features)

## Scope
### In Scope
- **Settings trigger** — gear icon (⚙) in the app toolbar/header area
- **Slide-out panel** (`src/renderer/components/SettingsPanel.tsx`):
  - Slides in from the right side of the screen
  - Semi-transparent backdrop over logs (logs remain partially visible)
  - Organized in sections matching config structure:
    - **Colors** section:
      - Log level colors (color pickers or hex input for each level)
      - Unrecognized level color
      - Swimlane header background
      - App background
      - Row hover color
      - Expanded row color
    - **UI** section:
      - Row height (number input)
      - Font family (dropdown or text input)
      - Font size (number input)
      - View timestamp format (segmented control: iso / local / relative)
    - **Performance** section:
      - Flush interval (number input, ms)
      - Max log entries (number input)
  - Close button (× or click outside)
  - Changes apply **live** (CSS variables update immediately for visual settings)
  - **Save** button persists to `~/.config/log-swim-ui/config.json` via IPC
  - **Reset to Defaults** button restores all settings to defaults
- **IPC integration**:
  - `window.api.saveConfig(config)` → main process writes config.json
  - `window.api.getConfig()` → main process reads current config
  - `window.api.resetConfig()` → main process writes defaults and returns them
- **Live preview**: Color and UI changes reflected immediately via CSS variable updates
- **Validation**: Numeric fields validated (min/max where sensible), hex colors validated
- **Eviction update**: When `maxLogEntries` is decreased below current count, evict immediately
- Unit tests for settings state management
- E2E test: open settings, change a value, verify it takes effect

### Out of Scope
- Custom theme import/export
- Per-session settings (all changes go to config.json)

## Implementation Guidance

### Panel Animation
```css
.settings-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: 360px;
  height: 100vh;
  transform: translateX(100%);
  transition: transform 200ms ease-out;
  z-index: 100;
}
.settings-panel.open {
  transform: translateX(0);
}
.settings-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 99;
}
```

### Live CSS Variable Updates
When a color or UI value changes in the settings form:
```typescript
function applyConfigToCSS(config: AppConfig): void {
  const root = document.documentElement;
  Object.entries(config.colors.levels).forEach(([level, color]) => {
    root.style.setProperty(`--color-level-${level}`, color);
  });
  root.style.setProperty('--row-height', `${config.ui.rowHeight}px`);
  root.style.setProperty('--font-family', config.ui.fontFamily);
  root.style.setProperty('--font-size', `${config.ui.fontSize}px`);
  // etc.
}
```

### Section Layout
Each section should be a collapsible group:
```
⚙ Settings
─────────────────────────
▼ Colors
  Trace         [#6B7280]
  Debug         [#94A3B8]
  Info          [#3B82F6]
  ...

▼ UI
  Row Height    [32] px
  Font Family   [monospace ▼]
  Font Size     [12] px
  Timestamp     [iso] [local] [relative]

▼ Performance
  Flush Interval  [200] ms
  Max Entries     [20000]

─────────────────────────
[Reset to Defaults]  [Save]
```

### Validation Rules
| Field | Type | Constraints |
|-------|------|-------------|
| Level colors | hex string | Must match `#[0-9a-fA-F]{6}` |
| Row height | number | Min: 16, Max: 128 |
| Font size | number | Min: 8, Max: 32 |
| Flush interval | number | Min: 50, Max: 5000 |
| Max entries | number | Min: 100, Max: 1000000 |
| viewTimestampFormat | enum | `"iso" \| "local" \| "relative"` |

### Timestamp Format Control
Use a segmented control (three options side by side) for `viewTimestampFormat`:
- `iso` — e.g., `2024-01-15T10:30:00Z`
- `local` — e.g., `1/15/2024, 10:30:00 AM` (locale-dependent)
- `relative` — e.g., `+0:05.230` (relative to first log entry)

Changing this should immediately update all visible timestamp displays.

## Acceptance Criteria
- [ ] Gear icon visible in app header/toolbar
- [ ] Clicking gear icon opens slide-out panel from the right
- [ ] Panel has semi-transparent backdrop
- [ ] All config.json fields are editable in organized sections
- [ ] Color fields show current color and accept hex input
- [ ] Numeric fields have appropriate min/max validation
- [ ] viewTimestampFormat has segmented control with three options
- [ ] Changes apply live (CSS variables update immediately)
- [ ] Save button persists config to disk via IPC
- [ ] Reset to Defaults button restores default config
- [ ] Closing panel (× or backdrop click) does NOT discard unsaved changes from the live preview
- [ ] Decreasing maxLogEntries triggers immediate eviction if over limit
- [ ] E2E test: open settings, change a color, verify visual update
- [ ] All tests pass

## Notes
- The settings panel is the final interactive feature. After this phase, the app is feature-complete for v1.
- Live preview of color changes is important UX — users should see the effect immediately before saving.
- Consider debouncing the live preview for rapidly-changing inputs (e.g., typing in a hex color field).
