# Plan Review: Change CLI Input Key Names

## Executive Summary

The implementation plan is **thorough and well-structured** with a logical phase order that minimizes build breakage. The exploration document correctly identifies all affected files. However, there are **several issues** that need attention: (1) the naming convention `--regexes_for_filter_columns` is verbose and inconsistent with common CLI patterns (underscores), (2) the E2E test file structure differs from the plan's description, and (3) the plan misses one file that needs updates (`src/preload/electron-api.d.ts`). With minor revisions, this plan is ready for implementation.

---

## Critical Issues (BLOCKERS)

### 1. Naming Convention Inconsistency - `--regexes_for_filter_columns`

**Issue**: The proposed flag `--regexes_for_filter_columns` uses underscores, while the other two new flags use dots (`--input_key.level`, `--input_key.timestamp`). This is inconsistent and violates KISS.

**Impact**: Users will struggle to remember the pattern. Some flags have dots, others have underscores. This creates cognitive friction.

**Recommendation**: Pick ONE consistent separator:
- **Option A (dots)**: `--input_key.level`, `--input_key.timestamp`, `--filter_columns.regexes`
- **Option B (dashes - most common)**: `--input-key-level`, `--input-key-timestamp`, `--filter-columns`

Given the project uses dashes in `--key-level` currently, **dashes are the idiomatic CLI choice**. The dot notation (`input_key.level`) suggests nested configuration which is unusual for CLI flags.

**Suggested alternative naming**:
| Current | Recommended |
|---------|-------------|
| `--input_key.level` | `--level-field` |
| `--input_key.timestamp` | `--timestamp-field` |
| `--regexes_for_filter_columns` | `--filter-lanes` |

These are shorter, use dashes (idiomatic), and are self-explanatory.

---

### 2. ~~Missing File: `src/preload/electron-api.d.ts`~~ - VERIFIED, NO ACTION NEEDED

**Status**: Verified that `src/preload/electron-api.d.ts` exists but only imports `ElectronApi` from `../core/types`. It does NOT declare return types directly, so changes to `CliArgsResult` will automatically propagate through the type system. No modification needed for this file.

---

## Major Concerns

### 1. E2E Test File Structure Differs from Plan

**Concern**: The plan describes `DEFAULT_CLI_ARGS` and `SINGLE_LANE_CLI_ARGS` as objects with property names:
```typescript
// Plan says:
const DEFAULT_CLI_ARGS = {
  inputKeyLevel: 'level',
  inputKeyTimestamp: 'timestamp',
  filterColumnPatterns: ['error|ERROR|fatal', 'warn|WARN', 'info']
}
```

**Reality**: The actual code (line 13-17) uses an array of CLI flag strings:
```typescript
const DEFAULT_CLI_ARGS = [
  '--key-level', 'level',
  '--key-timestamp', 'timestamp',
  '--lanes', 'error', 'auth'
]
```

**Why this matters**: The E2E tests pass CLI args directly to `launchApp()` which passes them to Electron's command line. They are NOT parsed into an object structure. The plan's Phase 6 changes are incorrect.

**Suggestion**: Correct Phase 6 to show the actual array-based structure:
```typescript
// CORRECT:
const DEFAULT_CLI_ARGS = [
  '--input_key.level', 'level',
  '--input_key.timestamp', 'timestamp',
  '--regexes_for_filter_columns', 'error', 'auth'
]
```

---

### 2. Internal Property Names Are Verbose

**Concern**: The internal property renames (`inputKeyLevel`, `inputKeyTimestamp`, `filterColumnPatterns`) are significantly longer than the current names (`keyLevel`, `keyTimestamp`, `lanePatterns`).

**Why**: While more descriptive, these names will appear in many places:
- IPC handlers
- Test assertions
- Renderer code
- Debug logs

**Suggestion**: Consider shorter alternatives:
- `keyLevel` -> `levelField` (8 chars shorter than `inputKeyLevel`)
- `keyTimestamp` -> `timestampField`
- `lanePatterns` -> `lanes` or `filterLanes`

---

### 3. Phase Order Creates Temporary TypeScript Errors

**Concern**: Phase 1 changes `CliArgsResult` interface, but Phase 2-7 code still references old property names. This means TypeScript compilation will fail between Phase 1 and Phase 5.

**Why**: While this is expected and noted in the plan ("Unit tests will initially fail"), it means incremental commits are not possible without broken builds.

**Suggestion**: Consider batching Phase 1-5 into a single atomic commit, or structure as:
1. First commit: All property renames across ALL files (types + all usages)
2. Second commit: Test updates

---

## Simplification Opportunities (PARETO)

### 1. Reduce Scope: Only Change CLI Flags, Not Internal Properties

**Current approach**: Change both CLI flags AND internal property names.

**Simpler alternative**: Only change CLI flag names. Keep internal property names as-is (`keyLevel`, `keyTimestamp`, `lanePatterns`).

**Value**:
- Cuts scope by ~50%
- Reduces risk of breaking changes
- Internal names are already clear
- Only documentation and CLI parser need changes

**Trade-off**: Less semantic purity internally, but significantly less work and risk.

---

### 2. Use Find-and-Replace Strategy

**Current approach**: Manual phase-by-phase updates.

**Simpler alternative**: Use IDE refactoring tools:
1. Rename interface properties in `types.ts` (IDE updates all usages)
2. Update CLI parser flag strings
3. Update tests

**Value**: Faster, less error-prone, automatic detection of all references.

---

## Minor Suggestions

1. **Add grep verification for old names**: The post-implementation grep commands should also search `.json` files (test data) and `.sh` files.

2. **Update CLAUDE.md**: The project's CLAUDE.md mentions `--key-level`, `--key-timestamp`, `--lanes` in the project structure section. Add this to Phase 8.

3. **Consider deprecation warning**: Instead of hard break, emit a deprecation warning if old flags are used. This gives users migration time.

4. **Phase 5 unit test count**: The plan says "~50+ occurrences across 26 test cases" but the actual test file shows fewer property accesses. Verify the estimate.

---

## Strengths

1. **Comprehensive exploration**: The exploration document correctly identifies all affected files and their relationships.

2. **Logical phase order**: Starting with types, then parser, then consumers minimizes confusion.

3. **Clear acceptance criteria**: The checklist format makes verification straightforward.

4. **Good risk mitigation**: TypeScript compiler as the safety net is the right approach.

5. **Rollback plan**: Clear instructions for reverting if issues arise.

6. **Post-implementation verification**: The grep search for old names is a good catch-all.

---

## Verdict

- [ ] APPROVED
- [x] APPROVED WITH MINOR REVISIONS
- [ ] NEEDS REVISION
- [ ] REJECTED

### Required Revisions Before Implementation

1. **BLOCKER**: Resolve naming convention inconsistency. Recommend using dashes consistently or reconsider the entire naming scheme.

2. **Major**: Correct E2E test file changes in Phase 6 to reflect actual array-based structure.

### Recommended (Non-Blocking)

1. Consider shorter internal property names.
2. Consider batching changes to avoid intermediate broken builds.
3. Evaluate the PARETO alternative of only changing CLI flags.
4. Add CLAUDE.md to documentation update list.

---

## Recommendation

**Proceed to implementation after addressing the naming convention blocker and verifying the preload types file.** The plan is fundamentally sound, but the naming inconsistency will cause user confusion if shipped as-is.
