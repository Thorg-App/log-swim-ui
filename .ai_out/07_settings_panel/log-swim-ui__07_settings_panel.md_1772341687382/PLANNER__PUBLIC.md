# PLANNER Public Context -- Phase 07: Settings Panel

## Plan Summary

Phase 07 is split into two sub-phases for manageable review:

### Phase 7A: Backend/IPC Layer
- Add `RESET_CONFIG` to `IPC_CHANNELS` and `resetConfig` to `ElectronApi` in `src/core/types.ts`
- Add `CONFIG_CONSTRAINTS` (min/max values) to `src/core/types.ts`
- Create `src/core/config-validation.ts` with shared pure validation functions (`isValidHexColor`, `isInRange`)
- Add `reset()` method to `ConfigManager`
- Add `setMaxEntries(n)` to `MasterList` (for immediate eviction when limit decreased)
- Register `RESET_CONFIG` IPC handler in main process
- Add `resetConfig` to preload bridge
- Update `ConfigValidator` to use `CONFIG_CONSTRAINTS`
- Unit tests for all new methods

### Phase 7B: Settings Panel UI
- Create `SettingsPanel.tsx` component with three sections (Colors, UI, Performance)
- Promote `config` to React state in `AppShell` (was immutable prop)
- Add gear icon to toolbar
- Live CSS variable preview on every draft change (debounced 150ms)
- Save button persists to disk via IPC
- Reset to Defaults button
- Inline validation with error states
- `maxLogEntries` decrease triggers immediate eviction via `MasterList.setMaxEntries()`
- `flushIntervalMs` changes noted as "takes effect on restart" (not hot-reloadable)
- E2E test: open settings, change color, verify CSS variable updated, close panel

## Key Architecture Decisions

1. **Config as state in AppShell**: Every draft change in SettingsPanel propagates to AppShell state via `onConfigChange` callback. Save additionally persists to disk. This satisfies "closing panel does NOT discard unsaved changes from the live preview".

2. **Shared validation**: `src/core/config-validation.ts` provides pure functions used by both `ConfigValidator` (main process) and `SettingsPanel` (renderer). `CONFIG_CONSTRAINTS` constants are the single source of truth for min/max values.

3. **No collapsible sections**: Always-open sections for 80/20. Collapsibility can be trivially added later.

4. **Flush interval NOT hot-reloadable**: LogBuffer is created once on mount. Complexity of recreating it mid-session is not justified.

## Files Changed

### New
- `src/renderer/src/components/SettingsPanel.tsx`
- `src/core/config-validation.ts`
- `tests/unit/core/config-validation.test.ts`

### Modified
- `src/core/types.ts` (IPC channel, ElectronApi method, CONFIG_CONSTRAINTS)
- `src/core/master-list.ts` (setMaxEntries)
- `src/main/config-manager.ts` (reset method, use CONFIG_CONSTRAINTS)
- `src/main/index.ts` (RESET_CONFIG handler)
- `src/preload/index.ts` (resetConfig bridge)
- `src/renderer/src/App.tsx` (config state, settings integration, gear icon)
- `src/renderer/theme/components.css` (settings field styles)
- `tests/unit/main/config-manager.test.ts` (reset tests)
- `tests/unit/core/master-list.test.ts` (setMaxEntries tests)
- `tests/e2e/app.spec.ts` (settings E2E test)

## Open Decisions for Human Engineer
1. Reconcile `DEFAULT_APP_CONFIG` colors with spec? (Phase 03 callout deferred to Phase 07)
2. Collapsible sections: skip for now (recommended) or implement?
