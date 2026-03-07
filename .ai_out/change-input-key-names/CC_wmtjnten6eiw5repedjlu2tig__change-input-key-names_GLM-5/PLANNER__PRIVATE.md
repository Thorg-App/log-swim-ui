# Private Context: CLI Input Key Names Change

## Task Context

**Ticket ID**: `wmtjnten6eiw5repedjlu2tig`
**Task**: Change CLI input key names
**Agent**: GLM-5
**Mode**: PLANNER

## Key Insights

### Why These Specific Names?

**IMPORTANT**: The naming convention was specified by the user in the original ticket. These are the user-requested names:
- `--input_key.level`
- `--input_key.timestamp`
- `--regexes_for_filter_columns`

The new flag names follow a pattern:
- `--input_key.*` - Clearly indicates these are keys for extracting data from input JSON
- `--regexes_for_filter_columns` - More descriptive than `--lanes`, indicates these are regex patterns used for filter columns

This is a semantic improvement that makes the CLI self-documenting.

**Note**: While the reviewer suggested using dashes consistently (e.g., `--input-key-level`), the user explicitly requested these specific names, so we keep them as-is.

### Critical Implementation Details

1. **Flag Parsing Logic**: The CLI parser uses a simple flag-value consumption model. The `.` in `--input_key.level` is part of the flag name itself, NOT a nested structure. This is a string literal match.

2. **Propagation Chain**: The change ripples through 6 distinct layers:
   ```
   CLI Args → CliParser → CliArgsResult → IPC Handler → IpcBridge → Renderer
   ```
   Each layer must be updated in order.

3. **APP_FLAGS Array Criticality**: The `extractAppArgs()` function in `index.ts` uses `APP_FLAGS` to filter out Chromium flags during E2E tests. If this array is not updated, E2E tests will fail because the parser won't find the flags.

4. **No Runtime Config**: Unlike other settings, these CLI args are not stored in config. They're parsed once at startup and passed through IPC. This simplifies the change - no config migration needed.

### Test Coverage Analysis

**Unit Tests** (`cli-parser.test.ts`):
- 26 test cases
- Tests cover: happy path, error cases, edge cases, usage messages
- High confidence: if unit tests pass, parser logic is correct
- These tests use internal property names (`keyLevel`, etc.) and need property name updates

**E2E Tests** (`app.spec.ts`):
- 21+ test cases
- Tests cover: full app lifecycle, lane functionality, filtering
- **Key insight**: E2E tests pass CLI args as **array of strings** to Electron, not as parsed objects
- Constants like `DEFAULT_CLI_ARGS` are arrays: `['--key-level', 'level', ...]`
- E2E tests only need **flag string updates**, NOT property name changes
- Test descriptions (strings) may reference old flag names and need updates
- High confidence: if E2E tests pass, integration is correct

**Total**: ~50 test cases provide excellent safety net for this refactoring.

### Naming Consistency Check

The internal property names follow a consistent pattern:
- `inputKeyLevel` - camelCase, clearly indicates "input key for level field"
- `inputKeyTimestamp` - camelCase, clearly indicates "input key for timestamp field"
- `filterColumnPatterns` - camelCase, clearly indicates "patterns for filter columns"

This naming is more semantic than the old names and will be easier for future developers to understand.

### Potential Gotchas

1. **String Literal Matching**: The `.` in `--input_key.level` must be handled as a literal character, not a nested property accessor. The parser does string comparison, so this works naturally.

2. **Usage Message Formatting**: The new flag names are longer. Need to verify the usage message still formats nicely and doesn't wrap awkwardly in terminal.

3. **Documentation Search**: After implementation, search for:
   - `--key-level` (with hyphen)
   - `--key-timestamp` (with hyphen)
   - `--lanes` (with hyphen)
   - `keyLevel` (camelCase)
   - `keyTimestamp` (camelCase)
   - `lanePatterns` (camelCase)

4. **Comment Updates**: Some comments reference old flag names. These are easy to miss because they don't cause compilation errors.

5. **E2E Test Structure** (CORRECTED): E2E tests use CLI args as an **array of strings**, NOT as a parsed object. The constants are:
   ```typescript
   const DEFAULT_CLI_ARGS = [
     '--key-level', 'level',
     '--key-timestamp', 'timestamp',
     '--lanes', 'error', 'auth'
   ]
   ```
   This means E2E tests only need flag name string updates, NOT property name changes.

### Implementation Time Estimate

Based on the straightforward nature of this task:
- **Phase 1-4** (Core changes): 15-20 minutes
- **Phase 5** (Unit tests): 10-15 minutes
- **Phase 6** (E2E tests): 5-10 minutes
- **Phase 7** (Renderer): 2 minutes
- **Phase 8** (Documentation): 5-10 minutes
- **Verification**: 5 minutes

**Total**: 40-60 minutes for careful implementation and verification.

### Verification Commands

After implementation, run these in order:

```bash
# Quick type check (fast feedback)
npm run typecheck

# Unit tests (fast feedback)
npm test

# Build (required for E2E)
npm run build

# E2E tests (slower, but comprehensive)
npm run test:e2e

# Manual smoke test
./test_manual.sh
```

### Success Indicators

The implementation is successful when:
1. All automated tests pass (unit + E2E)
2. No TypeScript errors
3. Manual test shows app working correctly
4. Grep search for old names returns zero results
5. Documentation is consistent with code

### Files Modified Count

- **Core logic**: 4 files
- **Unit tests**: 2 files
- **E2E tests**: 2 files
- **Documentation**: 3 files
- **Other**: 1 file (test_manual.sh)

**Total**: 12-13 files (depending on whether comments in other files need updates)

### DRY Principle Application

The change maintains DRY by:
- Single source of truth for flag names in `KNOWN_FLAGS` constant
- Single source of truth for property names in `CliArgsResult` interface
- All other code references these sources

No duplication of flag names or property names exists after the change.

### SRP Principle Application

Each file maintains single responsibility:
- `types.ts` - Type definitions only
- `cli-parser.ts` - Parsing logic only
- `index.ts` - App orchestration only
- `ipc-bridge.ts` - IPC communication only
- Tests - Verification only

The renaming doesn't violate SRP; it's purely a naming change.

## Post-Implementation Checklist

- [ ] All phases completed in order
- [ ] Typecheck passes
- [ ] Unit tests pass
- [ ] Build succeeds
- [ ] E2E tests pass
- [ ] Manual test succeeds
- [ ] No old flag names found in grep search
- [ ] Documentation updated and reviewed
- [ ] Commit message clear about breaking change
- [ ] Ready for code review

## Notes for Implementer

1. **Don't skip phases** - The order matters because of TypeScript dependencies.

2. **Run typecheck frequently** - After each phase, run `npm run typecheck` to catch issues early.

3. **Trust the tests** - If tests fail, don't skip them. Fix the underlying issue.

4. **Search thoroughly** - Use grep to find all references to old names, including comments.

5. **Test manually** - Even if all automated tests pass, run `./test_manual.sh` to verify real-world usage.

6. **Commit message** - Include "BREAKING CHANGE" in commit message to alert users.
