# Implementation Plan: Change CLI Input Key Names

## Overview

**Task**: Rename CLI flags and internal property names to better reflect their semantics.

**Breaking Change**: Yes - no backwards compatibility maintained.

**Scope**: 13 files across core logic, tests, and documentation.

**Note on Naming Convention**: The new CLI flag names (`--input_key.level`, `--input_key.timestamp`, `--regexes_for_filter_columns`) were specified by the user in the original ticket request. These names are kept as-is per user requirements.

## Changes Summary

### CLI Flag Renames
| Old Flag | New Flag |
|----------|----------|
| `--key-level` | `--input_key.level` |
| `--key-timestamp` | `--input_key.timestamp` |
| `--lanes` | `--regexes_for_filter_columns` |

### Internal Property Renames
| Old Property | New Property |
|--------------|--------------|
| `keyLevel` | `inputKeyLevel` |
| `keyTimestamp` | `inputKeyTimestamp` |
| `lanePatterns` | `filterColumnPatterns` |

---

## Implementation Phases

### Phase 1: Core Type Definitions
**Goal**: Update the foundational type definitions that all other code depends on.

**File**: `src/core/types.ts`

**Changes**:
```typescript
// OLD:
interface CliArgsResult {
  readonly keyLevel: string
  readonly keyTimestamp: string
  readonly lanePatterns: readonly string[]
}

// NEW:
interface CliArgsResult {
  readonly inputKeyLevel: string
  readonly inputKeyTimestamp: string
  readonly filterColumnPatterns: readonly string[]
}
```

**Verification**: TypeScript compilation succeeds with `npm run typecheck`.

---

### Phase 2: CLI Parser Implementation
**Goal**: Update the CLI parser to recognize new flags and populate new property names.

**File**: `src/main/cli-parser.ts`

**Changes**:

1. **Update KNOWN_FLAGS constant** (line 14):
```typescript
// OLD:
const KNOWN_FLAGS = ['--key-level', '--key-timestamp', '--lanes'] as const

// NEW:
const KNOWN_FLAGS = ['--input_key.level', '--input_key.timestamp', '--regexes_for_filter_columns'] as const
```

2. **Update parse() method** - rename all local variables and result properties:
   - `keyLevel` → `inputKeyLevel`
   - `keyTimestamp` → `inputKeyTimestamp`
   - `lanePatterns` → `filterColumnPatterns`

3. **Update formatUsage() method** - replace all flag names in usage message:
```typescript
// OLD:
Usage: log-swim-ui --key-level <field> --key-timestamp <field> [--lanes <regex>...]

// NEW:
Usage: log-swim-ui --input_key.level <field> --input_key.timestamp <field> [--regexes_for_filter_columns <regex>...]
```

4. **Update all error messages** that reference old flag names.

**Verification**: Unit tests will initially fail (expected). They will be updated in Phase 5.

---

### Phase 3: Main Process Integration
**Goal**: Update main process to use new flag names and property names.

**File**: `src/main/index.ts`

**Changes**:

1. **Update APP_FLAGS array** (line 30):
```typescript
// OLD:
const APP_FLAGS = ['--key-level', '--key-timestamp', '--lanes']

// NEW:
const APP_FLAGS = ['--input_key.level', '--input_key.timestamp', '--regexes_for_filter_columns']
```

2. **Update comment** (line 26) to reference new flag names.

3. **Update GET_CLI_ARGS IPC handler** (lines 90-92):
```typescript
// OLD:
return {
  keyLevel: cliArgs.keyLevel,
  keyTimestamp: cliArgs.keyTimestamp,
  lanePatterns: cliArgs.lanePatterns
}

// NEW:
return {
  inputKeyLevel: cliArgs.inputKeyLevel,
  inputKeyTimestamp: cliArgs.inputKeyTimestamp,
  filterColumnPatterns: cliArgs.filterColumnPatterns
}
```

4. **Update IpcBridge construction** (lines 145-146):
```typescript
// OLD:
new IpcBridge({
  keyLevel: cliArgs.keyLevel,
  keyTimestamp: cliArgs.keyTimestamp,
  sender: mainWindow.webContents
})

// NEW:
new IpcBridge({
  inputKeyLevel: cliArgs.inputKeyLevel,
  inputKeyTimestamp: cliArgs.inputKeyTimestamp,
  sender: mainWindow.webContents
})
```

**Verification**: TypeScript compilation succeeds.

---

### Phase 4: IPC Bridge Update
**Goal**: Update IPC bridge to use new property names.

**File**: `src/main/ipc-bridge.ts`

**Changes**:

1. **Update IpcBridgeDeps interface** (lines 30-34):
```typescript
// OLD:
interface IpcBridgeDeps {
  readonly keyLevel: string
  readonly keyTimestamp: string
  readonly sender: IpcSender
}

// NEW:
interface IpcBridgeDeps {
  readonly inputKeyLevel: string
  readonly inputKeyTimestamp: string
  readonly sender: IpcSender
}
```

2. **Update all property accesses** throughout the file:
   - Line 110: `deps.keyTimestamp` → `deps.inputKeyTimestamp`
   - Line 136: `deps.keyLevel` → `deps.inputKeyLevel`

**Verification**: TypeScript compilation succeeds.

---

### Phase 5: Unit Tests Update
**Goal**: Update all unit tests to use new flag names and property names.

**File**: `tests/unit/main/cli-parser.test.ts`

**Changes**:

1. **Update all test data** to use new flag names:
   - `--key-level` → `--input_key.level`
   - `--key-timestamp` → `--input_key.timestamp`
   - `--lanes` → `--regexes_for_filter_columns`

2. **Update all property assertions**:
   - `result.keyLevel` → `result.inputKeyLevel`
   - `result.keyTimestamp` → `result.inputKeyTimestamp`
   - `result.lanePatterns` → `result.filterColumnPatterns`

3. **Update usage message assertions** to match new format.

**Estimated Changes**: ~50+ occurrences across 26 test cases.

**File**: `tests/unit/main/ipc-bridge.test.ts`

**Changes**:

1. **Update test parameters** for IpcBridge construction:
```typescript
// OLD:
new IpcBridge({
  keyLevel: 'level',
  keyTimestamp: 'timestamp',
  sender: mockSender
})

// NEW:
new IpcBridge({
  inputKeyLevel: 'level',
  inputKeyTimestamp: 'timestamp',
  sender: mockSender
})
```

**Verification**: Run `npm test` - all unit tests must pass.

---

### Phase 6: E2E Tests Update
**Goal**: Update all E2E tests to use new CLI argument structure.

**File**: `tests/e2e/app.spec.ts`

**Changes**:

1. **Update DEFAULT_CLI_ARGS constant** (lines 13-17):

**IMPORTANT**: E2E tests pass CLI args as an array of strings directly to Electron's command line, NOT as a parsed object. The structure is:
```typescript
// OLD:
const DEFAULT_CLI_ARGS = [
  '--key-level', 'level',
  '--key-timestamp', 'timestamp',
  '--lanes', 'error', 'auth'
]

// NEW:
const DEFAULT_CLI_ARGS = [
  '--input_key.level', 'level',
  '--input_key.timestamp', 'timestamp',
  '--regexes_for_filter_columns', 'error', 'auth'
]
```

2. **Update SINGLE_LANE_CLI_ARGS constant** (lines 460-464):
```typescript
// OLD:
const SINGLE_LANE_CLI_ARGS = [
  '--key-level', 'level',
  '--key-timestamp', 'timestamp',
  '--lanes', 'error'
]

// NEW:
const SINGLE_LANE_CLI_ARGS = [
  '--input_key.level', 'level',
  '--input_key.timestamp', 'timestamp',
  '--regexes_for_filter_columns', 'error'
]
```

3. **Update test descriptions** that reference old flag names:
   - Line 29: `'GIVEN the Electron app launched with --lanes "error" "auth"'` → update flag name in description
   - Line 456: `'GIVEN the Electron app launched with --lanes "error" (single lane)'` → update flag name in description

**File**: `tests/e2e/helpers/electron-app.ts`

**Changes**:
- Update any local type definitions or comments referencing old flag names.
- No property name changes needed (E2E tests use CLI flag strings, not internal property names).

**Verification**: Run `npm run test:e2e` - all E2E tests must pass.

---

### Phase 7: Renderer Process Update
**Goal**: Update renderer to use new property names.

**File**: `src/renderer/src/useAppInit.ts`

**Changes**:

Line 49:
```typescript
// OLD:
const lanes = cliArgs.lanePatterns.map((pattern) => createLaneDefinition(pattern))

// NEW:
const lanes = cliArgs.filterColumnPatterns.map((pattern) => createLaneDefinition(pattern))
```

**Verification**: TypeScript compilation succeeds.

---

### Phase 8: Documentation Updates
**Goal**: Update all documentation to reflect new CLI interface.

**Files to Update**:

1. **`README.md`** (lines 42-43):
```bash
# OLD:
cat logs.json | log-swim-ui --key-level level --key-timestamp timestamp
cat logs.json | log-swim-ui --key-level level --key-timestamp timestamp --lanes "error|ERROR|fatal" "auth"

# NEW:
cat logs.json | log-swim-ui --input_key.level level --input_key.timestamp timestamp
cat logs.json | log-swim-ui --input_key.level level --input_key.timestamp timestamp --regexes_for_filter_columns "error|ERROR|fatal" "auth"
```

2. **`test_manual.sh`** (line 8):
```bash
# OLD:
cat ./test_data/sample-logs/sample-logs-10-lines.jsonl | log-swim-ui --key-level "level" --key-timestamp "timestamp"

# NEW:
cat ./test_data/sample-logs/sample-logs-10-lines.jsonl | log-swim-ui --input_key.level "level" --input_key.timestamp "timestamp"
```

3. **`doc/starting_spec/start_spec.md`**:
   - Update all CLI usage examples
   - Update argument descriptions
   - Update command-line interface documentation

4. **`doc/ralph/log-swim-ui/log-swim-ui-high-level.md`**:
   - Update CLI arguments section
   - Update all examples

**Verification**: Manual review for accuracy and consistency.

---

## Testing Strategy

### Unit Tests
- **Coverage**: 26 test cases in `cli-parser.test.ts`, multiple test cases in `ipc-bridge.test.ts`
- **Execution**: `npm test`
- **Focus Areas**:
  - Flag parsing with new names
  - Property name extraction
  - Error messages with new flag names
  - Usage message format

### E2E Tests
- **Coverage**: 21+ test cases in `app.spec.ts`
- **Execution**: `npm run test:e2e`
- **Prerequisite**: `npm run build` must succeed
- **Focus Areas**:
  - Full app lifecycle with new CLI args
  - IPC communication with new property names
  - Lane/filter functionality unchanged

### Type Checking
- **Execution**: `npm run typecheck`
- **Verification**: No TypeScript errors across all 3 tsconfig files

### Manual Testing
- **Execution**: `./test_manual.sh`
- **Verification**: App launches and displays logs correctly

---

## Acceptance Criteria

1. **Type Safety**
   - [ ] `npm run typecheck` passes with zero errors
   - [ ] No `any` types introduced
   - [ ] All property accesses use new names

2. **Unit Tests**
   - [ ] All 26 CLI parser tests pass
   - [ ] All IPC bridge tests pass
   - [ ] `npm test` exits with code 0

3. **E2E Tests**
   - [ ] All 21+ E2E tests pass
   - [ ] `npm run test:e2e` exits with code 0
   - [ ] No test skipped or commented out

4. **Functionality**
   - [ ] App launches successfully with new flags
   - [ ] JSON field extraction works correctly
   - [ ] Lane classification works correctly
   - [ ] No runtime errors in console

5. **Documentation**
   - [ ] README.md updated with correct examples
   - [ ] test_manual.sh uses new flags
   - [ ] All spec documents updated
   - [ ] No references to old flag names remain

6. **Code Quality**
   - [ ] No dead code introduced
   - [ ] No commented-out code
   - [ ] Consistent naming throughout
   - [ ] Comments updated where necessary

---

## Risk Mitigation

### Risk: Missed Property Reference
**Mitigation**: Use TypeScript compiler to catch all references. Run typecheck after each phase.

### Risk: Incomplete Test Updates
**Mitigation**: Run full test suite after all changes. Any failing test indicates a missed update.

### Risk: Documentation Inconsistency
**Mitigation**: Use grep to search for old flag names across entire codebase before completion.

### Risk: E2E Test Environment Issues
**Mitigation**: E2E tests run in headless mode with offscreen rendering. Ensure `npx playwright install` has been run.

---

## Rollback Plan

Since this is a breaking change with no backwards compatibility:

1. **If issues discovered during implementation**:
   - Stop at current phase
   - Revert all changes: `git reset --hard HEAD`
   - Reassess approach

2. **If issues discovered after merge**:
   - Create revert commit
   - Or create follow-up fix commit (if minor)

---

## Implementation Order

The implementation order is critical to avoid breaking the build:

1. **Phase 1** (types.ts) - Foundation for all other changes
2. **Phase 2** (cli-parser.ts) - Parser must recognize new flags
3. **Phase 3** (index.ts) - Main process uses new names
4. **Phase 4** (ipc-bridge.ts) - Bridge uses new names
5. **Phase 5** (unit tests) - Tests verify new behavior
6. **Phase 6** (E2E tests) - Integration tests
7. **Phase 7** (renderer) - UI uses new names
8. **Phase 8** (docs) - Documentation matches code

**Note**: Do not skip phases or change order. Each phase builds on the previous.

---

## Post-Implementation Verification

After all phases complete:

```bash
# 1. Type check
npm run typecheck

# 2. Unit tests
npm test

# 3. Build
npm run build

# 4. E2E tests
npm run test:e2e

# 5. Manual test
./test_manual.sh

# 6. Search for old flag names (should return nothing)
grep -r "\-\-key-level" --include="*.ts" --include="*.md" --include="*.sh" .
grep -r "\-\-key-timestamp" --include="*.ts" --include="*.md" --include="*.sh" .
grep -r "\-\-lanes" --include="*.ts" --include="*.md" --include="*.sh" .
grep -r "keyLevel" --include="*.ts" .
grep -r "keyTimestamp" --include="*.ts" .
grep -r "lanePatterns" --include="*.ts" .
```

All commands should succeed with zero errors and no old references found.
