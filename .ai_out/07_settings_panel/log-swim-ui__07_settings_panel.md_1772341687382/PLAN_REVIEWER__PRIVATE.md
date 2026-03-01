# PLAN_REVIEWER Private Context -- Phase 07: Settings Panel

## Key Findings from Source Code Verification

### useLogIngestion Config Dependency (CRITICAL)
- File: `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/renderer/src/useLogIngestion.ts`
- Line 98: `}, [masterList, lanesRef, config])`
- Line 97 comment: `// config stability is assumed (never changes after init; Phase 07 may need ref pattern too).`
- The `config` is in the effect dependency array. If config becomes state and changes on every keystroke, the entire IPC listener setup tears down and re-creates. This is the biggest issue in the plan.
- The fix is straightforward: use a `configRef` pattern like `lanesRef`. The LogBuffer uses `config.performance.flushIntervalMs` only at creation time. Once created, the buffer interval doesn't change. So the ref pattern is safe.

### applyConfigToCSS Missing fontFamily
- File: `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/renderer/src/applyConfigToCSS.ts`
- Sets: level colors, other colors, `--row-height`, `--text-sm`
- Does NOT set: `--font-mono` (which is what `fontFamily` config maps to)
- The CSS uses `var(--font-mono)` in 8+ places for monospace text
- Without this fix, changing fontFamily in settings would have no visible effect

### MasterList maxEntries Field
- File: `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/core/master-list.ts`
- Line 10: `private readonly maxEntries: number`
- Needs `readonly` removed to allow `setMaxEntries` to work
- The `evict()` method (line 85-89) works by splicing from index 0 -- straightforward

### CSS Infrastructure Already In Place
- File: `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/renderer/theme/components.css`
- Lines 456-506: `.settings-backdrop`, `.settings-panel`, `.settings-panel--closed`, `.settings-panel__section`, `.settings-panel__section-title`, `.settings-panel__field`, `.settings-panel__label`
- Tokens: `--color-backdrop`, `--color-panel-bg`, `--settings-panel-width` (check tokens.css -- need to verify `--settings-panel-width` exists)

### Color Divergence
- `tokens.css` line 78: `--color-level-trace: #6B7280`
- `types.ts` line 146: `trace: '#6c757d'`
- These differ. At runtime, `applyConfigToCSS` overwrites the CSS vars with config values, so `DEFAULT_APP_CONFIG` wins.
- Reconciliation should update `DEFAULT_APP_CONFIG` to match `tokens.css` (the design-system values).

### ConfigValidator Range Checks
- File: `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/main/config-manager.ts`
- Currently validates: `> 0` for numbers, hex pattern for colors, non-empty string for fontFamily, valid enum for viewTimestampFormat
- Adding range checks (e.g., rowHeight must be 16-128) would BREAK existing configs where someone has `rowHeight: 10` or `rowHeight: 200`
- This is a subtle breaking change that the plan doesn't call out

### Preload Bridge
- File: `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/preload/index.ts`
- Clean pattern for adding `resetConfig`. Just needs another line in the `api` object.
- Also needs the `RESET_CONFIG` channel in `IPC_CHANNELS`

### App.tsx Structure
- File: `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/renderer/src/App.tsx`
- `AppShell` receives `config` as a prop from `App` (which gets it from `useAppInit`)
- Promoting to state: `useState(config)` with prop as initial value -- standard React pattern
- The `useLogIngestion` is called at line 73 with `config` -- this is where the ref pattern change is needed

## Decisions Made in Review
1. Recommended against updating ConfigValidator with range checks (breaking change risk)
2. Recommended draft-local-to-SettingsPanel (not propagated to AppShell on every keystroke)
3. Recommended configRef pattern for useLogIngestion
4. Accepted 80/20 decisions: no collapsible sections, no animation, flush interval restart-only
