# Exploration: Phase 03 Core Data Pipeline

## Current State
- Phase 01 (scaffold) and Phase 02 (UI design) are complete
- `src/core/` exists but contains only `.gitkeep` — empty and ready
- Test infrastructure working: `vitest.config.ts` with `@core` alias, node environment, explicit imports

## Key Configuration
- **TypeScript**: `strict: true`, `noImplicitAny: true` in `tsconfig.node.json` (covers `src/core/**/*`)
- **Vitest**: `@core` alias → `src/core`, tests from `tests/unit/**/*.test.ts` and `src/**/*.test.ts`
- **No globals** in vitest — must `import { describe, it, expect } from 'vitest'`
- **No enum** per CLAUDE.md — use `as const` objects or union literal types

## Test Pattern (from sanity.test.ts)
```typescript
import { describe, it, expect } from 'vitest'
describe('sanity', () => {
  it('passes', () => { expect(1 + 1).toBe(2) })
})
```

## Modules to Create (all in src/core/)
1. `types.ts` — LogEntry, LaneDefinition, ParsedLine, TimestampParser, AppConfig, StdinMessage
2. `json-parser.ts` — Parse raw string as JSON, return success or failure
3. `timestamp-detector.ts` — Detect ISO8601 vs epoch millis on first line, lock format
4. `lane-classifier.ts` — First-match-wins regex classification
5. `master-list.ts` — Sorted array with binary-search insert and eviction
6. `log-buffer.ts` — Buffer with configurable flush interval
7. `stdin-reader.ts` — Line-by-line stdin reading (Node.js streams)

## Constraints
- Pure TypeScript only in `src/core/` — no Electron, no React imports
- No `any` — use `unknown` and narrow
- No `console.log` in production code
- BDD tests with GIVEN/WHEN/THEN
- One assert per test preferred
