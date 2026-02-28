# log-swim-ui

## Problem Statement
Engineers working with JSON log streams (from `kubectl logs`, application output, etc.) need a way to visually classify and explore logs in real time. Existing tools are either purely text-based or require complex setup. `log-swim-ui` provides instant swimlane visualization of piped JSON logs with regex-based classification, requiring zero configuration beyond CLI arguments.

## Goals
- Read JSON log lines from stdin and render them in a swimlane UI in real time
- Classify logs into user-defined lanes via regex patterns (first match wins, left-to-right)
- Provide Live and Scroll modes for real-time monitoring vs. historical examination
- Allow in-session lane management: add lanes via UI, drag-to-reorder priority
- Offer a global filter bar for cross-lane filtering (AND logic)
- Support configurable theming and settings via a slide-out settings panel

## Non-Goals (Out of Scope)
- Windows support
- Persistent ad-hoc lane definitions across sessions
- Log export
- Multiple simultaneous stdin streams
- Network/file-based log sources (stdin only)
- Authentication or access control
- Plugin system

## Solution Overview
An Electron desktop app (macOS/Linux) that reads line-delimited JSON from stdin in the main process, parses and classifies each entry against user-defined regex lanes, buffers entries and flushes them into a timestamp-sorted master list at a configurable interval, and renders the result in a virtualized CSS grid swimlane layout in the renderer process. The app supports Live mode (auto-scroll to latest) and Scroll mode (freeze for examination), with automatic mode switching on user scroll. A slide-out settings panel provides runtime access to all configuration options.

## User-Facing Behavior

- **Behavior: Normal log ingestion**
  - GIVEN the app is launched with `--key-level` and `--key-timestamp` and piped stdin
  - WHEN JSON log lines arrive
  - THEN each line is classified into the first matching lane (or "unmatched") and displayed

- **Behavior: Start without lanes**
  - GIVEN the app is launched without `--lanes`
  - WHEN logs arrive
  - THEN all logs appear in the "unmatched" lane
  - AND user can add lanes via the UI

- **Behavior: Lane classification by regex**
  - GIVEN lanes are defined as regex patterns (e.g., `"error|ERROR|fatal" "auth"`)
  - WHEN a log line's raw JSON matches the first regex
  - THEN it appears in that lane's column

- **Behavior: Row expansion**
  - GIVEN a log row is visible
  - WHEN the user clicks on it
  - THEN the row expands inline to show full pretty-printed JSON

- **Behavior: Live mode**
  - GIVEN the app is in Live mode
  - WHEN new log entries arrive
  - THEN the view auto-scrolls to show the latest entry

- **Behavior: Auto-switch to Scroll mode**
  - GIVEN the app is in Live mode
  - WHEN the user scrolls up
  - THEN the app switches to Scroll mode automatically

- **Behavior: Manual switch to Live mode**
  - GIVEN the app is in Scroll mode
  - WHEN the user clicks the Live mode toggle
  - THEN the app switches to Live mode and scrolls to the latest entry

- **Behavior: Stream ended**
  - GIVEN stdin is being read
  - WHEN stdin closes
  - THEN a "stream ended" indicator is shown
  - AND the app remains open for browsing/filtering

- **Behavior: Eviction**
  - GIVEN the configured max log entries limit (default 20,000) is reached
  - WHEN a new log entry arrives
  - THEN the oldest entry is evicted to make room

- **Behavior: Unparseable timestamp**
  - GIVEN a log line is valid JSON but its timestamp field fails to parse
  - WHEN the line is ingested
  - THEN the line appears in a persistent bottom panel
  - AND the bottom panel becomes visible (hidden when no errors exist)

- **Behavior: Unparseable log level**
  - GIVEN a log line has an unrecognized `level` value
  - WHEN rendered
  - THEN its left border is orange (`#F97316`)

- **Behavior: Invalid regex lane**
  - GIVEN a lane regex is invalid (fails to compile)
  - WHEN the app starts or lane is added via UI
  - THEN that lane column is shown in an error state
  - AND other lanes function normally

- **Behavior: Duplicate lane regexes**
  - GIVEN two identical lane regexes are provided
  - WHEN the app starts
  - THEN both columns appear; the second will be empty (first match wins)

- **Behavior: Lane drag reorder**
  - GIVEN multiple lanes are visible
  - WHEN the user drags a lane to a new position
  - THEN classification priority changes and all entries are re-classified

- **Behavior: Ad-hoc lane addition**
  - GIVEN the app is running
  - WHEN the user adds a regex via the UI
  - THEN a new lane is inserted before "unmatched"
  - AND existing + new logs are classified against the updated lane set

- **Behavior: Filter bar**
  - GIVEN the filter bar is available
  - WHEN the user adds filters (field filter or raw regex)
  - THEN only rows matching ALL active filters are visible across all lanes
  - AND filters can be added, removed, and toggled on/off

- **Behavior: Settings panel**
  - GIVEN the app is running
  - WHEN the user clicks the gear icon
  - THEN a slide-out panel appears from the right with all configurable options
  - AND changes are saved to `~/.config/log-swim-ui/config.json`

- **Error: No stdin pipe**
  - GIVEN the app is launched without piped stdin (`process.stdin.isTTY === true`)
  - WHEN the app starts
  - THEN usage help is printed to stderr and the app exits with code 1

- **Error: Invalid config.json**
  - GIVEN config.json exists but is malformed or has invalid values
  - WHEN the app starts
  - THEN a full-screen error state is shown with a "Revert to defaults" button

- **Error: First line not valid JSON**
  - GIVEN stdin is piped
  - WHEN the first line received is not valid JSON
  - THEN an error is shown and ingestion halts

- **Error: Timestamp parse failure on first line**
  - GIVEN the first valid JSON line is received
  - WHEN its timestamp field cannot be parsed as ISO8601 or epoch millis
  - THEN an error is shown with the field name and value, and ingestion halts

## Key Decisions
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Language | TypeScript (strict) | Type-rich domain (log entries, lane defs, config schema) benefits from compile-time checks |
| Build tooling | Vite + electron-vite | Modern, fast, good DX for Electron apps |
| Package manager | npm | Standard, widely supported |
| Unit tests | Vitest (BDD, GIVEN/WHEN/THEN) | Fast, native TS support, pairs well with Vite |
| E2E / visual testing | Playwright + Playwright MCP | Screenshot-based testing for visual correctness |
| Distribution | npm global install | Simple distribution, cross-platform (macOS/Linux) |
| Virtualization | @tanstack/virtual | Proven library for virtualizing large lists |
| Styling | CSS custom properties (tokens) | Clean separation of theme from components |
| Lane definition format | Regex-only (no names) | Simplicity — lane headers show the regex pattern |
| CLI required args | `--key-level`, `--key-timestamp` | Explicit is better than implicit; no guessing field names |
| CLI optional args | `--lanes` | Start with just "unmatched", add lanes via UI |
| Eviction strategy | Evict oldest, configurable max (default 20K) | Rolling window — always see latest logs |
| Timestamp display | `viewTimestampFormat`: iso, local, relative | "relative" = relative to first log entry received |
| Unrecognized log level color | Orange (`#F97316`) | High visibility for unexpected values |
| Settings UI | Slide-out panel from right | Non-disruptive, logs remain visible |
| Lane reordering | Drag-and-drop with full re-classification | Priority order matters for first-match-wins |

## Key Types & Interfaces

| Type/Interface | Purpose | Location | Key Fields/Methods |
|----------------|---------|----------|-------------------|
| `LogEntry` | Parsed log line | `src/core/types.ts` | `rawJson, timestamp, level, laneIndex, fields` |
| `LaneDefinition` | A single lane config | `src/core/types.ts` | `regex: RegExp, pattern: string, isError: boolean` |
| `AppConfig` | Full app configuration | `src/core/types.ts` | `colors, ui, performance` (mirrors config.json) |
| `StdinMessage` (IPC) | Main→Renderer log data | `src/core/types.ts` | `type: 'line' \| 'end' \| 'error', data` |

## Components / Architecture

```
┌─ Main Process (Electron) ──────────────────────────────┐
│  CLI arg parsing → stdin reader → JSON parser           │
│  → IPC bridge (sends parsed lines to renderer)          │
│  Config file management (read/write/defaults)           │
└─────────────────────────────────────────────────────────┘
        │ IPC (ipcMain ↔ ipcRenderer)
        ▼
┌─ Renderer Process (React) ─────────────────────────────┐
│  ┌─ App ──────────────────────────────────────────────┐ │
│  │ ┌─ Filter Bar ──────────────────────────────────┐  │ │
│  │ │ [+ Add Filter] [field:value ×] [regex ×]      │  │ │
│  │ └──────────────────────────────────────────────  ┘  │ │
│  │ ┌─ Mode Toggle ─┐ ┌─ Lane Add ─┐ ┌─ Settings ─┐  │ │
│  │ │ ● Live ○ Scroll│ │ [+ Lane]   │ │    ⚙      │  │ │
│  │ └───────────────  ┘ └───────────  ┘ └──────────  ┘  │ │
│  │ ┌─ Swimlane Grid (CSS Grid, virtualized) ───────┐  │ │
│  │ │ [regex1]  │ [regex2]  │ [unmatched]            │  │ │
│  │ │──────────│──────────│──────────────────────── │  │ │
│  │ │ [row 0]  │          │                          │  │ │
│  │ │          │ [row 1]  │                          │  │ │
│  │ │          │          │ [row 2]                   │  │ │
│  │ └──────────────────────────────────────────────  ┘  │ │
│  │ ┌─ Unparseable Timestamp Panel (conditional) ────┐  │ │
│  │ │ [lines with failed timestamp parse]             │  │ │
│  │ └──────────────────────────────────────────────  ┘  │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌─ Settings Slide-out (conditional) ─────────────────┐ │
│  │ Colors, UI, Performance settings                    │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Data Pipeline
```
stdin → line-by-line read → JSON parse (skip malformed with warning)
  → push to buffer[]
  → every flushIntervalMs (default 200ms):
      → binary-search insert into sorted master list (by timestamp)
      → evict oldest if over maxLogEntries (default 20,000)
      → classify each entry against lanes (first match wins)
      → clear buffer → trigger re-render
  → on stdin close:
      → final flush → mark stream as ended
```

## Approved Behavior Changes
None — this is a greenfield project with no existing behaviors.

## Success Criteria
- [ ] App launches via `cat logs.json | log-swim-ui --key-level level --key-timestamp timestamp`
- [ ] Logs are classified into regex-defined lanes (first match wins)
- [ ] Unmatched logs appear in the "unmatched" lane
- [ ] Live mode auto-scrolls; Scroll mode freezes on user scroll-up
- [ ] Mode toggle switches between Live and Scroll
- [ ] Lane drag-and-drop reorders lanes and re-classifies all entries
- [ ] Ad-hoc lanes can be added via UI (regex only, inserted before "unmatched")
- [ ] Global filter bar filters across all lanes (AND logic)
- [ ] Settings slide-out panel allows editing all config options and saves to disk
- [ ] Log rows show colored left border by level, expand on click to show full JSON
- [ ] Unparseable timestamp lines appear in a bottom panel (visible only when errors exist)
- [ ] Unrecognized log levels get orange left border
- [ ] Invalid regex lanes show error state without breaking other lanes
- [ ] Eviction removes oldest entries when max (default 20K) is exceeded
- [ ] Stream-ended indicator shown when stdin closes; app remains open
- [ ] Error states handled: no stdin pipe, invalid config, bad first line, timestamp parse failure
- [ ] npm global install works on macOS and Linux
- [ ] **INVARIANT**: Existing user-facing behaviors NOT listed in "Approved Behavior Changes" SHALL remain unchanged
- [ ] **INVARIANT**: Tests that solidify existing user behavior SHALL NOT be deleted or modified without explicit approval

## Phases Overview
| Phase | Name | Summary |
|-------|------|---------|
| 01 | Project Scaffold & Build Config | electron-vite + TS + Vitest + Playwright + CLAUDE.md + .mcp.json + .npmignore |
| 02 | UI Design Direction | Design system, CSS tokens, component wireframes using frontend design memory |
| 03 | Core Data Pipeline | Types, stdin reading, JSON parsing, timestamp detection, lane classification, buffering, eviction |
| 04 | Electron Shell & CLI | Main process, CLI arg parsing, config system, IPC bridge, error states |
| 05 | UI - Swimlane Layout, Rows & Modes | CSS grid, virtualization, log rows, expand, lane headers, Live/Scroll toggle, stream-ended, unparseable panel |
| 06 | UI - Filters, Drag & Lane Management | Global filter bar, ad-hoc lane addition, draggable lane reorder with re-classification, E2E tests |
| 07 | Settings Panel | Slide-out settings panel, all config options editable, save to disk |

See individual task file(s) in `./tasks/todo/` for details.

## CLI Reference

### Invocation
```bash
cat logs.json | log-swim-ui --key-level level --key-timestamp timestamp
cat logs.json | log-swim-ui --key-level level --key-timestamp timestamp --lanes "error|ERROR|fatal" "auth"
kubectl logs my-pod | log-swim-ui --key-level level --key-timestamp ts --lanes "error|ERROR" "timeout"
```

### Arguments
| Argument | Required | Description |
|----------|----------|-------------|
| `--key-level` | Yes | JSON field name to read log level from |
| `--key-timestamp` | Yes | JSON field name to read timestamp from |
| `--lanes` | No | One or more regex patterns defining lanes. Without this, only "unmatched" lane exists. |

### Lane Behavior
- Each `--lanes` value is a regex pattern (no names, no `::` separator)
- Regex matched case-sensitively against the full raw JSON string
- Lanes evaluated left-to-right, first match wins
- Implicit "unmatched" lane always exists as the last lane
- Lane column headers show the regex pattern (truncated with tooltip on hover)

## Configuration

### Location
```
$HOME/.config/log-swim-ui/config.json
```

### Default config.json
```json
{
  "colors": {
    "levels": {
      "trace":    "#6B7280",
      "debug":    "#94A3B8",
      "info":     "#3B82F6",
      "notice":   "#06B6D4",
      "warn":     "#F59E0B",
      "warning":  "#F59E0B",
      "error":    "#EF4444",
      "fatal":    "#991B1B",
      "critical": "#991B1B"
    },
    "unrecognizedLevel": "#F97316",
    "swimlaneHeaders":   "#1E293B",
    "background":        "#0F172A",
    "rowHover":          "#1E293B",
    "expandedRow":       "#334155"
  },
  "ui": {
    "rowHeight":           32,
    "fontFamily":          "monospace",
    "fontSize":            12,
    "viewTimestampFormat": "iso"
  },
  "performance": {
    "flushIntervalMs": 200,
    "maxLogEntries":   20000
  }
}
```

## Technology Stack
| Concern | Choice |
|---------|--------|
| Language | TypeScript (strict) |
| App shell | Electron |
| Build tooling | Vite + electron-vite |
| UI framework | React |
| Virtualization | @tanstack/virtual |
| Swimlane layout | CSS Grid |
| Styling | CSS custom properties (tokens) |
| Unit tests | Vitest |
| E2E tests | Playwright |
| Config storage | `$HOME/.config/log-swim-ui/config.json` |
| Stdin reading | Node.js `process.stdin` in Electron main process |
| IPC | Electron `ipcMain` / `ipcRenderer` |
| Distribution | npm global install |
| Package manager | npm |

## Open Questions
- None — all requirements confirmed.
