# Phase 04: DRY/SRP Analysis and Fixes

## Status: COMPLETE

All fixes applied. 132 tests passing, typecheck clean.

---

## Files Analyzed

| File | Lines | Verdict |
|------|-------|---------|
| `src/main/cli-parser.ts` | 138 | DRY violation found and fixed |
| `src/main/config-manager.ts` | 339 | DRY violation found and fixed |
| `src/main/ipc-bridge.ts` | 137 | Clean |
| `src/main/index.ts` | 93 | Clean |
| `src/preload/index.ts` | 22 | Clean |
| `src/preload/electron-api.d.ts` | 7 | Clean |
| `src/core/types.ts` | 200 | Dead code found and removed |
| `src/core/stdin-reader.ts` | 55 | Clean |

---

## Fixes Applied

### FIX 1: Eliminated `CliArgs` / `CliArgsResult` knowledge duplication

**Type:** DRY violation
**Files:** `src/main/cli-parser.ts`, `src/core/types.ts`

**Problem:** Two structurally identical interfaces representing the same knowledge:

```typescript
// src/main/cli-parser.ts (REMOVED)
interface CliArgs {
  readonly keyLevel: string
  readonly keyTimestamp: string
  readonly lanePatterns: readonly string[]
}

// src/core/types.ts (KEPT)
interface CliArgsResult {
  readonly keyLevel: string
  readonly keyTimestamp: string
  readonly lanePatterns: readonly string[]
}
```

Both represent "the shape of parsed CLI arguments." If a new CLI flag is added (e.g. `--key-message`), both types would need to change together -- classic knowledge duplication.

**Fix:** Removed `CliArgs` from `cli-parser.ts`. `CliParser.parse()` now returns `CliArgsResult` (imported from `@core/types`). The `CliArgs` type export was removed since it had no external consumers.

**Change:**
- `src/main/cli-parser.ts`: Removed `interface CliArgs`, added `import type { CliArgsResult }`, changed return type of `parse()` to `CliArgsResult`, removed `export type { CliArgs }`.

---

### FIX 2: Extracted `validatePositiveNumber` in ConfigValidator

**Type:** DRY violation (knowledge duplication within a class)
**File:** `src/main/config-manager.ts`

**Problem:** The "positive number validation" knowledge was duplicated 4 times:

```typescript
// Before: 4 identical validation blocks
if ('rowHeight' in ui) {
  if (typeof ui['rowHeight'] !== 'number' || ui['rowHeight'] <= 0) {
    errors.push(`ui.rowHeight: expected positive number, got "${String(ui['rowHeight'])}"`)
  }
}
// ... same for fontSize, flushIntervalMs, maxLogEntries
```

All four encode the same rule: "if field exists, it must be a number greater than zero." If the rule changes (e.g. allow zero, or require integer), all four must change together.

**Fix:** Extracted `private static validatePositiveNumber(errors, obj, section, field)` method. Callers now read:

```typescript
ConfigValidator.validatePositiveNumber(errors, ui, 'ui', 'rowHeight')
ConfigValidator.validatePositiveNumber(errors, ui, 'ui', 'fontSize')
ConfigValidator.validatePositiveNumber(errors, perf, 'performance', 'flushIntervalMs')
ConfigValidator.validatePositiveNumber(errors, perf, 'performance', 'maxLogEntries')
```

---

### FIX 3: Removed dead `StdinMessage` types

**Type:** Dead code (unused artifacts)
**File:** `src/core/types.ts`

**Problem:** Three items were defined but never imported or referenced anywhere in `src/` or `tests/`:

```typescript
const STDIN_MESSAGE_TYPES = ['line', 'end', 'error'] as const
type StdinMessageType = (typeof STDIN_MESSAGE_TYPES)[number]
interface StdinMessage {
  readonly type: StdinMessageType
  readonly data?: string
}
```

These were specified in the task document as a design concept (`StdinMessage` objects sent via IPC). The implementation chose individual IPC channels instead (`IPC_CHANNELS.LOG_LINE`, `STREAM_END`, `STREAM_ERROR`), which is a cleaner approach. The `StdinMessage` types were dead weight.

**Fix:** Removed `StdinMessage`, `StdinMessageType`, and `STDIN_MESSAGE_TYPES` from `types.ts` (both definition and exports).

---

### FIX 4: Updated CLAUDE.md types reference

**Type:** Documentation drift
**File:** `CLAUDE.md`

**Problem:** Line 208 listed `StdinMessage` as a type in `src/core/types.ts` but it no longer exists. Also missing the Phase 04 types.

**Fix:** Updated to: `LogEntry, LaneDefinition, AppConfig, ParsedLine, IpcLogLine, IPC_CHANNELS, ElectronApi, CliArgsResult`

---

## Issues Analyzed but NOT Fixed (deliberate decisions)

### ConfigValidator vs merge functions: duplicated validation knowledge

**Type:** DRY tension
**Files:** `src/main/config-manager.ts` (both `ConfigValidator` and merge functions)

**Observation:** The knowledge of "what makes a valid hex color" and "what makes a valid positive number" is encoded in two places:

1. **ConfigValidator** -- for reporting errors to the user
2. **Merge functions** (`mergeHexColor`, `mergeUI`, `mergePerformance`) -- for deciding whether to accept loaded values vs fall back to defaults

Both use `HEX_COLOR_PATTERN.test()`, `typeof === 'number' && > 0`, etc. If a validation rule changes, both must be updated.

**Why NOT fixed:** The architecture runs validation first and rejects invalid configs before merge. The merge functions' type checks are defensive fallbacks for an unreachable path (valid config guaranteed by prior validation). Extracting shared predicates would add a layer of indirection (`isPositiveNumber()`, `isHexColor()` predicate functions passed to both validator and merger) for a config schema with ~15 fields that changes very rarely. The 80/20 calculus says the complexity cost exceeds the duplication risk here.

**Recommendation:** If the config schema grows significantly (20+ fields or multiple config file formats), revisit this and extract shared validation predicates.

### `e instanceof Error ? e.message : 'Unknown...'` pattern

**Type:** Boilerplate repetition (NOT knowledge duplication)
**Files:** `config-manager.ts` (2x), `ipc-bridge.ts` (1x)

3 occurrences, each with different fallback messages ("Unknown read error", "Unknown parse error", "Unknown error"). These are different error contexts that happen to use the same TypeScript pattern for extracting messages from `unknown` catch parameters. They change independently (different error contexts, different fallback messages). Not worth DRYing.

---

## SRP Analysis

All files pass the SRP test. Each module has a single axis of change:

| Module | Axis of Change |
|--------|---------------|
| `cli-parser.ts` | CLI argument format (flags, validation rules) |
| `config-manager.ts` | Config schema (fields, validation rules, merge logic) |
| `ipc-bridge.ts` | Stdin-to-renderer data pipeline wiring |
| `index.ts` | App startup orchestration sequence |
| `preload/index.ts` | IPC channel exposure (preload security boundary) |
| `electron-api.d.ts` | TypeScript declaration for `window.api` |
| `types.ts` | Shared type contracts |
| `stdin-reader.ts` | Line-by-line stream reading |

No mixed responsibilities or scattered responsibilities detected.

**Note on `config-manager.ts`:** This file contains `ConfigValidator`, merge functions, and `ConfigManager` in one module. All three change for the same reason: the config schema changes. This is cohesion, not a mixed responsibility. The Pareto analysis correctly identified this as pragmatic.

---

## Verification

```
Test Files  10 passed (10)
     Tests  132 passed (132)
TypeScript  clean (both tsconfig.node.json and tsconfig.web.json)
```
