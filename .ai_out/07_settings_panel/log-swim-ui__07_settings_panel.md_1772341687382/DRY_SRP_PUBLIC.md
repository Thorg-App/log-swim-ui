# DRY/SRP Analysis -- Phase 07: Settings Panel

## Summary

Three DRY violations found and fixed. No SRP violations found. All 238 unit tests pass. Typecheck clean.

---

## Fixes Applied

### Fix 1: CSS segmented toggle duplication

**Files**: `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/renderer/theme/components.css`

**Problem**: `.filter-bar__type-toggle` (lines 325-351) and `.settings-panel__segmented-option` (lines 578-607) had nearly identical CSS declarations -- both represent the same visual concept: a segmented button group with `:first-child` rounding, `:last-child` rounding, `border-left: none` removal, and `--active` state styling. The only difference was padding (`--space-2` vs `--space-3`).

**Change test**: If the design system updates how segmented controls look (e.g., border style, active color, font), both must change. This is the same knowledge.

**Fix**: Unified into shared multi-selector groups (base, `:first-child`, `:last-child`, `:not(:first-child)`, `--active`). Each component keeps only its padding override. Also corrected the filter-bar's `border-left: none` from `:last-child` to `:not(:first-child)` (the correct approach for N children, not just 2).

**Lines removed**: ~25 (duplicated declarations in settings panel section).

### Fix 2: Number field updater duplication in SettingsPanel

**File**: `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/renderer/src/components/SettingsPanel.tsx`

**Problem**: `updateUiNumber` and `updatePerformanceNumber` had identical logic -- `parseInt`, NaN guard, empty-to-0 conversion, `setDraftConfig` with spread, `setErrors(validateConfig(...))`, `applyPreview(...)`. The only difference was the config section key (`ui` vs `performance`).

**Change test**: If the number parsing/validation/state-update pattern changes (e.g., support floats, change empty-field behavior), both must change. This is the same knowledge.

**Fix**: Extracted a single `updateNumber(section: 'ui' | 'performance', key: string, value: string)` callback. Call sites updated from `updateUiNumber('rowHeight', ...)` to `updateNumber('ui', 'rowHeight', ...)`.

**Lines removed**: ~13 (one entire callback eliminated).

### Fix 3: Config change application duplication in App.tsx

**File**: `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/renderer/src/App.tsx`

**Problem**: `handleSettingsSave` and `handleSettingsReset` both contained the same 6-line pattern: `setConfig(config)`, `applyConfigToCSS(config)`, eviction check (`maxLogEntries < masterList.length` -> `setMaxEntries` + `bumpVersion`), `setSettingsOpen(false)`.

**Change test**: If the config application sequence changes (e.g., add a notification, change eviction logic, add cleanup), both must change. This is the same knowledge.

**Fix**: Extracted `applyConfigChange(newConfig: AppConfig)` helper within AppShell. `handleSettingsSave` calls it after IPC save. `handleSettingsReset` calls it in the `.then()` handler after IPC reset.

**Lines removed**: ~8 (duplicated application logic).

---

## Issues Evaluated and NOT Fixed

### Non-level color field names in SettingsPanel vs ConfigManager

`NON_LEVEL_COLOR_FIELDS` in `SettingsPanel.tsx` and `colorFields` in `config-manager.ts` both list `['unrecognizedLevel', 'swimlaneHeaders', 'background', 'rowHover', 'expandedRow']`. While the key names are duplicated, the SettingsPanel version includes UI labels (different data shape). The `AppConfigColors` interface in `types.ts` is already the authoritative source -- TypeScript will catch misalignment at compile time if a field is added to the interface but not to these lists. The cost of extraction (shared constant in core with UI labels leaking into core) outweighs the benefit. Not worth fixing.

### SettingsPanel.tsx size (~440 lines after fixes)

The component handles validation, draft state, debounced preview, and form rendering. These all change on the same axis: "a config field is added or modified." Splitting into sub-components (ColorSection, UiSection, PerformanceSection) would add indirection and prop-threading for no SRP benefit. If the panel grows significantly in future phases, extraction would then be justified. Correct to leave as-is per 80/20.

### SRP of App.tsx settings integration

The settings handlers in AppShell (`applyConfigChange`, `handleSettingsSave`, `handleSettingsReset`) are cohesive with the rest of AppShell's responsibility: top-level app state coordination. They interact with `setConfig`, `masterList`, `bumpVersion`, and `setSettingsOpen` -- all AppShell-local state. No SRP violation.

---

## Verification

| Check | Result |
|-------|--------|
| `npm test` | 238 tests passed |
| `npm run typecheck` | Clean |

## Files Modified

| File | Change |
|------|--------|
| `src/renderer/theme/components.css` | Unified segmented toggle CSS into shared selectors; removed ~25 lines of duplication |
| `src/renderer/src/components/SettingsPanel.tsx` | Merged `updateUiNumber` + `updatePerformanceNumber` into `updateNumber`; removed ~13 lines |
| `src/renderer/src/App.tsx` | Extracted `applyConfigChange` helper from duplicated save/reset logic; removed ~8 lines |
