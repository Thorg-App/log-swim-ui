# Phase 03: Core Data Pipeline

## Objective
Implement the core data processing pipeline: types, stdin reading, JSON parsing, timestamp detection/parsing, lane classification, buffering with flush, sorted master list with binary-search insert, and eviction. All as pure TypeScript modules with no Electron or React dependencies, fully unit-tested.

## Prerequisites
- Phase 01 complete (project scaffold, TypeScript, Vitest)

## Scope
### In Scope
- Define core types in `src/core/types.ts`:
  - `LogEntry`: rawJson, parsedFields, timestamp (Date), level (string), laneIndex (number)
  - `LaneDefinition`: regex (RegExp), pattern (string), isError (boolean)
  - `ParsedLine`: result of JSON parsing (success with fields, or failure with raw string)
  - `TimestampParser`: interface for locked-in parser (ISO8601 or epoch millis)
  - `AppConfig`: mirrors config.json structure
  - `StdinMessage`: IPC message type (`'line' | 'end' | 'error'`)
- Implement `StdinReader` (`src/core/stdin-reader.ts`):
  - Reads `process.stdin` line-by-line
  - Emits parsed lines or errors
  - Detects stdin close and emits end signal
- Implement `JsonParser` (`src/core/json-parser.ts`):
  - Parses a raw string as JSON
  - Returns success (parsed object) or failure (raw string preserved)
- Implement `TimestampDetector` (`src/core/timestamp-detector.ts`):
  - On first valid JSON line: detect format (ISO8601 or epoch millis)
  - Lock in the detected parser for the session
  - ISO8601: `Date.parse()` succeeds and returns valid date
  - Epoch millis: numeric value, must be > 1970-01-01 and < 2100-01-01
  - Failure on first line: throw with descriptive error message
  - Subsequent parse failures: return error (line goes to unparseable panel)
- Implement `LaneClassifier` (`src/core/lane-classifier.ts`):
  - Takes a list of `LaneDefinition` and a raw JSON string
  - Tests regexes left-to-right, first match wins
  - Returns lane index (or "unmatched" index)
  - Handles invalid regexes gracefully (marks lane as error, doesn't crash)
  - Supports re-classification when lane order changes
- Implement `MasterList` (`src/core/master-list.ts`):
  - Sorted array of `LogEntry` by timestamp (ascending)
  - Binary-search insert for new entries
  - Eviction: when size exceeds `maxLogEntries` (default 20,000), remove oldest entries
  - Provides efficient access by index for virtualization
- Implement `LogBuffer` (`src/core/log-buffer.ts`):
  - Accumulates parsed log entries
  - Flushes at configurable interval (`flushIntervalMs`, default 200ms)
  - On stdin close: immediate final flush
  - Flush inserts all buffered entries into `MasterList`
- Unit tests for all modules (Vitest, BDD style):
  - `TimestampDetector`: ISO8601 detection, epoch millis detection, range validation, failure cases
  - `LaneClassifier`: first-match-wins, unmatched fallback, invalid regex handling, re-classification
  - `MasterList`: sorted insert, eviction, edge cases (empty list, single entry, duplicate timestamps)
  - `LogBuffer`: flush timing, final flush on close
  - `JsonParser`: valid JSON, malformed JSON, edge cases

### Out of Scope
- Electron main process integration (Phase 04)
- IPC bridge (Phase 04)
- Config file reading/writing (Phase 04)
- UI rendering (Phase 05+)

## Implementation Guidance

### Type Design
```typescript
interface LogEntry {
  readonly rawJson: string;
  readonly fields: Record<string, unknown>;
  readonly timestamp: Date;
  readonly level: string;
  laneIndex: number; // mutable — changes on lane reorder
}

interface LaneDefinition {
  readonly pattern: string;    // original regex string
  readonly regex: RegExp | null; // null if pattern failed to compile
  readonly isError: boolean;   // true if regex compilation failed
}
```

### Timestamp Detection
The first valid JSON line locks in the parser. Use a discriminated union:
```typescript
type TimestampFormat = { kind: 'iso8601' } | { kind: 'epochMillis' };
```

### Lane Classification
```typescript
// Classify a single entry against all lanes
function classify(rawJson: string, lanes: readonly LaneDefinition[]): number {
  for (let i = 0; i < lanes.length; i++) {
    if (lanes[i].regex && lanes[i].regex.test(rawJson)) return i;
  }
  return lanes.length; // "unmatched" index
}
```

### Eviction
When `masterList.length > maxLogEntries`, remove the first `(length - maxLogEntries)` entries (oldest). This keeps the list capped at `maxLogEntries`.

## Acceptance Criteria
- [ ] All core types defined in `src/core/types.ts`
- [ ] `StdinReader` reads line-by-line and emits end/error signals
- [ ] `JsonParser` handles valid and malformed JSON
- [ ] `TimestampDetector` detects ISO8601 and epoch millis, throws on failure, locks format
- [ ] `LaneClassifier` classifies entries with first-match-wins, handles invalid regexes
- [ ] `MasterList` maintains sorted order with binary-search insert and eviction
- [ ] `LogBuffer` buffers and flushes at interval, final flush on close
- [ ] All modules have comprehensive unit tests (BDD, GIVEN/WHEN/THEN)
- [ ] All tests pass
- [ ] No Electron or React dependencies in `src/core/`

## Notes
- All modules in `src/core/` must be pure TypeScript with no Electron or React imports. This ensures they're independently testable and reusable.
- The `LaneClassifier` must handle `RegExp` compilation errors gracefully — catch the error, mark the lane as `isError: true`, and continue with other lanes.
