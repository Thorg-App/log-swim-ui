# IMPLEMENTOR Public Context -- Phase 07: Settings Panel

## Status: COMPLETE (Phase 7A + 7B)

All steps implemented and verified. 238 unit tests pass. 14 E2E tests pass. Typecheck clean.

## Phase 7B Files Changed

### New Files
| File | Purpose |
|------|---------|
| `src/renderer/src/components/SettingsPanel.tsx` | Slide-out settings panel with local draft state, live CSS preview, validation, Save/Reset/Close |

### Modified Files
| File | Changes |
|------|---------|
| `src/renderer/src/App.tsx` | Promoted config to state, added settingsOpen state, gear icon button, SettingsPanel rendering, Save/Reset handlers with IPC and eviction |
| `src/renderer/theme/components.css` | Added 17 CSS classes for settings panel fields, buttons, segmented control, color swatches, gear trigger |
| `tests/e2e/app.spec.ts` | Added 3 E2E tests: open settings, live color preview, close via backdrop |

## Key Design Decisions

1. **Draft state LOCAL to SettingsPanel** -- Does NOT propagate every keystroke to AppShell. Only `applyConfigToCSS` (debounced 150ms) fires during preview. Parent state updates only on Save/Reset. This prevents unnecessary re-renders and avoids the `useLogIngestion` IPC teardown issue identified in the plan review.

2. **Props split: onSave + onReset** -- Cleaner than a single `onConfigChange` callback. `onSave` handles disk write + state update + eviction + close. `onReset` calls IPC, receives defaults, updates state + CSS + eviction + close.

3. **Conditional rendering (return null when closed)** -- Instead of CSS class toggle with `.settings-panel--closed`. No close animation per 80/20. Simpler E2E testing (count=0 when closed).

4. **Color swatch inline style** -- Only exception to "no inline styles" rule. backgroundColor is dynamic from user input. All other styles use CSS classes.

5. **Gear icon positioning** -- `margin-left: auto` on `.settings-trigger` pushes it to the right side of the flex toolbar. `aria-label="Settings"` for accessibility.

6. **Validation** -- `validateConfig()` runs on every draft change and produces a `ValidationErrors` map keyed by field path (e.g., `colors.levels.trace`, `ui.rowHeight`). Save button disabled when errors exist. Uses `isValidHexColor` and `isInRange` from Phase 7A's `config-validation.ts`.

7. **flushIntervalMs hint** -- Shows "Takes effect on restart" italic hint text below the input.

8. **maxLogEntries eviction** -- Handled in both `handleSettingsSave` and `handleSettingsReset`. Checks `newConfig.performance.maxLogEntries < masterList.length` and calls `masterList.setMaxEntries()` + `bumpVersion()` if needed.

## Component Architecture

```
App
  └─ AppShell (config as state)
       ├─ .app-layout
       │    ├─ .app-toolbar
       │    │    ├─ ModeToggle
       │    │    ├─ LaneAddInput
       │    │    ├─ StreamEndIndicator
       │    │    └─ <button .settings-trigger> ⚙
       │    ├─ FilterBar
       │    ├─ SwimLaneGrid (uses config.ui.viewTimestampFormat, config.ui.rowHeight)
       │    └─ UnparseablePanel
       ├─ .settings-backdrop (conditional, only when settingsOpen)
       └─ SettingsPanel (local draftConfig state, debounced applyConfigToCSS)
```

## Test Summary

| Suite | Count | Status |
|-------|-------|--------|
| Unit tests (vitest) | 238 | PASS |
| E2E tests (playwright) | 14 | PASS |
| Typecheck | - | CLEAN |

### New E2E Tests
1. Settings panel and backdrop appear when gear icon clicked
2. Changing background color input updates `--color-bg` CSS variable (live preview)
3. Clicking backdrop closes settings panel
