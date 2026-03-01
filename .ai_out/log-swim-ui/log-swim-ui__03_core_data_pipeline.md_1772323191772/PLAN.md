# Phase 03: Core Data Pipeline -- Implementation Plan

## 1. Problem Understanding

Build the pure-TypeScript data processing pipeline that transforms raw stdin text into sorted, classified, lane-assigned log entries. This pipeline lives entirely in `src/core/` with zero Electron/React dependencies, making it independently testable.

**Key constraint**: All modules are pure TypeScript. They will be wired into Electron main process in Phase 04, but must not import `electron`, `react`, or anything from `src/main/` or `src/renderer/`.

**Assumptions**:
- The pipeline processes one line at a time (line-delimited JSON).
- The timestamp field name and level field name are known at startup (from CLI args, passed as config).
- Lane definitions are known at startup but can be modified at runtime (add/reorder triggers re-classification).

---

## 2. Implementation Order

Order is chosen to minimize forward references and maximize testability at each step. Each module depends only on what came before it.

```
Phase A: types.ts              (zero deps -- foundation)
Phase B: json-parser.ts        (depends on: types)
Phase C: timestamp-detector.ts (depends on: types)
Phase D: lane-classifier.ts    (depends on: types)
Phase E: master-list.ts        (depends on: types)
Phase F: log-buffer.ts         (depends on: types, master-list)
Phase G: stdin-reader.ts       (depends on: types)
```

Each phase includes writing the module AND its tests before moving to the next.

---

## 3. Type Design (`src/core/types.ts`)

### 3.1 Result Type

A lightweight discriminated union for parse operations. Do NOT use exceptions for expected failures.

```typescript
interface ParseSuccess<T> {
  readonly ok: true
  readonly value: T
}

interface ParseFailure {
  readonly ok: false
  readonly error: string
}

type ParseResult<T> = ParseSuccess<T> | ParseFailure
```

### 3.2 LogEntry

```typescript
interface LogEntry {
  readonly rawJson: string
  readonly fields: Record<string, unknown>
  readonly timestamp: Date
  readonly level: string
  laneIndex: number  // mutable -- changes on lane reorder
}
```

**Design note**: `laneIndex` is the ONLY mutable field. It changes when lanes are reordered and re-classification occurs. Everything else is immutable once created.

### 3.3 LaneDefinition

```typescript
interface LaneDefinition {
  readonly pattern: string          // original regex string from CLI/UI
  readonly regex: RegExp | null     // null if pattern failed to compile
  readonly isError: boolean         // true if regex compilation failed
}
```

**Factory function** (not a class) to create a LaneDefinition:

```typescript
function createLaneDefinition(pattern: string): LaneDefinition
```

This function wraps `new RegExp(pattern)` in a try/catch. If compilation fails, returns `{ pattern, regex: null, isError: true }`.

### 3.4 TimestampFormat (Discriminated Union)

```typescript
const TIMESTAMP_FORMATS = ['iso8601', 'epochMillis'] as const
type TimestampFormat = typeof TIMESTAMP_FORMATS[number]
```

### 3.4.1 ViewTimestampFormat

```typescript
const VIEW_TIMESTAMP_FORMATS = ['iso', 'local', 'relative'] as const
type ViewTimestampFormat = typeof VIEW_TIMESTAMP_FORMATS[number]
```

### 3.5 ParsedLine (Result of JSON parsing)

```typescript
interface JsonParseSuccess {
  readonly ok: true
  readonly fields: Record<string, unknown>
  readonly rawJson: string
}

interface JsonParseFailure {
  readonly ok: false
  readonly rawLine: string
  readonly error: string
}

type ParsedLine = JsonParseSuccess | JsonParseFailure
```

### 3.6 StdinMessage (IPC message type for Phase 04)

```typescript
const STDIN_MESSAGE_TYPES = ['line', 'end', 'error'] as const
type StdinMessageType = typeof STDIN_MESSAGE_TYPES[number]

interface StdinMessage {
  readonly type: StdinMessageType
  readonly data?: string  // present for 'line' and 'error'
}
```

### 3.7 AppConfig

Mirror the config.json structure. Use `interface` for shapes.

```typescript
interface AppConfigColors {
  readonly levels: Readonly<Record<string, string>>
  readonly unrecognizedLevel: string
  readonly swimlaneHeaders: string
  readonly background: string
  readonly rowHover: string
  readonly expandedRow: string
}

interface AppConfigUI {
  readonly rowHeight: number
  readonly fontFamily: string
  readonly fontSize: number
  readonly viewTimestampFormat: ViewTimestampFormat
}

interface AppConfigPerformance {
  readonly flushIntervalMs: number
  readonly maxLogEntries: number
}

interface AppConfig {
  readonly colors: AppConfigColors
  readonly ui: AppConfigUI
  readonly performance: AppConfigPerformance
}
```

Also export a `DEFAULT_APP_CONFIG` constant with the values from the spec.

### 3.8 Exports

Export everything with named exports. No default exports.

### Test file: `tests/unit/core/types.test.ts`

Minimal tests:
- `createLaneDefinition` with valid regex produces `{ regex: RegExp, isError: false }`
- `createLaneDefinition` with invalid regex produces `{ regex: null, isError: true }`
- `DEFAULT_APP_CONFIG` has expected default values

---

## 4. JsonParser (`src/core/json-parser.ts`)

### Design Decision: Static class with a single method

Per CLAUDE.md: "Disfavor non-private free-floating functions. Favor cohesive classes; for stateless utilities, use a static class."

```typescript
class JsonParser {
  static parse(rawLine: string): ParsedLine
}
```

### Behavior
1. Try `JSON.parse(rawLine)`.
2. If result is not a plain object (`typeof !== 'object'` or `=== null` or `Array.isArray`), return failure: "Parsed value is not a JSON object".
3. On success, return `{ ok: true, fields: result, rawJson: rawLine }`.
4. On `SyntaxError`, return `{ ok: false, rawLine, error: e.message }`.

### Test file: `tests/unit/core/json-parser.test.ts`

BDD tests:
- GIVEN valid JSON object string / WHEN parsed / THEN returns success with fields
- GIVEN valid JSON array string / WHEN parsed / THEN returns failure (not an object)
- GIVEN malformed JSON / WHEN parsed / THEN returns failure with error message
- GIVEN empty string / WHEN parsed / THEN returns failure
- GIVEN JSON with nested objects / WHEN parsed / THEN fields contain nested structure
- GIVEN JSON string (primitive) like `"hello"` / WHEN parsed / THEN returns failure (not an object)

---

## 5. TimestampDetector (`src/core/timestamp-detector.ts`)

### Design Decision: Class with locked state

This is inherently stateful (locks on first detection). Use a class.

```typescript
class TimestampDetector {
  private lockedFormat: TimestampFormat | null = null

  detect(value: unknown): ParseResult<Date>
  getLockedFormat(): TimestampFormat | null
}
```

### Behavior

**Detection logic** (runs on first call only):
1. If `value` is a `string`:
   - Try `Date.parse(value)`. If result is a valid number (not NaN), lock as `iso8601`.
2. If `value` is a `number`:
   - Check range: `value > 0` (epoch 0) and `value < 4102444800000` (year 2100 in ms).
   - If in range, lock as `epochMillis`.
3. If neither works, return `ParseFailure` with descriptive error.

**Subsequent calls**:
- Use the locked format to parse. If the locked format is `iso8601` and value is not a string, return failure. If `epochMillis` and value is not a number, return failure.
- Parse errors on subsequent lines return `ParseFailure` (do NOT throw -- entry goes to unparseable panel).

**First line failure**: The spec says "throw with descriptive error message" on first-line failure. However, this conflicts with CLAUDE.md's preference for Result types over exceptions.

**Resolution**: Return `ParseFailure` on first line failure. Let the caller (Phase 04 integration) decide whether to throw or show an error state. The `TimestampDetector` itself should remain pure and not throw. Document this decision.

**WAIT**: Re-reading the spec: "Failure on first line: throw with descriptive error message". This is explicit. To respect the spec while keeping the detector pure, I recommend a two-method approach:

```typescript
class TimestampDetector {
  /**
   * Detect and lock the timestamp format from the first value.
   * Throws if the format cannot be determined.
   */
  detectAndLock(value: unknown): Date

  /**
   * Parse a timestamp value using the locked format.
   * Returns ParseResult -- failures go to unparseable panel.
   * Throws if called before detectAndLock.
   */
  parse(value: unknown): ParseResult<Date>

  getLockedFormat(): TimestampFormat | null
}
```

This way:
- `detectAndLock()` throws on failure (spec-compliant for first line).
- `parse()` returns `ParseResult` for subsequent lines (no throwing).
- Clear separation of "initialization" vs "steady-state" behavior.

### Test file: `tests/unit/core/timestamp-detector.test.ts`

BDD tests:
- GIVEN an ISO8601 string / WHEN detectAndLock is called / THEN returns Date and locks as iso8601
- GIVEN an epoch millis number / WHEN detectAndLock is called / THEN returns Date and locks as epochMillis
- GIVEN an unparseable value / WHEN detectAndLock is called / THEN throws with descriptive error
- GIVEN a negative number / WHEN detectAndLock is called / THEN throws (out of range)
- GIVEN a number > year 2100 / WHEN detectAndLock is called / THEN throws (out of range)
- GIVEN undefined value / WHEN detectAndLock is called / THEN throws (timestamp field missing)
- GIVEN format locked as iso8601 / WHEN parse is called with valid ISO string / THEN returns success
- GIVEN format locked as iso8601 / WHEN parse is called with number / THEN returns failure
- GIVEN format locked as epochMillis / WHEN parse is called with valid number / THEN returns success
- GIVEN format locked as epochMillis / WHEN parse is called with string / THEN returns failure
- GIVEN format not locked / WHEN parse is called / THEN throws (must call detectAndLock first)
- GIVEN format locked as iso8601 / WHEN parse is called with invalid ISO string / THEN returns failure

---

## 6. LaneClassifier (`src/core/lane-classifier.ts`)

### Design Decision: Static class

Stateless utility -- static class per CLAUDE.md convention.

```typescript
class LaneClassifier {
  /**
   * Classify a raw JSON string against lanes. First match wins.
   * Returns lane index, or lanes.length for "unmatched".
   */
  static classify(rawJson: string, lanes: readonly LaneDefinition[]): number

  /**
   * Re-classify all entries in the master list against new lane definitions.
   * Mutates each entry's laneIndex in place.
   */
  static reclassifyAll(
    entries: readonly LogEntry[],
    lanes: readonly LaneDefinition[]
  ): void
}
```

### Behavior

**classify**:
1. Iterate `lanes` left to right (index 0, 1, 2...).
2. Skip lanes where `regex` is `null` (error lanes).
3. First `lane.regex.test(rawJson)` that returns `true` -> return that index.
4. If no match, return `lanes.length` (the implicit "unmatched" index).

**reclassifyAll**:
1. For each entry, call `classify(entry.rawJson, lanes)` and update `entry.laneIndex`.

This is O(entries * lanes) which is fine for 20K entries and a handful of lanes.

### Test file: `tests/unit/core/lane-classifier.test.ts`

BDD tests:
- GIVEN lanes ["error", "auth"] and JSON containing "error" / WHEN classified / THEN returns index 0
- GIVEN lanes ["error", "auth"] and JSON containing "auth" / WHEN classified / THEN returns index 1
- GIVEN lanes ["error", "auth"] and JSON containing "debug" / WHEN classified / THEN returns lanes.length (unmatched)
- GIVEN lanes ["error", "auth"] and JSON containing both "error" and "auth" / WHEN classified / THEN returns index 0 (first match wins)
- GIVEN a lane with invalid regex (isError: true) / WHEN classified / THEN skips error lane, matches next
- GIVEN empty lanes array / WHEN classified / THEN returns 0 (unmatched index = lanes.length = 0)
- GIVEN entries and new lane order / WHEN reclassifyAll called / THEN all entries have updated laneIndex

---

## 7. MasterList (`src/core/master-list.ts`)

### Design Decision: Class (stateful, owns sorted array)

This is inherently stateful. Use a class.

```typescript
class MasterList {
  constructor(maxEntries: number)

  /** Insert a single entry in sorted position. */
  insert(entry: LogEntry): void

  /** Insert multiple entries (batch from buffer flush). */
  insertBatch(entries: readonly LogEntry[]): void

  /** Get entry at index (for virtualization). */
  get(index: number): LogEntry | undefined

  /** Current count of entries. */
  get length(): number

  /** Read-only access to all entries (for re-classification). */
  get entries(): readonly LogEntry[]
}
```

### Binary Search Insert

Use a simple binary search to find insertion point by `entry.timestamp`. Insert at that position using `Array.prototype.splice()`.

**Performance note**: `splice` is O(n) for shifting elements, but with a max of 20K entries and batch inserts happening every 200ms, this is well within performance budget. The data pipeline spec explicitly says 20K max -- no need to optimize with a B-tree or skip list.

**Batch insert optimization**: For `insertBatch`, sort the batch first (likely already sorted since they come from stdin in order), then merge the batch with the existing list. This avoids N individual splice operations. However, the 80/20 approach: just call `insert()` in a loop for the batch. If perf becomes an issue, optimize later.

**Decision**: Start with individual `insert()` calls in `insertBatch()`. The batch size per flush is at most `flushIntervalMs / line_processing_time` entries, which is small. Premature optimization is not needed.

### Eviction

After insert(s), if `this.entries.length > this.maxEntries`:
- Remove `this.entries.length - this.maxEntries` elements from the beginning (oldest entries).
- Use `this.entries.splice(0, excessCount)`.

### Binary Search Implementation

```typescript
// Find the index where entry should be inserted to maintain sort order.
// If timestamps are equal, insert AFTER existing entries with the same timestamp
// (preserves arrival order for same-millisecond entries).
private findInsertIndex(timestamp: Date): number
```

Use standard binary search. Compare `timestamp.getTime()` values. For equal timestamps, place AFTER (use `<=` in the comparison to move right).

### Test file: `tests/unit/core/master-list.test.ts`

BDD tests:
- GIVEN empty list / WHEN entry inserted / THEN list has length 1
- GIVEN list with entries / WHEN entry with middle timestamp inserted / THEN list remains sorted
- GIVEN list with entries / WHEN entry with oldest timestamp inserted / THEN entry is at index 0
- GIVEN list with entries / WHEN entry with newest timestamp inserted / THEN entry is at last index
- GIVEN list with duplicate timestamps / WHEN new duplicate inserted / THEN preserves insertion order (stable)
- GIVEN list at maxEntries / WHEN one more inserted / THEN oldest is evicted, length stays at max
- GIVEN list at maxEntries / WHEN batch inserted / THEN eviction brings length back to max
- GIVEN empty list / WHEN get(0) called / THEN returns undefined
- GIVEN list with 3 entries / WHEN get(1) called / THEN returns second entry

---

## 8. LogBuffer (`src/core/log-buffer.ts`)

### Design Decision: Class that OWNS the flush timer

The `LogBuffer` should own its flush timer because:
- It encapsulates the "accumulate and flush" behavior cleanly.
- The caller just pushes entries and provides a flush callback; the buffer handles timing.
- On `close()`, it does a final flush and clears the timer.

Receiving a tick signal would leak timing concerns to the caller and complicate testing (caller must remember to tick).

For testing, use `vi.useFakeTimers()` to control the timer.

```typescript
interface LogBufferConfig {
  readonly flushIntervalMs: number
}

type FlushCallback = (entries: readonly LogEntry[]) => void

class LogBuffer {
  constructor(config: LogBufferConfig, onFlush: FlushCallback)

  /** Add an entry to the buffer. */
  push(entry: LogEntry): void

  /** Signal stdin close. Performs final flush and stops timer. */
  close(): void

  /** Number of entries currently buffered (not yet flushed). */
  get pendingCount(): number
}
```

### Behavior

1. On construction, start a `setInterval` timer at `flushIntervalMs`.
2. On each tick, if buffer is non-empty: call `onFlush(entries)`, clear buffer.
3. On `close()`: if buffer is non-empty, flush immediately. Clear interval.
4. After `close()`, `push()` should throw (or silently discard -- prefer throw to catch bugs early).

### Test file: `tests/unit/core/log-buffer.test.ts`

BDD tests (use `vi.useFakeTimers()`):
- GIVEN a buffer with 200ms interval / WHEN entries pushed and 200ms elapses / THEN onFlush called with entries
- GIVEN a buffer with entries / WHEN less than interval elapses / THEN onFlush not called
- GIVEN a buffer with entries / WHEN close() called / THEN onFlush called immediately with all entries
- GIVEN an empty buffer / WHEN interval elapses / THEN onFlush NOT called (no empty flushes)
- GIVEN a closed buffer / WHEN push() called / THEN throws
- GIVEN a buffer / WHEN multiple intervals elapse / THEN each flush only contains entries from that interval
- GIVEN a buffer / WHEN close() called twice / THEN second close is a no-op (idempotent)

---

## 9. StdinReader (`src/core/stdin-reader.ts`)

### Design Decision: Callback pattern (NOT EventEmitter)

Reasons for callback over EventEmitter:
- **Simpler**: No need for event name strings, no `.on('line')` magic.
- **Type-safe**: Callbacks are fully typed at the call site.
- **Testable**: Easy to test by passing a mock readable stream and callbacks.
- **KISS**: EventEmitter adds complexity without benefit for this use case.

```typescript
import { Readable } from 'node:stream'
import { createInterface } from 'node:readline'

interface StdinReaderCallbacks {
  readonly onLine: (line: string) => void
  readonly onEnd: () => void
  readonly onError: (error: Error) => void
}

class StdinReader {
  /**
   * Start reading lines from the given readable stream.
   * Uses node:readline for line-by-line processing.
   */
  static start(input: Readable, callbacks: StdinReaderCallbacks): void
}
```

### Why accept `Readable` instead of using `process.stdin` directly

- **Testability**: Tests can pass a `Readable.from([...])` instead of actual stdin.
- **Dependency Inversion**: The reader doesn't know about process globals.
- **Phase 04 integration**: The Electron main process will pass `process.stdin` as the input.

### Implementation

Use `node:readline` `createInterface({ input })` which handles line splitting. Listen to `'line'`, `'close'`, and `'error'` events on the readline interface.

### Test file: `tests/unit/core/stdin-reader.test.ts`

BDD tests:
- GIVEN a readable stream with 3 lines / WHEN started / THEN onLine called 3 times, then onEnd
- GIVEN a readable stream with empty lines / WHEN started / THEN empty lines still trigger onLine
- GIVEN a stream that errors / WHEN started / THEN onError called with error
- GIVEN a stream with no lines (immediate close) / WHEN started / THEN onEnd called, onLine never called

---

## 10. Integration Considerations

### How these modules compose (preview for Phase 04)

```
StdinReader.start(process.stdin, {
  onLine: (rawLine) => {
    const parsed = JsonParser.parse(rawLine)
    if (!parsed.ok) { /* send to unparseable panel */ return }

    const tsValue = parsed.fields[config.keyTimestamp]
    const tsResult = detector.detectAndLock(tsValue)  // first line
    // or: detector.parse(tsValue)                    // subsequent lines

    const entry: LogEntry = {
      rawJson: rawLine,
      fields: parsed.fields,
      timestamp: tsResult,
      level: String(parsed.fields[config.keyLevel] ?? ''),
      laneIndex: LaneClassifier.classify(rawLine, lanes)
    }

    buffer.push(entry)
  },
  onEnd: () => buffer.close(),
  onError: (err) => { /* handle */ }
})
```

The `LogBuffer` flushes to `MasterList.insertBatch()`. This wiring happens in Phase 04.

---

## 11. File Layout Summary

```
src/core/
  types.ts                  # All shared types, interfaces, constants
  json-parser.ts            # JsonParser static class
  timestamp-detector.ts     # TimestampDetector class
  lane-classifier.ts        # LaneClassifier static class
  master-list.ts            # MasterList class
  log-buffer.ts             # LogBuffer class
  stdin-reader.ts           # StdinReader static class

tests/unit/core/
  types.test.ts
  json-parser.test.ts
  timestamp-detector.test.ts
  lane-classifier.test.ts
  master-list.test.ts
  log-buffer.test.ts
  stdin-reader.test.ts
```

---

## 12. Implementation Phases (Detailed)

### Phase A: Types (`src/core/types.ts`)

**Goal**: Establish all shared types as the foundation.

**Key steps**:
1. Create `src/core/types.ts` with all interfaces and types listed in Section 3.
2. Implement `createLaneDefinition(pattern: string): LaneDefinition` factory function.
3. Define `DEFAULT_APP_CONFIG` constant.
4. Write `tests/unit/core/types.test.ts`.
5. Run tests. Verify pass.
6. Run typecheck. Verify pass.

**Verification**: `npm test` passes, `npm run typecheck` passes.

### Phase B: JsonParser (`src/core/json-parser.ts`)

**Goal**: Parse raw JSON strings into structured results.

**Key steps**:
1. Create `src/core/json-parser.ts` with `JsonParser` static class.
2. Write `tests/unit/core/json-parser.test.ts` with all BDD tests from Section 4.
3. Run tests.

**Dependencies**: Phase A (imports `ParsedLine` from types).

**Verification**: All json-parser tests pass.

### Phase C: TimestampDetector (`src/core/timestamp-detector.ts`)

**Goal**: Detect and lock timestamp format, parse timestamps.

**Key steps**:
1. Create `src/core/timestamp-detector.ts`.
2. Implement `detectAndLock()` with ISO8601 and epoch millis detection.
3. Implement `parse()` using locked format.
4. Write `tests/unit/core/timestamp-detector.test.ts` with all BDD tests from Section 5.
5. Run tests.

**Dependencies**: Phase A (imports `TimestampFormat`, `ParseResult`).

**Verification**: All timestamp-detector tests pass.

### Phase D: LaneClassifier (`src/core/lane-classifier.ts`)

**Goal**: Classify log entries into lanes.

**Key steps**:
1. Create `src/core/lane-classifier.ts`.
2. Implement `classify()` and `reclassifyAll()`.
3. Write `tests/unit/core/lane-classifier.test.ts` with all BDD tests from Section 6.
4. Run tests.

**Dependencies**: Phase A (imports `LaneDefinition`, `LogEntry`).

**Verification**: All lane-classifier tests pass.

### Phase E: MasterList (`src/core/master-list.ts`)

**Goal**: Sorted collection with binary-search insert and eviction.

**Key steps**:
1. Create `src/core/master-list.ts`.
2. Implement binary search for insert position.
3. Implement eviction logic.
4. Write `tests/unit/core/master-list.test.ts` with all BDD tests from Section 7.
5. Run tests.

**Dependencies**: Phase A (imports `LogEntry`).

**Verification**: All master-list tests pass.

### Phase F: LogBuffer (`src/core/log-buffer.ts`)

**Goal**: Timer-based buffering with flush callback.

**Key steps**:
1. Create `src/core/log-buffer.ts`.
2. Implement timer-based flush using `setInterval`.
3. Implement `close()` with final flush.
4. Write `tests/unit/core/log-buffer.test.ts` with fake timers.
5. Run tests.

**Dependencies**: Phase A (imports `LogEntry`).

**Verification**: All log-buffer tests pass.

### Phase G: StdinReader (`src/core/stdin-reader.ts`)

**Goal**: Line-by-line reading from a Readable stream.

**Key steps**:
1. Create `src/core/stdin-reader.ts`.
2. Use `node:readline` for line splitting.
3. Write `tests/unit/core/stdin-reader.test.ts` using `Readable.from()`.
4. Run tests.

**Dependencies**: Phase A (types.ts defines `StdinMessage` for Phase 04 IPC usage, but `StdinReader` itself defines its own `StdinReaderCallbacks` interface and may not import from types.ts).

**IMPORTANT**: `stdin-reader.ts` imports from `node:stream` and `node:readline`, which are not available in browser context. Add `"exclude": ["src/core/stdin-reader.ts"]` to `tsconfig.web.json` to prevent type-check failures. The renderer process never imports this module directly (data arrives via IPC).

**Verification**: All stdin-reader tests pass.

### Phase H: Final verification

1. Verify `tsconfig.web.json` excludes `src/core/stdin-reader.ts` (added in Phase G).
2. Run all tests: `npm test`
3. Run typecheck: `npm run typecheck`
4. Verify no Electron/React imports in `src/core/`: `grep -r "electron\|react" src/core/` should find nothing.
5. Remove `src/core/.gitkeep` (no longer needed since directory has files).
6. Commit.

---

## 13. Technical Considerations

### Error Handling Strategy
- `JsonParser.parse()` returns `ParsedLine` discriminated union (never throws).
- `TimestampDetector.detectAndLock()` throws on first-line failure (per spec).
- `TimestampDetector.parse()` returns `ParseResult<Date>` (never throws).
- `createLaneDefinition()` catches regex compilation errors (never throws).
- `LogBuffer.push()` after `close()` throws (programming error, should be loud).
- `StdinReader` propagates stream errors via `onError` callback.

### Performance
- Binary search insert in MasterList: O(log n) search + O(n) splice. Fine for n <= 20K.
- Lane classification: O(lanes) per entry. Lanes are typically < 10.
- Re-classification: O(entries * lanes). For 20K entries and 10 lanes, that is 200K regex tests -- fast.
- Buffer flush every 200ms: amortizes rendering updates. Good for real-time performance.

### No `console.log`
Per CLAUDE.md, no `console.log` in production code. All modules should be silent. Error information flows through return types and callbacks.

---

## 14. Testing Strategy Summary

| Module | Test File | Key Test Categories |
|--------|-----------|-------------------|
| types | `tests/unit/core/types.test.ts` | Factory function, defaults |
| json-parser | `tests/unit/core/json-parser.test.ts` | Valid/invalid JSON, edge cases |
| timestamp-detector | `tests/unit/core/timestamp-detector.test.ts` | ISO detection, epoch detection, locking, failure cases, range validation |
| lane-classifier | `tests/unit/core/lane-classifier.test.ts` | First match wins, unmatched, error lanes, re-classification |
| master-list | `tests/unit/core/master-list.test.ts` | Sorted insert, eviction, batch, edge cases |
| log-buffer | `tests/unit/core/log-buffer.test.ts` | Timer flush, final flush, empty flush, closed state |
| stdin-reader | `tests/unit/core/stdin-reader.test.ts` | Line reading, end signal, error propagation |

All tests use BDD style with `GIVEN/WHEN/THEN` in `describe`/`it` blocks. One assert per test where practical. Explicit imports from `vitest` (no globals).

---

## 15. Key Design Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| StdinReader pattern | Callback (not EventEmitter) | Type-safe, simpler, testable with mock streams |
| MasterList | Class | Inherently stateful (owns sorted array) |
| LogBuffer timer | Owned by LogBuffer | Encapsulates accumulate-and-flush cleanly; testable with fake timers |
| TimestampDetector first-line failure | Throws (per spec) | Spec explicitly says "throw with descriptive error message" |
| TimestampDetector subsequent failures | Returns ParseResult | Expected behavior -- entry goes to unparseable panel |
| StdinReader input | Accepts `Readable` param | Dependency inversion for testability |
| Free-floating functions | Avoided (use static classes) | Per CLAUDE.md: "Disfavor non-private free-floating functions" |
| createLaneDefinition | Exception: exported factory function in types.ts | Factory functions for data creation are idiomatic; types.ts is not a class |
| Batch insert optimization | Not optimized (loop of individual inserts) | 80/20: batch sizes are small, premature optimization not needed |
| Result type | Custom `ParseResult<T>` discriminated union | Lightweight, no external deps, type-safe |

---

## 16. Open Questions

None. The spec is sufficiently detailed and all design decisions are resolved above.

---

## 17. Callouts

| WHAT | WHY-ItsCalledOut |
|------|-----------------|
| `createLaneDefinition` is a free-floating exported function, not a static class method | types.ts is a types-and-constants file. Adding a class just for one factory function would be over-engineering. This is a pragmatic exception to the "disfavor free-floating functions" rule. The function is cohesive with the type it creates. |
| `TimestampDetector.detectAndLock()` throws | The spec explicitly requires throwing on first-line timestamp failure. This is one of the few places we use exceptions. Documented clearly in JSDoc. |
| `DEFAULT_APP_CONFIG` lives in types.ts | It is closely coupled to the `AppConfig` interface. Placing it in a separate file would add a file for a single constant. If config logic grows in Phase 04, it can be extracted then. |
