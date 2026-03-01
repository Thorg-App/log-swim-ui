# Phase 05: DRY/SRP Analysis and Fixes

## Files Analyzed

All 16 Phase 05 implementation files plus `tokens.css` for cross-reference:

- `src/renderer/src/App.tsx`
- `src/renderer/src/timestamp-formatter.ts`
- `src/renderer/src/ipc-converters.ts`
- `src/renderer/src/useAppInit.ts`
- `src/renderer/src/useLogIngestion.ts`
- `src/renderer/src/ErrorScreen.tsx`
- `src/renderer/src/log-row-utils.ts`
- `src/renderer/src/scroll-utils.ts`
- `src/renderer/src/applyConfigToCSS.ts`
- `src/renderer/src/components/SwimLaneGrid.tsx`
- `src/renderer/src/components/LaneHeader.tsx`
- `src/renderer/src/components/LogRow.tsx`
- `src/renderer/src/components/ModeToggle.tsx`
- `src/renderer/src/components/StreamEndIndicator.tsx`
- `src/renderer/src/components/UnparseablePanel.tsx`
- `src/core/types.ts`
- `src/renderer/theme/components.css`
- `src/renderer/theme/tokens.css`

---

## DRY Violations Found and Fixed

### DRY-1: Known log level list duplicated across TypeScript files

**Problem**: The list of 9 recognized log level names (`trace`, `debug`, `info`, `notice`, `warn`, `warning`, `error`, `fatal`, `critical`) was maintained independently in two places:

1. `src/renderer/src/log-row-utils.ts` -- `KNOWN_LOG_LEVELS` Set (for CSS class mapping)
2. `src/renderer/src/applyConfigToCSS.ts` -- `CSS_VAR_MAP_LEVELS` array of `[level, cssVar]` tuples (for config-to-CSS-variable mapping)

The CSS variable naming convention is mechanical: level `X` maps to `--color-level-X`. The CSS class convention is equally mechanical: level `X` maps to `.log-row--X`. Both derive from the same knowledge: "what are the recognized log levels?" Adding a new level would require updating both files.

Note: `components.css` also lists these levels in static CSS rules (`.log-row--trace`, etc.). This is acceptable cross-medium duplication since CSS cannot import from TypeScript -- but a comment was added to the source of truth to make the manual sync obligation visible.

**Fix**:

- **`src/core/types.ts`**: Added `KNOWN_LOG_LEVELS` as a `readonly` array constant and `KnownLogLevel` type. This is the single source of truth.
- **`src/renderer/src/log-row-utils.ts`**: Removed the local `KNOWN_LOG_LEVELS` Set definition. Now imports `KNOWN_LOG_LEVELS` from `@core/types` and derives a `KNOWN_LOG_LEVELS_SET` for O(1) lookup. Removed the re-export of `KNOWN_LOG_LEVELS` (consumers should import from `@core/types`).
- **`src/renderer/src/applyConfigToCSS.ts`**: Removed the hardcoded `CSS_VAR_MAP_LEVELS` array. Now imports `KNOWN_LOG_LEVELS` from `@core/types` and derives the CSS variable mapping via `.map()` using the mechanical naming convention.

### DRY-2: Duplicate config type interfaces in `applyConfigToCSS.ts`

**Problem**: `applyConfigToCSS.ts` defined its own `ConfigColors`, `ConfigUI`, and `PartialConfig` interfaces that were structural duplicates (subsets) of `AppConfigColors`, `AppConfigUI`, and `AppConfig` from `src/core/types.ts`. This was a Phase 02 artifact -- the function was stubbed before the real config types existed. If the config shape changed, both locations would need updating.

The `PartialConfig` wrapper (with all-optional fields) was also unnecessarily defensive: the function is only ever called with a full `AppConfig` from `useAppInit.ts`.

**Fix**:

- **`src/renderer/src/applyConfigToCSS.ts`**: Removed all three duplicate interfaces (`ConfigColors`, `ConfigUI`, `PartialConfig`). The function now accepts `AppConfig` directly from `@core/types`. Since all fields are guaranteed present, the defensive `if (config.colors?.X)` guards were replaced with direct property access. The `if (value)` guard on level colors was preserved because `config.colors.levels` is `Record<string, string>` and may not contain every known level name.

---

## SRP Analysis: No Violations Found

Each module has a single, cohesive reason to change:

| Module | Single Responsibility | Assessment |
|--------|----------------------|------------|
| `useAppInit.ts` | Initialization orchestration (load config, CLI args, create MasterList) | Clean |
| `useLogIngestion.ts` | IPC wiring + log data state management (version, stream state, unparseable tracking, view mode) | Clean -- mode state belongs here because mode transitions are coupled to data arrival (live auto-scroll) |
| `timestamp-formatter.ts` | Format timestamps for display in 3 modes | Clean |
| `ipc-converters.ts` | Convert IPC types to renderer types | Clean |
| `log-row-utils.ts` | Pure display utilities for LogRow (CSS class, message preview, grid column, lane count) | Clean |
| `scroll-utils.ts` | Scroll-up detection logic | Clean |
| `applyConfigToCSS.ts` | Map config values to CSS custom properties | Clean |
| `App.tsx` | Top-level app state machine (loading/error/ready) | Clean |
| `SwimLaneGrid.tsx` | Virtualized grid layout with auto-scroll | Clean |
| `LogRow.tsx` | Single log row rendering (collapsed/expanded) | Clean |
| `LaneHeader.tsx` | Lane column header rendering | Clean |
| `ModeToggle.tsx` | Live/Scroll mode toggle UI | Clean |
| `StreamEndIndicator.tsx` | Stream-ended badge | Clean |
| `UnparseablePanel.tsx` | Failed-timestamp entries panel | Clean |
| `ErrorScreen.tsx` | Full-screen error display with config revert | Clean |

---

## Verification

- `npm test`: **180 tests pass** (14 test files) -- no tests modified, skipped, or removed
- `npm run typecheck`: **Clean** (0 errors)

---

## Files Modified

| File | Change |
|------|--------|
| `src/core/types.ts` | Added `KNOWN_LOG_LEVELS` constant, `KnownLogLevel` type, and their exports |
| `src/renderer/src/log-row-utils.ts` | Replaced local `KNOWN_LOG_LEVELS` Set with import from `@core/types`; derives `KNOWN_LOG_LEVELS_SET` locally for O(1) lookup |
| `src/renderer/src/applyConfigToCSS.ts` | Removed 3 duplicate interfaces; uses `AppConfig` from `@core/types`; derives `CSS_VAR_MAP_LEVELS` from shared `KNOWN_LOG_LEVELS` |
