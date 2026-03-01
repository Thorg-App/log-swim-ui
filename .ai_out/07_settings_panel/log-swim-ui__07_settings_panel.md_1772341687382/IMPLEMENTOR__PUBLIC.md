# IMPLEMENTOR Public Context -- Phase 07: Settings Panel

## Status: COMPLETE (Phase 7A + 7B + Review Fixes)

All steps implemented and verified. 238 unit tests pass. 14 E2E tests pass. Typecheck clean.

## Review Fix Pass

### Fix 1: DRY -- HEX_COLOR_PATTERN deduplication
- Removed duplicate `HEX_COLOR_PATTERN` from `src/main/config-manager.ts`
- Added `import { HEX_COLOR_PATTERN } from '../core/config-validation'`
- Single source of truth now in `src/core/config-validation.ts`

### Fix 2: DRY -- VIEW_TIMESTAMP_FORMAT_OPTIONS removed
- Removed `VIEW_TIMESTAMP_FORMAT_OPTIONS` from `src/core/config-validation.ts`
- Updated `src/renderer/src/components/SettingsPanel.tsx` to import `VIEW_TIMESTAMP_FORMATS` from `@core/types`
- Updated `tests/unit/core/config-validation.test.ts` to import `VIEW_TIMESTAMP_FORMATS` from `@core/types`
- Single source of truth now in `src/core/types.ts`

### Fix 3: Missing .catch() on resetConfig() promise
- Added `.catch((e: unknown) => { console.error('Failed to reset config:', e) })` to `handleSettingsReset` in `src/renderer/src/App.tsx`
- Prevents unhandled promise rejection if disk write fails during reset

### Fix 4: fontFamily empty string validation
- Added `if (draft.ui.fontFamily.trim() === '') { errors['ui.fontFamily'] = 'Required' }` to `validateConfig()` in SettingsPanel.tsx
- Added `setErrors(validateConfig(next))` call in `updateFontFamily` callback (was missing)
- Added error display (`.is-error` class + error message span) to fontFamily input in JSX

### Fix 5: CSS input style deduplication
- Added `.settings-panel__input` to the shared selector group with `.filter-bar__input` and `.lane-add-input__field`
- Also added to `:focus` and `::placeholder` shared selectors
- Replaced the duplicated full `.settings-panel__input` block with only the `width: 100%` override

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
| `src/main/config-manager.ts` | Imported HEX_COLOR_PATTERN from config-validation (removed local duplicate) |
| `src/core/config-validation.ts` | Removed VIEW_TIMESTAMP_FORMAT_OPTIONS (use VIEW_TIMESTAMP_FORMATS from types.ts instead) |
| `tests/unit/core/config-validation.test.ts` | Updated to use VIEW_TIMESTAMP_FORMATS from types.ts |

## Key Design Decisions

1. **Draft state LOCAL to SettingsPanel** -- Does NOT propagate every keystroke to AppShell. Only `applyConfigToCSS` (debounced 150ms) fires during preview. Parent state updates only on Save/Reset. This prevents unnecessary re-renders and avoids the `useLogIngestion` IPC teardown issue identified in the plan review.

2. **Props split: onSave + onReset** -- Cleaner than a single `onConfigChange` callback. `onSave` handles disk write + state update + eviction + close. `onReset` calls IPC, receives defaults, updates state + CSS + eviction + close.

3. **Conditional rendering (return null when closed)** -- Instead of CSS class toggle with `.settings-panel--closed`. No close animation per 80/20. Simpler E2E testing (count=0 when closed).

4. **Color swatch inline style** -- Only exception to "no inline styles" rule. backgroundColor is dynamic from user input. All other styles use CSS classes.

5. **Gear icon positioning** -- `margin-left: auto` on `.settings-trigger` pushes it to the right side of the flex toolbar. `aria-label="Settings"` for accessibility.

6. **Validation** -- `validateConfig()` runs on every draft change and produces a `ValidationErrors` map keyed by field path (e.g., `colors.levels.trace`, `ui.rowHeight`, `ui.fontFamily`). Save button disabled when errors exist. Uses `isValidHexColor` and `isInRange` from Phase 7A's `config-validation.ts`.

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
