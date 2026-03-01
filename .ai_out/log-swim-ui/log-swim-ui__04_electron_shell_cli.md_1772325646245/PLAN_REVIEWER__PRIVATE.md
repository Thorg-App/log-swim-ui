# Plan Reviewer Private Context -- Phase 04

## Review Session Summary

- **Date**: 2026-03-01
- **Reviewed plan**: `PLANNER__PUBLIC.md` for Phase 04: Electron Shell & CLI
- **Verdict**: APPROVED WITH MINOR REVISIONS, plan iteration can be skipped

## Key Files Examined

- `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/.ai_out/log-swim-ui/log-swim-ui__04_electron_shell_cli.md_1772325646245/PLANNER__PUBLIC.md` -- The implementation plan
- `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/.ai_out/log-swim-ui/log-swim-ui__04_electron_shell_cli.md_1772325646245/EXPLORATION_PUBLIC.md` -- Exploration context
- `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/doc/ralph/log-swim-ui/tasks/todo/04_electron_shell_cli.md` -- Original task spec
- `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/doc/ralph/log-swim-ui/log-swim-ui-high-level.md` -- High-level spec
- `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/core/types.ts` -- Existing types
- `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/main/index.ts` -- Current main process stub
- `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/preload/index.ts` -- Current preload stub
- `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/core/stdin-reader.ts` -- StdinReader implementation
- `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/core/timestamp-detector.ts` -- TimestampDetector implementation
- `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/core/json-parser.ts` -- JsonParser implementation
- `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/electron.vite.config.ts` -- Build config
- `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/vitest.config.ts` -- Test config
- `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/tsconfig.node.json` -- Node tsconfig
- `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/tsconfig.web.json` -- Web tsconfig
- `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/bin/log-swim-ui.js` -- CLI entry point stub

## Critical Adjustments for Implementor

### 1. First-line error = halt ingestion (MC-01)

The spec is clear: first-line JSON parse failure or timestamp detection failure halts ingestion. The IPC bridge should:
- Send `stream-error` to renderer with descriptive message
- Close the readline interface (`rl.close()`)
- NOT continue reading subsequent lines

This is architecturally simple -- in the `onLine` callback, after detecting a first-line failure, call a `stop()` method that closes the readline interface.

The IpcBridge needs to hold a reference to either the readline interface or have a stop mechanism. Consider:
```typescript
private rl: Interface | null = null

start(input: Readable): void {
  this.rl = StdinReader.startAndReturn(input, callbacks)
  // OR: manage the readline lifecycle directly instead of using StdinReader.start()
}

private stop(): void {
  this.rl?.close()
}
```

Wait -- `StdinReader.start()` is a void static method. It does not return the readline interface. The implementor has two options:
1. Modify `StdinReader.start()` to return the readline Interface -- but this changes a Phase 03 class
2. Have `IpcBridge` create the readline interface itself and not use `StdinReader` -- duplicating logic
3. Add a `StdinReader.startWithHandle()` method that returns a handle with a `close()` method

Option 3 is cleanest (OCP -- extend without modifying). But this is a detail for the implementor.

### 2. bin/log-swim-ui.js needs updating (MC-02)

The current stub exits immediately with an error. For the acceptance criteria to be met, it needs to spawn Electron. This is a simple script change but the plan explicitly says it's not needed. The implementor should either:
- Update it (preferred), or
- Document that CLI launch is tested via `npm run dev` and bin is deferred to a packaging phase

### 3. DEFAULT_APP_CONFIG reconciliation (MI-06)

The Phase 03 callout explicitly deferred this to Phase 04. The current defaults differ from the spec:
- Spec: `"info": "#3B82F6"` / Current: `"info": "#198754"`
- Spec: `"rowHeight": 32` / Current: `"rowHeight": 28`
- Several other color differences

This should be done in Phase 4A when touching `types.ts`.

### 4. Relative imports for tests (TF-05)

Using `@main` alias requires changes to both `vitest.config.ts` and `tsconfig.node.json` (for IDE support). For 2 test files, relative imports are simpler. The imports would be:
- `import { CliParser } from '../../../src/main/cli-parser'`
- `import { ConfigManager } from '../../../src/main/config-manager'`

Not beautiful but consistent with having no alias.

## Observations Not in Public Review

1. The plan does not mention `sandbox: false` in the BrowserWindow webPreferences. This is already in the current code and is needed for the preload script to work with `contextBridge`. This is fine for now but should eventually be tightened.

2. The `StdinMessage` type is being superseded by `IpcLogLine` + separate channels. The plan says `StdinMessage` "remains for backward compatibility" but nothing uses it. It could be removed, but leaving dead types is low-cost and removing them is also low-cost. Not worth calling out.

3. The `window-all-closed` handler currently calls `app.quit()` unconditionally (even on macOS). This is correct for a CLI tool that should exit when the window is closed. The plan preserves this behavior.

4. The plan's `ElectronApi` interface has a `saveConfig` method that accepts `AppConfig`. The config manager's `save` method should validate the config before writing. The plan does not mention validation on save -- only on load. This is a potential gap but low-risk since the only caller will be the settings panel UI which produces valid configs. Not worth blocking on.
