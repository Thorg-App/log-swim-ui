# EXPLORATION: make-it-work-nicer-with-tail-capitol-f

## Problem Statement
`tail -F some-file | log-swim-ui` produces errors because `tail -F` output includes:
1. Valid JSONL lines (desired)
2. Separator lines like `==> vsc_client.2026_03_01.log <==` (should be ignored)
3. Empty lines (should be ignored)

## Current Data Flow
```
stdin → StdinReader.start() → onLine(line) → IpcBridge.handleLine(line)
  → JsonParser.parse(line) → (if first line fails → halt) → process/send
```

## Key Files
| File | Purpose |
|------|---------|
| `src/core/stdin-reader.ts` | Line-by-line stdin reading (generic utility) |
| `src/core/json-parser.ts` | JSON parsing with success/failure result |
| `src/main/ipc-bridge.ts` | Wires stdin → parse → timestamp → IPC send |
| `src/core/types.ts` | Core types including `ParsedLine` |

## Current Behavior (from ipc-bridge.ts)
- First line that fails JSON parse → sends `STREAM_ERROR`, halts ingestion
- Non-first line that fails JSON parse → silently skips

## Recommended Implementation Location
**IpcBridge.handleLine()** - Add filtering BEFORE JsonParser.parse()

### Why not StdinReader?
- StdinReader is a generic utility, should not have `tail -F` specific logic
- Violates SRP (reading vs filtering)

### Why not JsonParser?
- JsonParser is a generic JSON parsing utility
- Filtering non-JSON lines is not its responsibility

### Why IpcBridge?
- It's the orchestration layer that connects reading → parsing → processing
- Single place to add filtering logic
- Handles "first line is separator" case properly (won't cause false error)
- KISS principle - simple change in one place

## Regex Pattern for Tail Separator
```
^==> .+ <==$
```
- Starts with `==> ` (note the space after)
- Followed by filename (any characters)
- Ends with ` <==` (note the space before)

## Implementation Approach
1. Add `shouldIgnoreLine(line: string): boolean` helper in IpcBridge
2. Call it at the start of `handleLine()` before JSON parsing
3. Return early if line should be ignored
4. Add unit tests for the new filtering logic
