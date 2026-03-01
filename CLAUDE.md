# log-swim-ui -- Project Standards

## Project Overview

**log-swim-ui** is an Electron desktop app that provides swimlane visualization for JSON log streams. It reads line-delimited JSON from stdin, classifies entries into regex-based lanes, and renders them in a virtualized CSS grid layout with real-time streaming support.

### Technology Stack

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
| Distribution | npm global install |
| Package manager | npm |

---

## Core Principles

### 80/20 (Pareto)
Simple solution for 80% value beats complex solution for 100%. Flag low-ROI problems rather than over-engineering them.

### DRY (Don't Repeat Yourself)
Eliminate knowledge duplication. Most important in business rules. Less important in tests and boilerplate.

### SRP (Single Responsibility Principle)
One reason to change per class. One thing per method. Small focused functions. Creates hyper-obvious, clear-focused abstractions with clear documentation.

### OCP (Open/Closed Principle)
Open for extension, closed for modification. Achieved through composition (not inheritance). When adjusting the codebase, look for opportunities to extend WITHOUT modifying -- e.g. adding a new interface implementation instead of changing an existing one.

### KISS + Evolvable
Simple = good. Complex = bad. No over-engineering, no unused code. Use abstractions to hide complexity and keep things simple at each level. Keep the door open for evolution without over-engineering.

---

## SOLID Principles (TypeScript Focus)

### Single Responsibility
- Each module/class has one reason to change.
- Functions do one thing and are named accordingly.

### Open/Closed
- Extend behavior through new implementations, not modification.
- Use discriminated unions and pattern matching over modification of existing switch/if chains.

### Liskov Substitution
- Subtypes must be substitutable for their base types.
- In TypeScript: if a function accepts `ReadonlyArray<T>`, do not pass a mutable array and mutate it elsewhere.

### Interface Segregation
- Keep interfaces small and focused.
- Prefer multiple small interfaces over one large one.
- Clients should not depend on methods they do not use.

### Dependency Inversion
- Depend on abstractions (interfaces/types), not concretions.
- Use dependency injection via constructor parameters or React context.
- High-level modules should not import from low-level modules directly; both should depend on shared types.

---

## TypeScript Coding Standards

### Type Safety
- `strict: true` is non-negotiable. Both `tsconfig.node.json` and `tsconfig.web.json` enforce it.
- `noImplicitAny: true` -- never allow implicit `any`.
- Never use `any`. Use `unknown` when the type is genuinely unknown, then narrow with type guards.
- No type assertions (`as`) unless justified with a `// WHY:` comment explaining why it is safe.
- Prefer compile-time checks over runtime checks.

### Data Structures
- Use `interface` for object shapes (extensible, mergeable).
- Use `type` for unions, intersections, and computed types.
- Use descriptive `interface` names -- never `Pair`, `Triple`, or generic containers.
- No `enum` -- use `as const` objects or union literal types:
  ```typescript
  // GOOD
  const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const
  type LogLevel = typeof LOG_LEVELS[number]

  // BAD
  enum LogLevel { Trace, Debug, Info, Warn, Error, Fatal }
  ```

### Async
- Always handle errors in async paths.
- Prefer `async/await` over raw Promises.
- No fire-and-forget promises. Every promise must be awaited or explicitly handled.

### Error Handling
- Use `Result<T, E>` pattern or explicit error types over thrown exceptions for business logic.
- Thrown exceptions are for truly exceptional/unrecoverable cases only.
- Never swallow errors silently.

### General
- No magic numbers. Use named constants.
- Behavior MUST match naming. Never violate the Principle of Least Surprise.
- Disfavor non-private free-floating functions. Favor cohesive classes; for stateless utilities, use a static class.
- Prefer explicit code over hidden configurations.

---

## Testing Standards

### Vitest (Unit Tests)
- BDD style with GIVEN/WHEN/THEN structure.
- One assert per test (preferably).
- Explicit imports: `import { describe, it, expect } from 'vitest'` (no globals).
- Tests go in `tests/unit/` or colocated as `*.test.ts` in `src/`.
- `@core` path alias is available in tests.

```typescript
describe('GIVEN a log entry with level "error"', () => {
  describe('WHEN classified against lanes ["error", "auth"]', () => {
    it('THEN it matches lane index 0', () => {
      const result = classify(entry, lanes)
      expect(result.laneIndex).toBe(0)
    })
  })
})
```

### Playwright (E2E Tests)
- Tests go in `tests/e2e/`, helpers in `tests/e2e/helpers/`.
- Electron-specific: uses `_electron.launch()` with `E2E_TEST=1` env seam.
- Test data injected via IPC (`webContents.send`), not stdin piping.
- `npm run build` required before `npm run test:e2e`.
- Headless Linux: Chromium ozone flags + offscreen rendering (auto-configured by helpers).
- Install browsers explicitly with `npx playwright install` (not automated in postinstall).

### Testing Principles
- **Respect existing tests**: do NOT skip or remove behavior-capturing tests without explicit alignment from human engineer.
- Start bug fixes with a failing test, then implement the fix, then verify the test passes.
- Avoid manual alignment issues (e.g. client/server API contracts) -- always cover with automated tests.

---

## CSS Architecture

### File Organization
- `src/renderer/theme/tokens.css` -- All CSS custom properties (`:root`). Single source of truth for colors, spacing, typography, shadows, borders, layout, transitions.
- `src/renderer/theme/components.css` -- Structural component classes. Zero hardcoded color/spacing values; everything references tokens via `var()`.
- `src/renderer/theme/design-reference.css` -- Dev-only styles for the design reference page. Will be removed when real components replace the reference page.

### Custom Properties (Tokens)
- Use CSS custom properties for all visual values (colors, spacing, borders, fonts).
- Semantic tokens reference grey-scale tokens via `var()` (e.g., `--color-surface: var(--color-grey-800)`).
- Components reference tokens, never hardcoded values.

### Border Width
- Use `2px` borders over `1px` for visibility and accessibility.

### No Inline Styles
- Do not use inline `style` attributes in React components for production UI.
- Use CSS classes that reference custom property tokens.

### Runtime Config Override
- `applyConfigToCSS(config: AppConfig)` maps config values to CSS custom properties at runtime via `document.documentElement.style.setProperty()`. Called by `useAppInit` after loading config via `window.api.getConfig()`, and by `SettingsPanel` (debounced 150ms) for live preview. Derives level CSS variable names mechanically from `KNOWN_LOG_LEVELS` (single source of truth in `src/core/types.ts`).

### Inline Style Exception
- `SettingsPanel` color swatches use inline `style={{ backgroundColor }}` -- the only exception to the "no inline styles" rule. Dynamic color preview requires runtime-computed `background-color` that cannot be expressed as a CSS class.

---

## Composition over Inheritance

- No class inheritance for component behavior.
- Use composition, React hooks, and dependency injection.
- Favor small, focused functions composed together over deep class hierarchies.
- Use interfaces to define contracts, implementations to fulfill them.

---

## Structured Logging

- **No `console.log` in production code.** Use a structured logger (to be defined in later phases).
- `console.log` is acceptable in:
  - Tests
  - Dev scripts
  - `bin/log-swim-ui.js` (CJS entry point, spawns Electron)
- In production code, use structured logging with key-value pairs, not string interpolation.

---

## Project Structure

```
src/
  main/          # Electron main process (Node.js context)
                 # - index.ts: App startup orchestration (TTY check, CLI parse, config load, IPC handlers, RENDERER_READY handshake, bridge start, E2E test seam)
                 # - cli-parser.ts: CliParser (static) -- parse --key-level, --key-timestamp, --lanes
                 # - config-manager.ts: ConfigManager (static) -- load/validate/merge/save/reset config, ConfigValidator (static)
                 # - ipc-bridge.ts: IpcBridge -- stdin → JsonParser → TimestampDetector → IPC send pipeline
  preload/       # Preload scripts (bridge between main and renderer)
                 # - index.ts: contextBridge API -- whitelisted IPC channel exposure
                 # - electron-api.d.ts: TypeScript declaration for window.api
  renderer/      # React renderer process (browser context)
    src/         # React app, hooks, utilities
                 # - main.tsx: React entry point (renders App into DOM)
                 # - App.tsx: Top-level state machine (loading → error | ready), manages lane/filter/config/settings state, wires hooks to components
                 # - ErrorScreen.tsx: Full-screen error display with config revert action
                 # - DesignReferencePage.tsx: Dev-only design system reference (not rendered by App.tsx)
                 # - useAppInit.ts: Init hook -- load config, CLI args, create MasterList, apply CSS tokens
                 # - useLogIngestion.ts: IPC wiring + log state (version, stream state, unparseable, view mode); accepts lanesRef + configRef for stable IPC callbacks; signals RENDERER_READY after all listeners registered; auto-switches to Scroll mode on stream end
                 # - timestamp-formatter.ts: Format timestamps (iso, local, relative)
                 # - ipc-converters.ts: Convert IPC types (IpcLogLine) to renderer types (LogEntry)
                 # - log-row-utils.ts: Pure display utilities for LogRow (CSS class, message preview, grid column)
                 # - scroll-utils.ts: Pure scroll-up detection function
                 # - applyConfigToCSS.ts: Map AppConfig values to CSS custom properties at runtime
      components/  # React components
                 # - SwimLaneGrid.tsx: Virtualized CSS grid with @tanstack/react-virtual, auto-scroll, filtering, lane DnD reorder
                 # - LogRow.tsx: Single log row (collapsed/expanded), colored left border by level
                 # - LaneHeader.tsx: Lane column header (regex pattern with truncation, drag handle for reorder)
                 # - FilterBar.tsx: "Global Filter" bar (topmost row) with inline add form, include/exclude mode toggle, case sensitivity toggle, rightSlot for ModeToggle
                 # - FilterChip.tsx: Individual filter chip with mode indicator (+/-), case sensitivity indicator (Aa/aa), toggle/remove, exclude styling
                 # - LaneAddInput.tsx: Ad-hoc lane regex input (insert before unmatched)
                 # - ModeToggle.tsx: Pill-shaped Live/Scroll toggle
                 # - StreamEndIndicator.tsx: Subtle badge shown when stdin closes
                 # - SettingsPanel.tsx: Slide-out settings panel with Colors/UI/Performance sections, live CSS preview, save/reset
                 # - UnparseablePanel.tsx: Bottom panel for failed-timestamp entries
    theme/       # CSS design system
                 # - tokens.css: CSS custom properties (:root)
                 # - components.css: Structural component classes (zero hardcoded values)
                 # - design-reference.css: Dev-only styles for DesignReferencePage
    index.html   # HTML entry point
  core/          # Shared pure logic (no Electron or React imports)
                 # - types.ts: LogEntry, LaneDefinition, AppConfig, ParsedLine, IpcLogLine, IPC_CHANNELS (incl. RESET_CONFIG, RENDERER_READY), ElectronApi (incl. resetConfig, signalReady), CliArgsResult, KNOWN_LOG_LEVELS, ViewMode, AppErrorType, CONFIG_CONSTRAINTS, createLaneDefinition
                 # - config-validation.ts: Pure validation helpers for config fields (isValidHexColor, isInRange, HEX_COLOR_PATTERN)
                 # - filter.ts: FilterEngine (static) -- create/toggle/match filters, toggleMode(), toggleCaseSensitivity(); Filter discriminated union (FieldFilter | RawFilter) with FilterMode (include|exclude), FilterOptions (mode, caseSensitive), FILTER_MODES
                 # - json-parser.ts: JsonParser (static) -- raw string → ParsedLine
                 # - timestamp-detector.ts: TimestampDetector -- detect/lock format, parse timestamps
                 # - lane-classifier.ts: LaneClassifier (static) -- first-match-wins classification
                 # - master-list.ts: MasterList -- sorted collection with binary-search insert + eviction + setMaxEntries(n)
                 # - log-buffer.ts: LogBuffer -- timer-based flush with callback
                 # - stdin-reader.ts: StdinReader (static) -- line-by-line Readable stream reading (Node.js only)
tests/
  unit/          # Vitest unit tests
  e2e/           # Playwright E2E tests
                 # - app.spec.ts: 15 E2E test cases (lane headers, log rows, expand/collapse, filtering, lane add, mode toggle, stream-end mode switch, settings panel)
    helpers/     # E2E test utilities
                 # - electron-app.ts: launchApp, injectLogLines, sendStreamEnd, waitForFlush, createIpcLogLine
bin/             # CLI entry point (npm global install)
out/             # Build output (gitignored)
```

### What belongs where

| Directory | Can import from | Cannot import from |
|-----------|----------------|-------------------|
| `src/core/` | Standard lib only (Node.js APIs allowed but see note below) | `electron`, `react`, `src/main/`, `src/renderer/` |
| `src/main/` | `src/core/`, `electron`, Node.js APIs | `react`, `src/renderer/` |
| `src/preload/` | `electron` (contextBridge), `src/core/types.ts` (types and constants only) | `react`, `src/renderer/` |
| `src/renderer/` | `src/core/`, `react`, `react-dom` | `electron` (use preload bridge), `src/main/` |

**Note:** `src/core/stdin-reader.ts` imports `node:stream` and `node:readline` (Node.js-only APIs). It is excluded from `tsconfig.web.json` so it does not break browser-context compilation. It is used only in `src/main/` (Electron main process).

**Note:** `src/preload/` imports `IPC_CHANNELS` (constant) and `ElectronApi` (type) from `src/core/types.ts`. This is DRY -- avoids duplicating IPC channel name strings across process boundaries. Only types and compile-time constants are allowed; no runtime logic imports.

---

## Import Conventions

### Path Aliases
- `@renderer/*` maps to `src/renderer/src/*`
- `@core/*` maps to `src/core/*`

These aliases are configured in `tsconfig.web.json` (TypeScript), `electron.vite.config.ts` (Vite bundler), and `vitest.config.ts` (test runner).

### Import Style
- Use named imports over default imports where possible.
- Group imports: external packages first, then aliases, then relative imports.
- No circular imports.

---

## Build & Dev Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Launch Electron in dev mode with HMR |
| `npm run build` | Build all processes (main, preload, renderer) to `out/` |
| `npm run preview` | Preview the built app |
| `npm test` | Run Vitest unit tests |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run link:local` | Build + `npm link` for local testing (`log-swim-ui` available globally) |
