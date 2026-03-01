# PLANNER Private Context -- Phase 07: Settings Panel

## Key Findings During Exploration

### Current Config Flow
- `useAppInit` loads config via `window.api.getConfig()` and calls `applyConfigToCSS(config)` once
- Config is passed as a prop to `AppShell`, which passes it to `useLogIngestion` and `SwimLaneGrid`
- Config is IMMUTABLE after init -- no mechanism to change it at runtime
- `useLogIngestion` has a comment: "config stability is assumed (never changes after init; Phase 07 may need ref pattern too)"

### MasterList maxEntries
- `maxEntries` is `private readonly` in MasterList -- needs to become mutable for settings eviction
- `evict()` is private -- `setMaxEntries` can just update the field and call it
- The `_entries` array is mutated in place via splice -- eviction is straightforward

### CSS Panel Infrastructure Already Done
- `.settings-panel`, `.settings-backdrop`, `.settings-panel__section`, `.settings-panel__section-title`, `.settings-panel__field`, `.settings-panel__label` all exist in components.css
- Tokens: `--color-backdrop`, `--color-panel-bg`, `--settings-panel-width`, `--shadow-5`, `--transition-normal` all defined
- The `.settings-panel--closed` class uses `transform: translateX(100%)` for hide state

### Config State Design Decision
- Considered: keeping config immutable in AppShell and only using draft in SettingsPanel
- Problem: spec says "Closing panel does NOT discard unsaved changes from the live preview"
- Solution: Every draft change propagates to AppShell state. Save additionally persists to disk.
- This means AppShell state may diverge from disk state (unsaved preview). This is intentional per spec.

### Flush Interval NOT Hot-Reloadable
- LogBuffer is created once in useLogIngestion effect
- Recreating it would require draining + re-wiring IPC callbacks
- Not worth the complexity -- "takes effect on restart" is acceptable

### Validation Sharing
- ConfigValidator in main process validates on file load
- SettingsPanel in renderer needs same validation for user input
- Solution: shared pure functions in src/core/config-validation.ts
- HEX_COLOR_PATTERN already exists in config-manager.ts -- will be moved to shared location

### E2E Test Approach
- Follow existing pattern: launchApp, interact, verify
- Settings panel test needs to evaluate CSS variables via page.evaluate
- No need for IPC log injection -- just open settings and change a color

### Open: DEFAULT_APP_CONFIG Color Reconciliation
- Phase 03 callout: current colors differ from spec
- Current: trace=#6c757d, debug=#0dcaf0, info=#198754, etc.
- Spec: trace=#6B7280, debug=#94A3B8, info=#3B82F6, etc.
- Recommend reconciling in this phase since it's config-focused
- BUT: reconciling changes the visual appearance of the app -- may break E2E screenshot expectations
- Decision: Recommend reconciling but flag it as a decision for human engineer
