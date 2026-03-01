# Phase 05: UI — Swimlane Layout, Rows & Modes

## Objective
Build the core renderer UI: CSS grid swimlane layout with virtualized scrolling, log row rendering with level colorization and expand/collapse, lane headers with truncated regex and tooltip, Live/Scroll mode toggle, stream-ended indicator, and the conditional unparseable timestamp bottom panel.

## Prerequisites
- Phase 01 complete (project scaffold)
- Phase 02 complete (design system, CSS tokens)
- Phase 03 complete (core types, MasterList, LaneClassifier, LogBuffer)
- Phase 04 complete (Electron shell, IPC bridge, preload API)

## Scope
### In Scope
- **App shell** (`src/renderer/App.tsx`):
  - Receives log data via preload IPC API
  - Manages application state (master list, lanes, mode, stream status)
  - Integrates LogBuffer for buffered ingestion
  - Applies CSS variables from config at runtime on `:root`
- **Swimlane grid** (`src/renderer/components/SwimLaneGrid.tsx`):
  - CSS Grid layout: `repeat(N, 1fr)` where N = number of lanes
  - Single scroll container — all lanes scroll together
  - Integrates `@tanstack/virtual` for virtualization
  - Single virtualizer instance over the master sorted list
  - Only visible rows rendered (~50-100 at a time)
- **Lane header** (`src/renderer/components/LaneHeader.tsx`):
  - Displays regex pattern, truncated with `text-overflow: ellipsis`
  - Tooltip shows full regex on hover
  - Error state for invalid regex lanes (distinct visual treatment)
  - "unmatched" lane always last
- **Log row** (`src/renderer/components/LogRow.tsx`):
  - Left border colored by log level (from config colors)
  - Orange (`#F97316`) for unrecognized levels
  - Timestamp display formatted per `viewTimestampFormat` (iso, local, relative)
  - "relative" = time offset from first log entry (e.g., "+0:05.230")
  - Message preview: truncated `message` field if present, else truncated raw JSON
  - Click to expand: shows full pretty-printed JSON with expanded row background color
  - Row only renders content in its assigned lane column; other columns are empty
- **Mode toggle** (`src/renderer/components/ModeToggle.tsx`):
  - Pill-shaped toggle switch (not a radio button)
  - Two states: Live and Scroll
  - Live mode: auto-scroll to bottom on new entries
  - Scroll mode: position frozen
  - Scrolling up auto-switches from Live → Scroll
  - Clicking toggle switches back to Live and scrolls to bottom
  - Mode indicator always visible
- **Stream-ended indicator** (`src/renderer/components/StreamEndIndicator.tsx`):
  - Shown when stdin closes
  - Subtle, non-intrusive visual cue (e.g., banner or badge)
  - App remains fully interactive after stream ends
- **Unparseable timestamp panel** (`src/renderer/components/UnparseablePanel.tsx`):
  - Fixed position at bottom of screen (not in scroll flow)
  - Only visible when there are unparseable timestamp entries
  - Hidden when count is zero
  - Shows the raw JSON lines that failed timestamp parsing
  - Scrollable within the panel if many entries
  - Count badge showing number of unparseable entries
- **Error state views**:
  - Full-screen error for: no stdin pipe, first-line parse failure, timestamp detection failure
  - Config error: full-screen with "Revert to defaults" button (triggers config reset via IPC)
- Apply design tokens from Phase 02 throughout

### Out of Scope
- Filter bar (Phase 06)
- Ad-hoc lane addition (Phase 06)
- Drag-to-reorder lanes (Phase 06)
- Settings panel (Phase 07)

## Implementation Guidance

### State Management
Keep it simple — React state + context. No external state management library needed for v1.

```typescript
// Key state in App.tsx
const [masterList] = useState(() => new MasterList(config.performance.maxLogEntries));
const [lanes, setLanes] = useState<LaneDefinition[]>(initialLanes);
const [mode, setMode] = useState<'live' | 'scroll'>('live');
const [streamEnded, setStreamEnded] = useState(false);
const [unparseableEntries, setUnparseableEntries] = useState<string[]>([]);
```

### Virtualization
```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

const virtualizer = useVirtualizer({
  count: masterList.length,
  getScrollElement: () => scrollRef.current,
  estimateSize: () => config.ui.rowHeight,
});
```

### Live Mode Auto-scroll
```typescript
// After flush, if mode === 'live':
scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });

// On scroll event:
if (isScrollingUp) setMode('scroll');
```

### Relative Timestamp
```typescript
function formatRelativeTimestamp(timestamp: Date, firstTimestamp: Date): string {
  const diffMs = timestamp.getTime() - firstTimestamp.getTime();
  // Format as "+H:MM:SS.mmm" or "+MM:SS.mmm" for < 1 hour
}
```

### CSS Grid for Lanes
```css
.swimlane-grid {
  display: grid;
  grid-template-columns: repeat(var(--lane-count), 1fr);
}
```

## Acceptance Criteria
- [ ] Swimlane grid renders with correct number of columns based on lane definitions
- [ ] Log rows appear in the correct lane column (other columns empty for that row)
- [ ] Log row left border colored by log level (all standard levels + orange for unrecognized)
- [ ] Timestamp displayed in configured format (iso, local, relative)
- [ ] Click on row expands to show full pretty-printed JSON
- [ ] Click again collapses the expanded row
- [ ] Virtualization works: only ~50-100 DOM nodes regardless of total entry count
- [ ] Live mode auto-scrolls to latest entry
- [ ] Scrolling up switches to Scroll mode automatically
- [ ] Mode toggle switches between Live and Scroll
- [ ] Stream-ended indicator appears when stdin closes
- [ ] Unparseable timestamp panel appears only when there are unparseable entries
- [ ] Unparseable panel hidden when no errors
- [ ] Error states display correctly (no stdin, bad first line, bad timestamp, bad config)
- [ ] "Revert to defaults" button on config error resets config and reloads
- [ ] Lane headers show truncated regex with tooltip
- [ ] Invalid regex lanes show error state
- [ ] All design tokens from Phase 02 applied
- [ ] Tests pass

## Notes
- This is the largest UI phase. Focus on getting the core rendering loop right: IPC → buffer → flush → master list → virtualized render.
- The mode toggle auto-switch on scroll-up needs debouncing to avoid flickering during momentum scroll.
- Use Playwright MCP screenshots to verify visual correctness of the swimlane layout.
