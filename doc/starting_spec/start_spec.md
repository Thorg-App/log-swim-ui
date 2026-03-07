# log-swim-ui — Full Technical Specification

## 1. Overview

`log-swim-ui` is an Electron-based desktop application for macOS and Linux that reads a stream of JSON-formatted log lines from stdin and visualizes them in a swimlane UI. Pre-filtering is expected to happen upstream via shell tools (e.g. `rg`, `jq`, `grep`). The tool's responsibility is purely **classification and visualization**.

---

## 2. Platform Support

- **macOS** and **Linux** only
- No Windows support (stdin piping reliability on Windows is not guaranteed and robustness will not be sacrificed)

---

## 3. CLI Interface

### Invocation

```bash
cat logs.json | log-swim-ui --regexes_for_filter_columns "errors::error|ERROR|fatal" "auth" "timeout::timed?\s*out"
```

```bash
kubectl logs my-pod | log-swim-ui \
  --input_key.level level \
  --input_key.timestamp timestamp \
  --regexes_for_filter_columns "errors::error|ERROR|fatal" "auth"
```

### Arguments

| Argument | Required | Default | Description |
|---|---|---|---|
| `--regexes_for_filter_columns` | Yes | — | One or more lane definitions (see format below). All values after `--regexes_for_filter_columns` until next flag are consumed as lane args |
| `--input_key.level` | No | `level` | JSON field name to read log level from |
| `--input_key.timestamp` | No | `timestamp` | JSON field name to read timestamp from |

### Lane Definition Format

Each lane arg is a string in the format:

```
NAME::REGEX
```

or just:

```
NAME
```

- Split on the **first `::` only** — regex may contain `:` freely
- If only `NAME` provided, regex is set equal to `NAME`
- Regex is matched **case sensitively** unless the regex itself uses flags
- Lanes are evaluated **left to right**, first match wins
- A final implicit lane named **"unmatched"** always exists and captures all non-matching lines

### Examples

```bash
--regexes_for_filter_columns "errors::error|ERROR|fatal" "auth" "db::postgres|mysql|query"
```

- Lane `errors` → regex `error|ERROR|fatal`
- Lane `auth` → regex `auth`
- Lane `db` → regex `postgres|mysql|query`
- Lane `unmatched` → everything else

---

## 4. Stdin Handling

- App MUST be invoked with a piped stdin
- On launch, check if `process.stdin.isTTY` — if `true` (no pipe), THROW immediately:
  ```
  Error: log-swim-ui requires piped input. No stdin pipe detected.

  Usage:
    cat logs.json | log-swim-ui --regexes_for_filter_columns "name::regex" [--input_key.level field] [--input_key.timestamp field]

  Example:
    kubectl logs my-pod | log-swim-ui --regexes_for_filter_columns "errors::error|fatal" "auth"
  ```
- Error printed to **stderr** and shown in **UI error state** if the window has opened
- App exits with code 1

---

## 5. Timestamp Parsing

### Detection Strategy

Timestamp format is detected from the **first valid JSON line** received. The detected parser is locked in for the entire session — no per-line format detection.

**Detection order:**

1. **ISO8601** — attempt to parse the value as an ISO8601 string (e.g. `2024-01-15T10:30:00Z`, `2024-01-15T10:30:00.123+05:00`). If `Date.parse()` succeeds and returns a valid date, use this parser.

2. **Milliseconds since epoch** — if the value is a number (or numeric string), attempt to interpret as ms since epoch. The resulting date MUST satisfy:
    - `> 1970-01-01T00:00:00Z`
    - `< 2100-01-01T00:00:00Z`
    - If outside this range → THROW

### Failure Behavior

If neither format parses successfully → THROW with message:

```
Error: Could not parse timestamp field "timestamp" from first log line.
Value was: "some-weird-value"
Expected: ISO8601 string (e.g. "2024-01-15T10:30:00Z") or milliseconds since epoch (number, range 1970–2100)
```

- Error printed to **stderr**
- Error shown in **UI error state** with the full message
- App halts ingestion

### Consistency Assumption

Timestamp format is expected to be **consistent across all log lines**. The app does not attempt to re-detect or fallback per-line. If a later line fails to parse with the locked-in parser, the line is marked with a parse warning but ingestion continues.

---

## 6. Log Level Colorization

Read from the field specified by `--input_key.level` (default: `level`). Matching is **case insensitive**.

| Level value(s) | Left border color | Hex |
|---|---|---|
| `trace` | gray | `#6B7280` |
| `debug` | slate | `#94A3B8` |
| `info` | blue | `#3B82F6` |
| `notice` | cyan | `#06B6D4` |
| `warn`, `warning` | amber | `#F59E0B` |
| `error` | red | `#EF4444` |
| `fatal`, `critical` | deep red | `#991B1B` |
| unrecognized / missing | default (no color) | `#FFFFFF` |

Color is applied as a **colored left border** on each log row entry.

Level colors are defined in `config.json` and can be overridden by the user.

---

## 7. Configuration File

### Location

```
$HOME/.config/log-swim-ui/config.json
```

Resolved using `app.getPath('userData')` via Electron (maps correctly on macOS and Linux).

### Lifecycle

- On launch: check if file exists
    - **Missing** → create directory structure + write defaults → continue normally
    - **Present and valid** → load and apply
    - **Present but invalid** (malformed JSON, missing required keys, wrong value types) → show UI error state (see section 8.2), do not proceed with corrupted config

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
    "unrecognizedLevel": "#FFFFFF",
    "swimlaneHeaders":   "#1E293B",
    "background":        "#0F172A",
    "rowHover":          "#1E293B",
    "expandedRow":       "#334155"
  },
  "ui": {
    "rowHeight":       32,
    "fontFamily":      "monospace",
    "fontSize":        12,
    "timestampFormat": "relative"
  },
  "performance": {
    "flushIntervalMs": 200
  }
}
```

### Config Fields

| Field | Type | Description |
|---|---|---|
| `colors.levels.*` | string (hex) | Per log-level left border color |
| `colors.unrecognizedLevel` | string (hex) | Color for unknown log levels |
| `colors.swimlaneHeaders` | string (hex) | Background color of lane header bar |
| `colors.background` | string (hex) | App background color |
| `colors.rowHover` | string (hex) | Row background on hover |
| `colors.expandedRow` | string (hex) | Row background when expanded |
| `ui.rowHeight` | number (px) | Height of each log row |
| `ui.fontFamily` | string | Font family for log content |
| `ui.fontSize` | number (px) | Font size for log content |
| `ui.timestampFormat` | `"relative"` \| `"iso"` \| `"local"` | How timestamps are displayed |
| `performance.flushIntervalMs` | number (ms) | Buffer flush interval for stdin batching |

---

## 8. Data Pipeline

### 8.1 Ingestion & Buffering

```
stdin
  → read line by line
  → parse JSON (skip malformed lines with a warning marker)
  → push into in-memory buffer[]
  → every flushIntervalMs (default 200ms):
      → binary-search insert buffer contents into sorted master list (by timestamp)
      → clear buffer
      → trigger re-render
  → on stdin close:
      → immediate final flush of remaining buffer
      → mark stream as ended
```

### 8.2 Master List

- Single array of all parsed log entries, sorted ascending by timestamp
- Each entry assigned a **global row index** based on position in sorted list
- Insertions use binary search to find correct position — O(log n)
- On re-index after insert, React state updated to trigger virtualized re-render

### 8.3 Lane Classification

Each log entry is tested against lane regexes **in order** at classification time:

```
for each lane (left to right):
  if regex.test(rawJsonString):
    assign to this lane
    break
assign to "unmatched" if no match
```

Classification is done once per log entry at insert time and stored on the entry object.

---

## 9. UI Architecture

### 9.1 Layout

```
┌─────────────────────────────────────────────────────────────┐
│  [Filter bar — global across all lanes]                      │
├──────────┬──────────┬──────────┬──────────┬─────────────────┤
│  errors  │   auth   │  timeout │    db    │    unmatched    │
├──────────┼──────────┼──────────┼──────────┼─────────────────┤
│          │          │          │          │                  │
│  [row 0] │          │          │          │                  │
│          │  [row 1] │          │          │                  │
│          │  [row 2] │          │          │                  │
│  [row 3] │          │          │          │                  │
│          │          │  [row 4] │          │                  │
│          │          │          │          │  [row 5]         │
│          │          │          │          │                  │
└──────────┴──────────┴──────────┴──────────┴─────────────────┘
```

- Single scroll container — all lanes scroll together
- Rows are shared across all lanes (one virtualizer, not one per lane)
- Each row renders across all lane columns; only the matched lane column shows content for that row, others are empty
- Lane columns are equal width by default (CSS grid: `repeat(N, 1fr)`)

### 9.2 Virtualization

- Implemented with `@tanstack/virtual`
- Single virtualizer instance over the master sorted list
- Only visible rows rendered as DOM nodes (~50–100 at a time)
- Row height driven by `config.ui.rowHeight`

### 9.3 Log Row

Each visible log row contains:

- **Left border** — colored by log level (from `--input_key.level` field)
- **Timestamp** — formatted per `config.ui.timestampFormat`
- **Message preview** — truncated to fit row height, from `message` field if present, else raw JSON
- **Click to expand** — expands row inline to show full pretty-printed JSON

### 9.4 Global Filter Bar

Sits at the top of the UI above all swimlanes. Multiple filter conditions can be stacked (AND logic):

- Each filter is one of:
    - **Field filter** — select a known field name + enter value or regex
    - **Raw filter** — regex matched against full raw JSON string
- Filters can be added, removed, and toggled on/off
- All active filters must match for a row to be visible
- Filtering operates on the master list — affects all lanes simultaneously

### 9.5 Ad-hoc Lane Addition

From within the UI, the user can add new lanes:

- Input: `NAME::REGEX` or `NAME` (same format as CLI)
- New lanes inserted **before** the `unmatched` lane
- Left-to-right priority still applies — new lanes appended after existing user-defined lanes
- Ad-hoc lanes persist only for the session (not saved to config)

---

## 10. Theming & CSS Architecture

All visual styling is decoupled from logic components:

```
src/
  theme/
    tokens.css        # CSS custom properties (variables) for all visual values
    components.css    # Structural styles referencing only CSS variables
  components/         # React components — reference CSS variables only, no hardcoded colors or sizes
```

At runtime, config values are injected as CSS variables on the root element:

```javascript
document.documentElement.style.setProperty('--color-level-error', config.colors.levels.error);
document.documentElement.style.setProperty('--row-height', config.ui.rowHeight + 'px');
// etc.
```

All component styles reference variables:

```css
.log-row {
  height: var(--row-height);
  font-family: var(--font-family);
  border-left: 3px solid var(--level-color, var(--color-unrecognized-level));
}
```

This means:
- Swapping visual theme = replacing `tokens.css` only
- Config changes propagate to UI without touching component code
- Logic and presentation are fully separated

---

## 11. Error States

| Condition | CLI behavior | UI behavior |
|---|---|---|
| No stdin pipe | Print help + exit 1 | Show error if window open |
| Invalid config.json | Print warning to stderr | Full-screen error state with "Revert to default" CTA button that overwrites config with defaults and reloads |
| Timestamp parse failure (first line) | Print error to stderr + exit 1 | Show error state with field name and value that failed |
| Timestamp out of range (epoch ms) | Print error to stderr + exit 1 | Show error state with value and expected range |
| Malformed JSON line (not first line) | — | Row shown with warning marker, raw string displayed |

---

## 12. Technology Stack

| Concern | Choice |
|---|---|
| App shell | Electron |
| UI framework | React |
| Virtualization | `@tanstack/virtual` |
| Swimlane layout | CSS grid |
| Styling architecture | CSS custom properties (tokens) |
| Config storage | `app.getPath('userData')` / `$HOME/.config/log-swim-ui/` |
| Stdin reading | Node.js `process.stdin` in Electron main process |
| IPC | Electron `ipcMain` / `ipcRenderer` |

---

## 13. Out of Scope (v1)

- Windows support
- Persistent ad-hoc lane definitions across sessions
- Log export
- Multiple simultaneous stdin streams
- Network/file-based log sources (stdin only)
- Authentication or access control
- Plugin system