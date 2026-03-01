# Phase 04: Electron Shell & CLI -- Implementation Review

## Verdict: APPROVED_WITH_FEEDBACK

All 132 tests pass. TypeScript typecheck clean (both `tsconfig.node.json` and `tsconfig.web.json`). No existing tests removed. All 12 acceptance criteria met. The implementation is solid, well-structured, and follows the plan with appropriate deviations (SO-01 channel consolidation, MC-01 halt ingestion, MC-02 bin update). The issues below are non-blocking but should be addressed in a follow-up or before merge if time permits.

---

## Summary

Phase 04 wires up the Electron main process with CLI argument parsing, config file management, stdin-to-renderer IPC bridge, and preload script. The implementation adds:

- **`src/main/cli-parser.ts`** -- Hand-rolled CLI parser for `--key-level`, `--key-timestamp`, `--lanes`
- **`src/main/config-manager.ts`** -- Config file loading, validation, deep merge, and saving
- **`src/main/ipc-bridge.ts`** -- Stdin -> JsonParser -> TimestampDetector -> IPC pipeline with first-line halt semantics
- **`src/preload/index.ts`** -- Fully implemented `contextBridge` API with whitelisted channels
- **`src/main/index.ts`** -- Main process startup orchestration
- **`bin/log-swim-ui.js`** -- CLI entry point that spawns Electron with stdin forwarding
- **`src/core/types.ts`** -- Added `IpcLogLine`, `IPC_CHANNELS`, `ElectronApi`, `CliArgsResult`
- **`src/core/stdin-reader.ts`** -- Added `StdinReaderHandle` with `stop()` for ingestion halt
- **57 new tests** (33 CLI parser + 24 config manager), all BDD style with GIVEN/WHEN/THEN

---

## CRITICAL Issues

None.

---

## IMPORTANT Issues

### I-01: Preload imports from `src/core/` -- CLAUDE.md architecture table violation

**Files**: `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/preload/index.ts` (lines 2-3)

```typescript
import { IPC_CHANNELS } from '../core/types'
import type { ElectronApi } from '../core/types'
```

The CLAUDE.md import rules table states:

| Directory | Can import from | Cannot import from |
|-----------|----------------|-------------------|
| `src/preload/` | `electron` (contextBridge) | `react`, `src/renderer/`, **`src/core/`** |

The plan reviewer (MI-03) accepted this deviation, reasoning that it avoids duplicating `IPC_CHANNELS` (DRY). This is pragmatically correct -- the alternative (duplicating constants) is worse. However, the CLAUDE.md table should be updated to reflect this accepted pattern, otherwise the next developer will see a violation.

**Recommendation**: Update the CLAUDE.md table to allow `src/preload/` to import **types and constants** from `src/core/types.ts`. This keeps the rule explicit rather than having a silent deviation.

### I-02: Missing `// WHY:` comments on `as` type assertions in config-manager.ts

**File**: `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/main/config-manager.ts`

CLAUDE.md states: "No type assertions (`as`) unless justified with a `// WHY:` comment explaining why it is safe."

There are 7 `as` assertions in `config-manager.ts` without WHY comments:

- Line 33: `loaded['colors'] as Record<string, unknown>`
- Line 49: `colors['levels'] as Record<string, unknown>`
- Line 132: `const src = loaded as Record<string, unknown>`
- Line 149: `const src = loaded as Record<string, unknown>`
- Line 188: `src['viewTimestampFormat'] as AppConfigUI['viewTimestampFormat']`
- Line 195: `const src = loaded as Record<string, unknown>`
- Line 267: `const loadedRecord = parsed as Record<string, unknown>`

Each one IS justified (they follow `typeof x === 'object' && x !== null` guards), but the WHY comments are missing per project standards. A single-line comment like `// WHY: narrowed from unknown by typeof+null check above` would satisfy the standard.

### I-03: `ConfigValidator` is exported but unused outside `config-manager.ts`

**File**: `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/main/config-manager.ts` (line 26)

`ConfigValidator` is a class but is not exported -- good. However, it is a stateful class (uses `this.errors`) that is instantiated per `load()` call. The `errors` array is cleared via `this.errors.length = 0` at the start of `validate()`. This works but is an unusual pattern -- creating a new instance per call would be cleaner. Alternatively, making `validate()` static and returning errors without instance state would follow the project's static utility pattern (like `JsonParser`, `CliParser`).

**NON-BLOCKING** -- the current implementation works correctly.

### I-04: Validate-before-merge rejects entire config on partial invalid fields

**File**: `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/main/config-manager.ts` (lines 269-279)

The implementation validates the raw JSON before merging with defaults (design decision D7). This means if a user has:
```json
{ "ui": { "rowHeight": 40, "fontSize": "big" } }
```

The validation catches `fontSize: "big"` and rejects the ENTIRE config, falling back to all defaults. The user's valid `rowHeight: 40` setting is lost.

A merge-first approach would be more user-friendly: accept valid fields, fall back to defaults for invalid ones. The deep merge functions already implement this field-by-field fallback logic -- the validator then becomes a notification mechanism rather than a gate.

**NON-BLOCKING** -- this was an explicit design decision (D7). Consider revisiting in a future phase if user feedback indicates this is a problem.

---

## Suggestions

### S-01: `CliArgs` and `CliArgsResult` types are structurally identical

**Files**:
- `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/main/cli-parser.ts` (lines 3-7) -- `CliArgs`
- `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/core/types.ts` (lines 108-112) -- `CliArgsResult`

Both have `keyLevel: string`, `keyTimestamp: string`, `lanePatterns: readonly string[]`. Consider having `CliParser.parse()` return `CliArgsResult` directly (from core types), or have `CliArgs` extend `CliArgsResult`. This eliminates the structural duplication without breaking architectural boundaries.

### S-02: Listener leak potential in preload push channels

**File**: `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/preload/index.ts` (lines 7-14)

The `onLogLine`, `onStreamEnd`, `onStreamError`, and `onConfigError` methods call `ipcRenderer.on()` but provide no way to remove listeners. If a renderer component calls `window.api.onLogLine(callback)` multiple times (e.g., on re-render), multiple listeners accumulate.

**Recommendation for Phase 05**: Return a cleanup function from each `on*` method:
```typescript
onLogLine: (callback) => {
  const handler = (_event: Electron.IpcRendererEvent, line: IpcLogLine) => callback(line)
  ipcRenderer.on(IPC_CHANNELS.LOG_LINE, handler)
  return () => ipcRenderer.removeListener(IPC_CHANNELS.LOG_LINE, handler)
}
```

This would require updating the `ElectronApi` return types. Not needed now since the renderer doesn't use these yet.

### S-03: macOS `activate` handler creates window without IPC bridge

**File**: `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/main/index.ts` (lines 87-91)

```typescript
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
```

On macOS, if the user closes and re-activates the app, a new window is created but the IPC bridge and `did-finish-load` listener are not set up for it. The new window would be non-functional (no log data, no config error). For a piped-stdin app this is unlikely to matter in practice (stdin has already been consumed or is still being consumed by the original bridge), but the window would be a blank shell.

**NON-BLOCKING** -- edge case that may never occur in practice. Worth noting for future phases.

### S-04: `bin/log-swim-ui.js` uses `require()` (CommonJS) -- consider ESM

**File**: `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/bin/log-swim-ui.js`

The file uses `require()` for `child_process`, `path`, and `electron`. This is fine since `package.json` likely doesn't have `"type": "module"`. Just noting for consistency awareness -- the project uses TypeScript/ESM internally but the bin entry is CJS, which is the standard pattern for Node.js bin scripts.

**NON-BLOCKING** -- correct as-is.

### S-05: Free-floating helper functions in `config-manager.ts`

**File**: `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/main/config-manager.ts`

CLAUDE.md states: "Disfavor non-private free-floating functions. Favor cohesive classes; for stateless utilities, use a static class."

The `deepMerge`, `mergeColors`, `mergeLevels`, `mergeHexColor`, `mergeUI`, `mergePerformance` functions (lines 122-207) are module-level free-floating functions. They are not exported (good), but per standards they could be static methods on `ConfigManager` or a dedicated `ConfigMerger` utility class.

**NON-BLOCKING** -- since they are module-private (not exported), this is acceptable. They serve a cohesive purpose within the module.

---

## Test Coverage Assessment

### Strengths
- CLI parser: 33 tests covering happy paths, validation errors, duplicates, positional args, missing values, ordering, usage format. Comprehensive.
- Config manager: 24 tests covering file missing, valid, partial, invalid JSON, invalid types, multiple errors, save, directory creation. Comprehensive.
- BDD style consistently applied with GIVEN/WHEN/THEN.
- Edge cases well covered (lanes at end with no values, duplicate flags, nested directory creation).

### Gaps (acceptable for Phase 04)
- **No IPC bridge tests**: Explicitly acknowledged. The bridge is a thin orchestrator. E2E tests in future phases will cover this. Acceptable.
- **No main/index.ts tests**: Composition root. Not typically unit tested. E2E coverage later. Acceptable.
- **No preload tests**: Cannot easily test in Vitest without Electron. Acceptable.

---

## Backward Compatibility

- **Phase 03 tests**: All 75 pre-existing tests pass unchanged (6 stdin-reader + 10 master-list + 11 types + 12 json-parser + 8 log-buffer + 19 timestamp-detector + 8 lane-classifier + 1 sanity).
- **`StdinReader` API change**: Return type changed from `void` to `StdinReaderHandle`. This is backward-compatible -- existing callers that ignored the return value continue to work.
- **`types.ts` additions**: Only additions (new interfaces, new constant). No modifications to existing types.
- **No anchor points removed**.

---

## Documentation Updates Needed

1. **CLAUDE.md**: Update the import rules table to explicitly allow `src/preload/` to import types and constants from `src/core/types.ts`. Current table says "Cannot import from `src/core/`" but this has been explicitly accepted by the plan and plan reviewer.

2. **CLAUDE.md Project Structure**: Add `cli-parser.ts`, `config-manager.ts`, `ipc-bridge.ts` to the `src/main/` section description.
