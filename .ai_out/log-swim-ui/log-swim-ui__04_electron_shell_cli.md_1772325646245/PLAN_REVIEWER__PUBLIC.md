# Plan Review: Phase 04 -- Electron Shell & CLI

## Executive Summary

The plan is well-structured, thorough, and demonstrates strong understanding of Electron IPC patterns, dependency inversion for testability, and separation of concerns. The design decisions are sound and well-justified. There are **two major concerns** (one is a spec divergence on first-line error handling, the other is a missing acceptance criterion for `bin/log-swim-ui.js`), **several minor issues** that can be addressed inline, and a few simplification opportunities. Overall verdict: **APPROVED WITH MINOR REVISIONS** -- plan iteration can be skipped if the inline adjustments below are adopted.

---

## Critical Issues (BLOCKERS)

None.

---

## Major Concerns

### MC-01: First-line error behavior diverges from spec -- "ingestion halts" vs. "continue reading"

- **Description**: The task spec (`04_electron_shell_cli.md`) and high-level spec both state:
  - "First line not valid JSON: send error to renderer" with the high-level spec adding **"and ingestion halts"**
  - "Timestamp parse failure on first line: send error to renderer" with the high-level spec adding **"and ingestion halts"**

  The plan (DD-03) explicitly says: *"These are errors, not fatal -- the bridge should continue reading subsequent lines."* This contradicts the spec.

- **Why it matters**: The spec treats the first line as a handshake -- if the very first line cannot be parsed or its timestamp format cannot be detected, the entire stdin stream is suspect. Continuing to read would mean the `TimestampDetector` never locks a format, so all subsequent lines would have `timestamp: 0`, making the MasterList essentially useless for timestamp-sorted display. The tool becomes a stream of unparseable entries.

- **Recommendation**: Follow the spec. On first-line failures (bad JSON or bad timestamp), send the error to the renderer AND stop reading from stdin. This is not the same as `process.exit(1)` -- the app window stays open showing the error state, but the IPC bridge stops consuming stdin. The bridge should call `rl.close()` (or equivalent cleanup) on the readline interface.

  However, there is a nuance worth noting: if the first line is invalid JSON, the plan could reasonably try the *next* line as the "first" line (skip garbage headers). This is a valid 80/20 consideration but deviates from spec. If the implementor wants this leniency, it should be documented as a conscious spec deviation, not a silent one. I recommend following the spec strictly for now and revisiting if real-world usage demands it.

### MC-02: `bin/log-swim-ui.js` not addressed but acceptance criteria requires CLI launch

- **Description**: The acceptance criterion says: *"`log-swim-ui --key-level level --key-timestamp timestamp` launches with piped stdin"*. The current `bin/log-swim-ui.js` is a stub that prints an error and exits. The plan explicitly says *"The `bin/log-swim-ui.js` entry point does NOT need modification in this phase"* with the rationale that *"it launches Electron via `electron .`"*.

  But the current stub does NOT launch Electron:
  ```javascript
  console.error('log-swim-ui: CLI not yet implemented. See Phase 04.')
  process.exit(1)
  ```

- **Why it matters**: If `bin/log-swim-ui.js` is not updated, the acceptance criterion for CLI launch cannot be met. Users cannot run `log-swim-ui --key-level ...` and have the app actually start.

- **Recommendation**: Add a step (in Phase 4E or 4F) to update `bin/log-swim-ui.js` to spawn Electron with `process.argv` forwarded. Something like:
  ```javascript
  #!/usr/bin/env node
  const { execFileSync } = require('child_process')
  const electronPath = require('electron')
  execFileSync(electronPath, ['.', ...process.argv.slice(2)], {
    stdio: ['pipe', 'inherit', 'inherit'],
    env: { ...process.env }
  })
  ```

  Alternatively, confirm that the acceptance criterion is tested via `npm run dev -- --key-level ...` (which electron-vite handles) and that `bin/log-swim-ui.js` is explicitly deferred to a packaging phase. Either way, the plan should be explicit about this.

---

## Minor Issues (Addressed Inline)

### MI-01: `IPC_CHANNELS` belongs in `src/core/types.ts` but is not a "type" -- placement question

- **Current**: Plan puts `IPC_CHANNELS` in `src/core/types.ts`.
- **Assessment**: Acceptable. The file already exports `STDIN_MESSAGE_TYPES`, `TIMESTAMP_FORMATS`, and `DEFAULT_APP_CONFIG` (runtime values alongside types). `IPC_CHANNELS` fits this pattern. The file name is slightly misleading but renaming it would be scope creep.
- **Verdict**: No change needed.

### MI-02: `ElectronApi` type in `src/core/types.ts` imports concern about Electron API shape leaking into core

- **Current**: Plan says to define `ElectronApi` in `src/core/types.ts`.
- **Assessment**: `ElectronApi` references `IpcLogLine` and `AppConfig`, both of which are already in core types. The interface itself is just a TypeScript type -- it does not import Electron APIs. This is acceptable per the import rules (core can define interfaces that others implement).
- **Verdict**: Acceptable. Add a WHY comment: `// WHY: Defined in core so both preload and renderer can reference the same contract.`

### MI-03: Preload imports `IPC_CHANNELS` from `../core/types` -- verify electron-vite resolves this

- **Current**: Plan correctly notes that preload needs a relative import since no `@core` alias exists for preload in `electron.vite.config.ts`.
- **Assessment**: Verified. The `electron.vite.config.ts` preload section is empty (no aliases). The relative import `../core/types` is correct since preload files live in `src/preload/` and core in `src/core/`. `tsconfig.node.json` includes both directories, so TypeScript compilation will resolve it.
- **Verdict**: Correct. No change needed.

### MI-04: `onStreamEnd` callback signature -- missing `_event` parameter

- **Current**: Plan shows `ipcRenderer.on(IPC_CHANNELS.STREAM_END, () => callback())`.
- **Assessment**: `ipcRenderer.on` always passes an `IpcRendererEvent` as the first argument. The callback must account for it: `(_event) => callback()`. Some channel callbacks in the plan do this correctly (e.g., `onLogLine: (_event, line) => callback(line)`), but `onStreamEnd` omits it.
- **Verdict**: Minor. The implementation will likely get this right since the pattern is shown for other channels. No plan change needed -- implementor will follow the consistent pattern.

### MI-05: `--lanes` with zero values when it's the last arg vs. followed by a flag

- **Current**: Plan says `--lanes` with zero values should throw `CliValidationError`. Test case covers `--lanes --key-level level --key-timestamp ts` but not `--lanes` as the very last argument.
- **Recommendation**: Add a test case for `--key-level level --key-timestamp ts --lanes` (lanes at end with no values after it). Should also throw `CliValidationError`.

### MI-06: `DEFAULT_APP_CONFIG` color values drift noted in Phase 03 callout

- **Current**: The Phase 03 callout says *"Phase 04 (config system) will reconcile defaults with the spec."* The plan does not mention reconciling the `DEFAULT_APP_CONFIG` color values with the spec.
- **Assessment**: The high-level spec defines specific default colors that differ from the current `DEFAULT_APP_CONFIG`. For example, spec says `"info": "#3B82F6"` but current code has `"info": "#198754"`.
- **Recommendation**: Add a note to Phase 4B or 4A to reconcile `DEFAULT_APP_CONFIG` values in `src/core/types.ts` with the canonical defaults from the high-level spec. This is not blocking but should not be forgotten.

### MI-07: Config validation should handle `levels` being a non-Record

- **Current**: Plan validates that each value in `levels` is a valid hex color. But what if `levels` itself is not an object (e.g., `"levels": "red"`)? The deep merge logic should handle this by falling back to defaults.
- **Verdict**: The deep merge algorithm as described ("if the loaded config has the key and it's an object, recurse") implicitly handles this -- if `levels` is not an object, the recursion does not happen and the default is used. No plan change needed, but the implementor should ensure the type guard catches this.

---

## Simplification Opportunities (PARETO)

### SO-01: Three separate `get-*` IPC channels for CLI args could be one

- **Current**: Three IPC channels: `get-lane-patterns`, `get-key-level`, `get-key-timestamp`.
- **Simpler**: One channel `get-cli-args` that returns the entire `CliArgs` object. The renderer makes one IPC call instead of three.
- **Value**: Fewer channels to define, fewer handlers to register, fewer preload methods. Reduces `IPC_CHANNELS` from 9 entries to 7.
- **Impact**: Low risk. `CliArgs` is a simple serializable object.
- **Recommendation**: Consider collapsing to a single `get-cli-args` channel. This is a suggestion, not a blocker. If the implementor prefers granular channels for potential future use, the current approach is fine.

### SO-02: `IpcSender` abstraction -- overkill if no tests use it this phase

- **Current**: Plan defines `IpcSender` interface for dependency injection, then explicitly says "No dedicated unit tests for IpcBridge in Phase 04."
- **Assessment**: The abstraction is lightweight (one method interface) and follows good DI principles. It costs almost nothing to have and enables future testing. This is exactly the right level of investment.
- **Verdict**: Keep as-is. Good design.

---

## Specific Technical Feedback

### TF-01: `timestamp: number` in `IpcLogLine` -- alignment with `LogEntry` which uses `Date`

- **Current**: `IpcLogLine.timestamp` is `number` (epoch millis), `LogEntry.timestamp` is `Date`. The plan notes the renderer will convert.
- **Assessment**: Sound decision. Epoch millis is the right choice for IPC data transfer objects. The renderer's responsibility to construct `LogEntry` from `IpcLogLine` is appropriate (Phase 05).
- **Verdict**: Good. Well-justified in the plan.

### TF-02: `ConfigLoadResult` returning `config: AppConfig` even on failure is good

- The app can always run with defaults even if config is broken. This matches the spec requirement for graceful degradation.
- **Verdict**: Good pattern.

### TF-03: `TimestampDetector` is created inside `IpcBridge` vs. injected

- **Current**: Plan says `private readonly timestampDetector: TimestampDetector` is "created internally."
- **Assessment**: Since `TimestampDetector` has no external dependencies (it's a pure stateful object), creating it internally is fine. If we wanted to test the bridge in isolation, we'd want to inject it, but the plan explicitly says no bridge tests this phase. And the detector is already well-tested on its own.
- **Verdict**: Acceptable for now. If bridge tests are added later, this can be refactored to inject.

### TF-04: `did-finish-load` timing for IPC bridge start

- **Current**: Plan correctly identifies that `webContents.send` will silently drop messages before the window finishes loading.
- **Assessment**: This is a critical Electron detail and the plan handles it correctly.
- **Verdict**: Good catch. Important for the implementor to follow through.

### TF-05: `@main` alias in vitest.config.ts

- **Current**: Plan recommends adding `@main` alias to vitest.config.ts.
- **Assessment**: Consistent with the existing `@core` alias pattern. However, it should also be added to `tsconfig.node.json` paths for IDE support, or tests should use relative imports. The plan says "requires NO changes to tsconfig.node.json" -- this is true for compilation (tsconfig.node.json includes `src/main/`) but IDE navigation via `@main/` paths will not work without a `paths` entry.
- **Recommendation**: Either (a) add `@main` alias to both `vitest.config.ts` and `tsconfig.node.json` compilerOptions.paths, or (b) use relative imports in tests and skip the alias. Relative imports are simpler and avoid the tsconfig complication. I lean toward (b) for simplicity since there are only 2 test files.

---

## Testing Assessment

### Strengths
- CLI parser tests are comprehensive: happy paths, validation failures, edge cases, ordering.
- Config manager tests cover all file states: missing, valid, partial, invalid JSON, invalid types.
- BDD style with GIVEN/WHEN/THEN is consistent with existing test patterns.

### Gaps
- **Missing test**: `--key-level level --key-timestamp ts --lanes` (lanes as last arg with no values).
- **Missing test**: Config manager `save()` when directory does not exist (should create recursively). Actually, `load()` creates the directory, so `save()` should be called after `load()`. But what if `save()` is called standalone? Document the precondition or make `save()` also create the directory.
- **IPC bridge has no tests**: Explicitly acknowledged in the plan. The plan's reasoning (thin orchestrator over tested components) is acceptable for Phase 04 but should have a follow-up ticket for integration tests.

---

## Alignment with Existing Code

- **Static class pattern**: `CliParser` as a static class matches `JsonParser`, `LaneClassifier`, `StdinReader`. Good consistency.
- **ConfigManager as instance class**: Matches `TimestampDetector`, `MasterList`, `LogBuffer` (stateful classes). Good consistency.
- **Type conventions**: `readonly` fields, `as const` objects, discriminated unions -- all match Phase 03 patterns.
- **Error handling**: `CliValidationError extends Error` for CLI, `ConfigLoadResult` discriminated union for config. Both are appropriate for their contexts (CLI errors are crash-worthy, config errors are recoverable).

---

## Strengths

1. **DD-01 (send parsed data, not raw strings)** is well-reasoned. It avoids duplicating parsing work between main and renderer processes.
2. **DD-02 (injectable config path)** is textbook dependency inversion. Clean and testable.
3. **DD-03 (handling invalid JSON)** addresses a real-world scenario (non-JSON lines in logs) sensibly -- except for the first-line behavior divergence from spec (see MC-01).
4. **IPC channel centralization** via `IPC_CHANNELS` constant prevents string literal typos across main/preload/renderer boundaries.
5. **Security model** is correct: `contextBridge` with whitelisted channels, no raw `ipcRenderer` exposure.
6. **Phase ordering** is logical with correct dependency identification.
7. **`ConfigLoadResult` as discriminated union** is clean and prevents the app from crashing on config issues.
8. **Comprehensive test case enumeration** gives the implementor clear targets.

---

## Inline Adjustments Made

I am making the following MINOR adjustments directly in this review (not modifying the plan file, but calling out what the implementor should adjust):

1. **MC-01**: First-line error handling -- follow the spec (halt ingestion). The IPC bridge should close the readline interface on first-line JSON parse failure or timestamp detection failure. Update the `onLine` callback description in Phase 4C accordingly.

2. **MI-05**: Add test case for `--lanes` at end of argv with no values.

3. **MI-06**: Add a note to reconcile `DEFAULT_APP_CONFIG` with spec defaults.

4. **TF-05**: Recommend using relative imports in test files instead of adding `@main` alias, to keep it simple.

---

## Verdict

- [ ] APPROVED
- [x] APPROVED WITH MINOR REVISIONS
- [ ] NEEDS REVISION
- [ ] REJECTED

**Rationale**: The plan is solid. The two major concerns are:
1. **MC-01** (first-line error behavior) is a spec divergence that should be corrected but does not require architectural changes -- just a behavioral tweak in the `onLine` callback.
2. **MC-02** (`bin/log-swim-ui.js` not updated) needs to be addressed or explicitly deferred with rationale.

Neither requires plan iteration. The implementor can incorporate these adjustments during implementation.

**PLAN_ITERATION can be SKIPPED** -- the implementor should adopt the adjustments from MC-01, MC-02, MI-05, MI-06, and TF-05 during implementation.
