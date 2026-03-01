# Phase 05 — Exploration: Key Findings for Implementation Planning

## Key Types for Renderer

- **`IpcLogLine`**: `{ rawJson: string, fields: Record<string, unknown>, timestamp: number (epoch ms, 0=unparseable), level: string ('unknown' if missing) }`
- **`LogEntry`**: `{ rawJson, fields, timestamp: Date, level, laneIndex (MUTABLE) }`
- **`LaneDefinition`**: `{ pattern: string, regex: RegExp|null, isError: boolean }` — factory: `createLaneDefinition(pattern)`
- **`AppConfig`**: `{ colors: { levels, unrecognizedLevel, swimlaneHeaders, background, rowHover, expandedRow }, ui: { rowHeight, fontFamily, fontSize, viewTimestampFormat }, performance: { flushIntervalMs, maxLogEntries } }`
- **`CliArgsResult`**: `{ keyLevel, keyTimestamp, lanePatterns: readonly string[] }`
- **`ViewTimestampFormat`**: `'iso' | 'local' | 'relative'`

## Core APIs Available

- **`MasterList(maxEntries)`**: `.insert(entry)`, `.insertBatch(entries)`, `.get(index)`, `.length`, `.entries` (readonly)
- **`LaneClassifier.classify(rawJson, lanes)`**: returns lane index (`lanes.length` = unmatched)
- **`LaneClassifier.reclassifyAll(entries, lanes)`**: mutates `laneIndex` in place
- **`LogBuffer(config, onFlush)`**: `.push(entry)`, `.close()`, `.pendingCount`
- **`JsonParser.parse(rawLine)`**: returns `ParsedLine` discriminated union
- **`TimestampDetector()`**: `.detectAndLock(value)`, `.parse(value)`, `.getLockedFormat()`

## Preload API (window.api)

- **Push**: `onLogLine(cb)`, `onStreamEnd(cb)`, `onStreamError(cb)`, `onConfigError(cb)`
- **Request**: `getConfig()`, `saveConfig(config)`, `getCliArgs()`

## CSS Design System Ready

- All tokens in `tokens.css` (colors, spacing, typography, shadows, borders, layout, transitions)
- Component classes ready: `.swimlane-grid`, `.swimlane-column`, `.log-row`, `.log-row--LEVEL`, `.log-row--expanded`, `.lane-header`, `.mode-toggle`, `.stream-ended`, `.unparseable-panel`
- `applyConfigToCSS(config)` exists but not yet wired

## Current Renderer State

- `App.tsx` renders `DesignReferencePage` (placeholder, to be replaced)
- `main.tsx` bootstraps React
- No state management, no virtualization yet
- `@tanstack/virtual` NOT in `package.json` yet (must be installed)
- React 19.2.4, strict TypeScript

## Key Invariants

1. `LogEntry.laneIndex` is mutable (updates on lane changes)
2. `MasterList` is always sorted ascending by timestamp
3. `IpcLogLine.timestamp` is epoch millis number, not `Date`
4. Unmatched entries: `laneIndex === lanes.length`
5. First-line errors halt ingestion (`STREAM_ERROR` sent)
6. Invalid lane regexes are skipped during classification
7. Config deeply merged with defaults

## IPC Bridge Notes

- `LaneClassifier` is NOT used in `IpcBridge` — classification happens in the renderer
- `IpcBridge` sends raw `IpcLogLine` (no lane assignment)
- Renderer must: convert `IpcLogLine` -> `LogEntry`, classify, insert into `MasterList`

## Build Config

- Path aliases: `@renderer/*` -> `src/renderer/src/*`, `@core/*` -> `src/core/*`
- Configured in: `electron.vite.config.ts`, `tsconfig.web.json`, `vitest.config.ts`
