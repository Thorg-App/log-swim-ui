# Phase 03: Core Data Pipeline -- Implementation Review

## Summary

The implementation delivers all 7 core modules (`types.ts`, `json-parser.ts`, `timestamp-detector.ts`, `lane-classifier.ts`, `master-list.ts`, `log-buffer.ts`, `stdin-reader.ts`) with 75 tests, all passing. TypeScript typecheck passes cleanly. No Electron/React imports in `src/core/`. No `any` usage. No `console.log` in production code. No `enum` usage. `tsconfig.web.json` correctly excludes `stdin-reader.ts`.

**Overall assessment**: HIGH QUALITY implementation. Faithful to the approved plan with one documented deviation (StdinReader error handling on `rl` instead of raw input, which is actually better). The code is clean, well-structured, follows CLAUDE.md standards, and has comprehensive test coverage.

---

## Verification Results

| Check | Result |
|-------|--------|
| `npm test` | 75 tests pass (8 files) |
| `npm run typecheck` | Clean (no errors) |
| No `any` in src/core/ | Confirmed |
| No `enum` in src/core/ | Confirmed |
| No `console.log` in src/core/ | Confirmed |
| No electron/react imports in src/core/ | Confirmed |
| No deleted test files vs main | Confirmed |
| `tsconfig.web.json` excludes stdin-reader.ts | Confirmed |

---

## Spec Compliance Checklist

| Acceptance Criterion | Status | Notes |
|---------------------|--------|-------|
| All core types in `src/core/types.ts` | PASS | LogEntry, LaneDefinition, ParsedLine, TimestampFormat, AppConfig, StdinMessage all defined |
| StdinReader reads line-by-line, emits end/error | PASS | Callback pattern with Readable parameter |
| JsonParser handles valid and malformed JSON | PASS | 12 tests covering objects, arrays, primitives, null, nested, empty, malformed |
| TimestampDetector detects ISO8601 and epoch millis | PASS | Two-method design (detectAndLock + parse), locks format, throws on first failure |
| LaneClassifier first-match-wins, invalid regex handling | PASS | Skips error lanes, returns lanes.length for unmatched |
| MasterList sorted order, binary-search insert, eviction | PASS | Stable sort for equal timestamps, eviction on excess |
| LogBuffer buffers and flushes at interval, final flush | PASS | Timer-based, idempotent close, throws on push-after-close |
| All modules have comprehensive unit tests | PASS | 75 BDD-style tests |
| All tests pass | PASS | 75/75 |
| No Electron or React dependencies in src/core/ | PASS | Verified via grep |

**Spec type not directly present**: `TimestampParser` interface (spec line 16). Instead, `TimestampDetector` class subsumes this role with `detectAndLock()` and `parse()` methods. This is a reasonable design decision documented in the plan (Section 5, two-method approach).

---

## CRITICAL Issues

None.

---

## IMPORTANT Issues

### I-1: Missing `// WHY:` comment on type assertion in JsonParser

**File**: `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/core/json-parser.ts`, line 25

```typescript
return { ok: true, fields: parsed as Record<string, unknown>, rawJson: rawLine }
```

Per CLAUDE.md: "No type assertions (`as`) unless justified with a `// WHY:` comment explaining why it is safe."

The assertion IS safe -- after the guards on lines 21 (`typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)`), the remaining case is a plain object. But it needs the WHY comment.

**Suggested fix**:
```typescript
// WHY: After eliminating null, arrays, and non-objects above, the remaining
// type from JSON.parse is a plain object, which is Record<string, unknown>.
return { ok: true, fields: parsed as Record<string, unknown>, rawJson: rawLine }
```

---

## Suggestions

### S-1: `reclassifyAll` test has 3 assertions

**File**: `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/tests/unit/core/lane-classifier.test.ts`, lines 93-106

The test verifies `entry1.laneIndex`, `entry2.laneIndex`, and `entry3.laneIndex` in one `it` block. The CLAUDE.md guideline says "One assert per test (preferably)". Since `reclassifyAll` is a batch operation that mutates multiple entries, testing them together is pragmatic. However, splitting into three tests within the same GIVEN/WHEN block would be more consistent with the pattern used elsewhere.

**Verdict**: Acceptable as-is. The batch nature of `reclassifyAll` makes combined assertion reasonable.

### S-2: `LogBuffer` timer leak if never closed

**File**: `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/core/log-buffer.ts`

If a `LogBuffer` is created but never `close()`-ed, the `setInterval` timer runs forever. This is a caller responsibility issue, not a bug in the class itself. A JSDoc note on the constructor or class saying "Callers MUST call close() to stop the timer" would help prevent misuse. The existing JSDoc on `close()` says "Signal stdin close" but doesn't warn about the consequence of not calling it.

### S-3: `Date.parse` accepts non-ISO strings

**File**: `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/core/timestamp-detector.ts`

`Date.parse()` accepts various date string formats beyond ISO 8601 (e.g., "October 13, 2014", "2024", "Mon Jan 15 2024"). For the use case (log viewers with structured JSON), this is unlikely to be a problem since log timestamps are typically ISO 8601. But if strict ISO 8601 validation is ever needed, a regex pre-check would be required.

**Verdict**: Acceptable for Phase 03. The spec says "ISO8601: Date.parse() succeeds" which is exactly what's implemented.

---

## Architecture Assessment

- **SRP**: Each module has a single, clear responsibility. Types are in types.ts. Parsing, detection, classification, storage, and buffering are all separate.
- **DRY**: No duplication detected across modules. The `makeEntry` helpers in tests are appropriately local (not shared) since they have different shapes.
- **Dependency inversion**: `StdinReader` accepts `Readable`, `LogBuffer` accepts a callback -- no concrete dependencies on downstream consumers.
- **Error handling**: Consistent pattern -- `ParseResult<T>` for expected failures, exceptions only for programmer errors (`parse()` before `detectAndLock()`, `push()` after `close()`) and spec-mandated first-line failure.
- **Testability**: All modules are independently testable. Tests use appropriate mocking (fake timers, `Readable.from()`, vi.fn()).

---

## Documentation Updates Needed

None required. CLAUDE.md is up to date for this phase.

---

## Verdict

**APPROVE with one required fix (I-1)**: Add `// WHY:` comment to the type assertion in `json-parser.ts` line 25.
