# Plan Reviewer Private Context

## Review Session Summary

**Ticket**: wmtjnten6eiw5repedjlu2tig__change-input-key-names
**Reviewer**: GLM-5
**Date**: 2026-03-06

## Key Observations

### 1. Naming Convention Analysis

The proposed naming is problematic:
- `--input_key.level` uses underscore + dot (mixed convention)
- `--input_key.timestamp` uses underscore + dot
- `--regexes_for_filter_columns` uses underscores only

This is inconsistent. Common CLI conventions:
- **Dashes**: `--level-field`, `--filter-lanes` (most common in Unix/GNU tools)
- **Dots**: `--input.level`, `--input.timestamp` (seen in some modern CLIs like Docker)
- **CamelCase**: `--levelField` (rare, seen in some Node.js CLIs)

The current implementation uses dashes: `--key-level`, `--key-timestamp`, `--lanes`. Staying with dashes would be most consistent.

### 2. Files Verified

| File | Exists | Needs Changes | Notes |
|------|--------|---------------|-------|
| `src/core/types.ts` | Yes | Yes | Line 190-194: `CliArgsResult` interface |
| `src/main/cli-parser.ts` | Yes | Yes | Line 14: `KNOWN_FLAGS`, lines 47-121: parse logic |
| `src/main/index.ts` | Yes | Yes | Line 30: `APP_FLAGS`, lines 89-93: IPC handler, lines 144-148: bridge construction |
| `src/main/ipc-bridge.ts` | Yes | Yes | Lines 30-34: `IpcBridgeDeps`, lines 110, 136: property accesses |
| `src/renderer/src/useAppInit.ts` | Yes | Yes | Line 49: `cliArgs.lanePatterns` |
| `src/preload/index.ts` | Yes | No | Only uses constants from types, not property names |
| `src/preload/electron-api.d.ts` | Need to verify | Possibly | May declare `getCliArgs()` return type |
| `tests/unit/main/cli-parser.test.ts` | Yes | Yes | All test data and assertions |
| `tests/unit/main/ipc-bridge.test.ts` | Yes | Yes | `processLines()` helper params |
| `tests/e2e/app.spec.ts` | Yes | Yes | Lines 13-17: `DEFAULT_CLI_ARGS`, lines 460-464: `SINGLE_LANE_CLI_ARGS` |
| `tests/e2e/helpers/electron-app.ts` | Yes | No | Only has local `IpcLogLine` copy, no CLI arg references |
| `README.md` | Yes | Yes | Lines 42-43: usage examples |
| `test_manual.sh` | Yes | Yes | Line 8: CLI invocation |

### 3. E2E Test Structure

The E2E tests use **array-based** CLI args, NOT object-based:
```typescript
const DEFAULT_CLI_ARGS = [
  '--key-level', 'level',
  '--key-timestamp', 'timestamp',
  '--lanes', 'error', 'auth'
]
```

These are passed directly to `launchApp()` which passes them to Electron's spawn args. The plan incorrectly describes them as objects.

### 4. Preload File Analysis

`src/preload/index.ts` imports:
- `IPC_CHANNELS` (constant) from `../core/types`
- `ElectronApi`, `IpcLogLine` (types) from `../core/types`

It does NOT import or use `CliArgsResult` or its property names directly. The `getCliArgs()` method just calls `ipcRenderer.invoke()` - the return type comes from the main process handler.

**VERIFIED**: `src/preload/electron-api.d.ts` exists and only imports `ElectronApi` from `../core/types`:
```typescript
import type { ElectronApi } from '../core/types'

declare global {
  interface Window {
    api: ElectronApi
  }
}
```

This file does NOT need modification - changes to `CliArgsResult` propagate automatically through the type system.

### 5. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Missed property reference | Medium | High | TypeScript compiler catches |
| Incomplete test update | Medium | Medium | Test failures expose |
| Documentation drift | High | Low | grep verification |
| User confusion from naming | High | Medium | Consistent naming scheme |
| Intermediate broken build | Certain | Low | Batch changes or accept temporary break |

## Recommendations for Engineer

1. **Strong recommendation**: Use dash-based naming consistently:
   - `--level-field` / `--timestamp-field` / `--filter-lanes`
   - Or keep current names and only change what's strictly necessary

2. **Verify `src/preload/electron-api.d.ts`** before starting - if it exists, add to Phase 1 or 2.

3. **Consider PARETO**: Only change CLI flags, keep internal names. This cuts scope significantly.

4. **Batch the type + usage changes** into one commit to avoid broken intermediate states.

## Files to Verify

- [x] `src/preload/electron-api.d.ts` - **VERIFIED**: exists, only imports `ElectronApi`, no changes needed

## Questions for Engineer

1. Is the naming convention (`input_key.level`, `regexes_for_filter_columns`) a hard requirement from a stakeholder, or can we suggest alternatives?

2. Is backwards compatibility with deprecation warnings desired, or is a hard break acceptable?

3. Should internal property names also change, or can we keep them as-is (simpler)?
