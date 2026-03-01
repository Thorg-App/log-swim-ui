# PLAN_REVIEWER Public Context -- Phase 07: Settings Panel

## Review Verdict: APPROVED WITH MINOR REVISIONS

The plan is solid and well-researched. Five revisions are needed before implementation.

## Required Revisions (2 blockers, 1 major, 2 minor)

### BLOCKER 1: useLogIngestion must use configRef pattern
- `useLogIngestion` has `config` in its effect dependency array (line 98 of `useLogIngestion.ts`)
- The existing code comment already flags this: "config stability is assumed; Phase 07 may need ref pattern too"
- If `config` becomes state that changes on draft keystrokes, every change tears down IPC listeners and recreates LogBuffer
- **Fix:** Add a `configRef` pattern (like `lanesRef`), remove `config` from the dependency array. The LogBuffer reads `flushIntervalMs` only at creation time, so the ref is safe.

### BLOCKER 2: Draft changes must NOT propagate to AppShell on every keystroke
- The plan says every draft change calls `onConfigChange(draftConfig)` which updates AppShell state
- This triggers parent re-renders on every keystroke and runs `maxLogEntries` eviction check during preview
- **Fix:** Keep `draftConfig` local to `SettingsPanel`. Only `applyConfigToCSS(draftConfig)` fires during preview (debounced). `onConfigChange` fires only on Save/Reset. On close, CSS vars stay applied (per spec). On re-open, draft initializes from AppShell's authoritative (saved) config.

### MAJOR: Extend applyConfigToCSS to handle fontFamily
- Current `applyConfigToCSS` does NOT set `--font-mono` (the CSS var used in 8+ places)
- Without this, changing `fontFamily` in settings has no visible effect
- **Fix:** Add `root.style.setProperty('--font-mono', config.ui.fontFamily)` to `applyConfigToCSS`

### MINOR: Do NOT update ConfigValidator range checks
- Adding range validation (e.g., rowHeight 16-128) to `ConfigValidator` would reject existing valid configs (e.g., `rowHeight: 10`)
- **Fix:** Export `CONFIG_CONSTRAINTS` from `types.ts` for SettingsPanel UI validation. Leave `ConfigValidator` with its current `> 0` checks. Tightening file validation is a separate decision.

### MINOR: Clarify MasterList.maxEntries change
- The field is `private readonly maxEntries: number`. The `readonly` keyword must be removed.
- Plan wording is slightly ambiguous. Just be explicit: change `private readonly` to `private`.

## Key Architecture Decisions (Validated)

These plan decisions are confirmed as correct:
1. Config as state in AppShell -- needed for settings to work
2. No collapsible sections -- good 80/20 choice
3. Flush interval restart-only -- correct, LogBuffer recreation is too complex for the value
4. `CONFIG_CONSTRAINTS` as single source of truth for validation bounds
5. Clean 7A/7B split

## Files Verified Against Plan Assumptions

| File | Plan Assumption | Verified |
|------|----------------|----------|
| `src/core/types.ts` | `IPC_CHANNELS` needs `RESET_CONFIG`, `ElectronApi` needs `resetConfig` | Yes, straightforward additions |
| `src/core/master-list.ts` | `maxEntries` is `private readonly` | Yes, line 10 |
| `src/main/config-manager.ts` | Has `save()`, needs `reset()` | Yes, `reset()` = `save(DEFAULT_APP_CONFIG)` |
| `src/main/index.ts` | IPC handlers registered in `app.whenReady` | Yes, lines 86-92 |
| `src/preload/index.ts` | Standard invoke pattern for request channels | Yes, lines 31-33 |
| `src/renderer/src/App.tsx` | `config` is immutable prop from `useAppInit` | Yes, line 54 |
| `src/renderer/src/applyConfigToCSS.ts` | Handles level colors, other colors, rowHeight, fontSize | Yes, but MISSING fontFamily |
| `src/renderer/src/useLogIngestion.ts` | `config` in dependency array, comment about Phase 07 | Yes, line 97-98 |
| `src/renderer/theme/components.css` | Settings panel CSS exists | Yes, lines 456-506 |
