# CLI Argument Parsing Exploration - Change Input Key Names

## Overview

This document explores the current CLI argument parsing implementation for `log-swim-ui` to understand how to change the input key names from:
- `--key-level` → `--input_key.level`
- `--key-timestamp` → `--input_key.timestamp`
- `--lanes` → `--regexes_for_filter_columns` (proposed)

## Current CLI Argument Parsing Flow

### 1. Entry Point
**File**: `bin/log-swim-ui.js`
- Simple Node.js entry point that spawns Electron
- Forwards `process.argv.slice(2)` to Electron child process
- Pipes parent's stdin to child's stdin

### 2. Main Process Entry
**File**: `src/main/index.ts`

**Flow**:
1. **TTY Check** (lines 15-20): Validates stdin is piped (not interactive)
2. **E2E Test Mode Detection** (line 13): Checks `E2E_TEST=1` env var
3. **App Argument Extraction** (lines 29-36):
   - Defines `APP_FLAGS = ['--key-level', '--key-timestamp', '--lanes']`
   - `extractAppArgs()` finds the first app flag and slices from there
   - **Critical for E2E**: Filters out Chromium flags and app path
4. **CLI Argument Parsing** (lines 38-49):
   - Calls `CliParser.parse(appArgs)` 
   - Catches `CliValidationError` and displays usage message
   - Stores result in `cliArgs` variable

5. **IPC Handler Registration** (lines 89-93):
   - Registers `GET_CLI_ARGS` handler to expose parsed args to renderer
   - Returns `{ keyLevel, keyTimestamp, lanePatterns }`

6. **Bridge Creation** (lines 144-149):
   - Creates `IpcBridge` with `keyLevel` and `keyTimestamp` from parsed args
   - Bridge uses these keys to extract values from JSON fields

### 3. CLI Parser
**File**: `src/main/cli-parser.ts`

**Class**: `CliParser` (static class)

**Method**: `parse(argv: readonly string[]): CliArgsResult`

**Flags Supported**:
- `--key-level` (required, consumes 1 value)
- `--key-timestamp` (required, consumes 1 value)  
- `--lanes` (optional, consumes 1+ values until next `--` flag)

**Validation**:
- Checks for duplicate flags
- Checks for unknown flags
- Validates required flags are present
- Validates `--lanes` has at least one value
- Rejects positional arguments (non-flag values)

**Error Handling**:
- Throws `CliValidationError` for all validation failures
- Has `formatUsage()` method for help messages

### 4. Type Definitions
**File**: `src/core/types.ts`

**Interface**: `CliArgsResult` (lines 190-194)

```typescript
interface CliArgsResult {
  readonly keyLevel: string
  readonly keyTimestamp: string
  readonly lanePatterns: readonly string[]
}
```

**Export**: Line 311

### 5. IPC Bridge
**File**: `src/main/ipc-bridge.ts`

**Constructor** (lines 30-34):
```typescript
interface IpcBridgeDeps {
  readonly keyLevel: string
  readonly keyTimestamp: string
  readonly sender: IpcSender
}
```

**Usage**:
- Line 110: Extracts timestamp from JSON using `deps.keyTimestamp`
- Line 136: Extracts level from JSON using `deps.keyLevel`

### 6. Renderer Process
**File**: `src/renderer/src/useAppInit.ts`

**Usage** (line 49):
```typescript
const lanes = cliArgs.lanePatterns.map((pattern) => createLaneDefinition(pattern))
```

Uses parsed lane patterns to create lane definitions.

## Files That Need to Be Modified

### Core Files (HIGH PRIORITY)
1. **`src/main/cli-parser.ts`**
   - Update `KNOWN_FLAGS` array (line 14)
   - Update `parse()` method variable names and logic
   - Update `formatUsage()` usage message
   - Update error messages that reference old flag names

2. **`src/core/types.ts`**
   - Update `CliArgsResult` interface property names
   - Update `IpcLogLine` interface comments
   - Export any new type definitions if needed

3. **`src/main/index.ts`**
   - Update `APP_FLAGS` constant (line 30)
   - Update `extractAppArgs()` if needed (may need new flag names)
   - Update `GET_CLI_ARGS` handler (lines 90-92)
   - Update `IpcBridge` construction (lines 145-146)
   - Update `CliParser.formatUsage()` call (line 18)

4. **`src/main/ipc-bridge.ts`**
   - Update `IpcBridgeDeps` interface property names
   - Update all usages of `deps.keyLevel` and `deps.keyTimestamp`

### Test Files (HIGH PRIORITY)
5. **`tests/unit/main/cli-parser.test.ts`**
   - Update all test data to use new flag names
   - Update assertions for property names
   - Update usage message assertions

6. **`tests/unit/main/ipc-bridge.test.ts`**
   - Update test parameters and assertions for new property names
   - Update mock data creation

7. **`tests/e2e/app.spec.ts`**
   - Update `DEFAULT_CLI_ARGS` constant (lines 13-17)
   - Update `SINGLE_LANE_CLI_ARGS` constant (lines 460-467)
   - Update all test descriptions and test assertions

8. **`tests/e2e/helpers/electron-app.ts`**
   - Update any local type definitions if needed
   - Update any comments referencing old flag names

### Documentation and Config Files (MEDIUM PRIORITY)
9. **`bin/log-swim-ui.js`**
   - May need update if it references flags (currently does not parse them)

10. **`test_manual.sh`**
    - Update test script to use new flag names (line 8)

11. **`README.md`**
    - Update usage examples (lines 42-43)

12. **`doc/starting_spec/start_spec.md`**
    - Update CLI interface documentation
    - Update all usage examples
    - Update argument descriptions

13. **`doc/ralph/log-swim-ui/log-swim-ui-high-level.md`**
    - Update CLI arguments documentation
    - Update examples

## Test Files Analysis

### Unit Tests: `tests/unit/main/cli-parser.test.ts`
- **Total test cases**: 26
- **Coverage**:
  - Happy path with all args: 5 tests
  - Reverse order: 1 test
  - Multiple `--lanes` values: 3 tests
  - Error states (missing flags, missing values): 8 tests
  - Duplicate flags: 3 tests
  - Unknown flags: 2 tests
  - Empty argv: 1 test
  - Positional args: 2 tests
  - Usage message: 5 tests

**Modified for**:
- Flag names in test data
- Property names in assertions

### Unit Tests: `tests/unit/main/ipc-bridge.test.ts`
- Tests for IpcBridge functionality
- Uses `keyLevel` and `keyTimestamp` parameters
- Updated for new property names

### E2E Tests: `tests/e2e/app.spec.ts`
- 21+ E2E test cases
- **Constants**:
  - `DEFAULT_CLI_ARGS` (lines 13-17)
  - `SINGLE_LANE_CLI_ARGS` (lines 460-467)
- All tests use these constants
- Modified for:
  - New flag names in constants
  - Updated test descriptions

### E2E Test Helpers: `tests/e2e/helpers/electron-app.ts`
- No direct flag usage, but has local type definitions
- May need to update comments

## Potential Issues and Considerations

### 1. Breaking Change
This is a **breaking change** to the CLI interface. Users who have scripts or automation using the old flags will need to update.

### 2. Propagation Chain
The flag values propagate through:
```
CLI Args → CliParser → CliArgsResult → IPC GET_CLI_ARGS Handler 
→ IpcBridge → JSON Field Extraction → IpcLogLine → Renderer
```

All 6 layers need updates.

### 3. IPC Bridge State
The `IpcBridge` class stores the keys in its constructor. If the interface changes, existing instances would break. However, this is fine since the bridge is created fresh on app launch.

### 4. Error Messages
All error messages in `CliParser` and usage text need updates:
- `CliValidationError` messages
- `formatUsage()` output
- Error messages in `index.ts` when catching CliValidationError

### 5. E2E Test Chromium Flags
In `src/main/index.ts`, the `extractAppArgs()` function filters Chromium flags by looking for app flags. Need to ensure new flag names are added to the `APP_FLAGS` array.

### 6. Documentation vs. Implementation
The spec files (e.g., `start_spec.md`) show `--lanes` with optional `::` separator for lane naming. However, the current implementation treats `--lanes` values as raw regex patterns only. This is an implementation detail that doesn't affect the change.

### 7. Backwards Compatibility
Consider if backwards compatibility is needed:
- Add `--key-level` and `--key-level` as deprecated aliases?
- Parse both old and new flags and issue warning?
- Or just break and expect users to update?

Based on the ticket description, it seems like a clean break is acceptable.

### 8. Naming Consistency
- Proposed: `--input_key.level` and `--input_key.timestamp`
  - Uses underscore prefix to indicate CLI flag
  - Uses dot to indicate nested field structure
- This is consistent with common CLI patterns like `--input.email` vs `--email`

## Recommended Change Strategy

### Step 1: Update Type Definitions
1. Update `CliArgsResult` in `src/core/types.ts`
2. Update `IpcLogLine` comments
3. Export any new types if needed

### Step 2: Update CLI Parser
1. Update `KNOWN_FLAGS` in `cli-parser.ts`
2. Update `parse()` method variable names and logic
3. Update `formatUsage()` and error messages
4. Add new flags to `APP_FLAGS` in `index.ts`

### Step 3: Update Main Process
1. Update `APP_FLAGS` in `extractAppArgs()`
2. Update `GET_CLI_ARGS` handler
3. Update `IpcBridge` construction
4. Update `CliParser.formatUsage()` call

### Step 4: Update IPC Bridge
1. Update `IpcBridgeDeps` interface
2. Update all property accesses

### Step 5: Update Tests (Unit)
1. `tests/unit/main/cli-parser.test.ts` - All 26 tests
2. `tests/unit/main/ipc-bridge.test.ts` - All tests

### Step 6: Update Tests (E2E)
1. `tests/e2e/app.spec.ts` - All 21+ tests
2. `tests/e2e/helpers/electron-app.ts` - Comments/types

### Step 7: Update Documentation
1. `README.md` - Usage examples
2. `test_manual.sh` - Test script
3. `doc/starting_spec/start_spec.md` - Spec
4. `doc/ralph/log-swim-ui/log-swim-ui-high-level.md` - Documentation

### Step 8: Run Tests
1. `npm test` - Verify unit tests pass
2. `npm run test:e2e` - Verify E2E tests pass
3. `npm run typecheck` - Verify TypeScript compilation

## Summary

**Files Modified**: 13
- Core logic: 4 files
- Tests: 4 files  
- Documentation: 3 files
- Entry point: 1 file

**Test Coverage**: 
- Unit tests: ~30 test cases across 2 files
- E2E tests: 21+ test cases
- Total: ~50 test cases to verify

**Impact**: HIGH - Breaking CLI interface change
**Complexity**: MEDIUM - Straightforward property name changes with some test updates

The change is straightforward but requires thorough testing due to the extensive test coverage of the CLI parser.
