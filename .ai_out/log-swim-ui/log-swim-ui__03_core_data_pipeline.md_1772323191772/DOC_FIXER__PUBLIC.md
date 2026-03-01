# DOC_FIXER: Phase 03 Core Data Pipeline -- Documentation Updates Complete

## Documentation Updated

**CLAUDE.md:**
- Updated `src/core/` project structure to list all 7 implemented modules with one-line descriptions (was generic placeholders)
- Updated `src/core/` import rules to note Node.js API usage is allowed (for `stdin-reader.ts`)
- Added note explaining `stdin-reader.ts` is excluded from `tsconfig.web.json` due to `node:stream`/`node:readline` imports

**High-level spec (`doc/ralph/log-swim-ui/log-swim-ui-high-level.md`):**
- Updated Key Types & Interfaces table:
  - Fixed `LaneDefinition.regex` type from `RegExp` to `RegExp | null`
  - Added `ParsedLine`, `ParseResult<T>`, `TimestampFormat` types
- Added "Core Pipeline Classes (Phase 03)" sub-table with all 6 classes
- Added Phase 03 Callouts section with 3 items:
  1. `StdinReader` error listener deviation (rl vs raw input)
  2. `stdin-reader.ts` tsconfig.web.json exclude
  3. `DEFAULT_APP_CONFIG` color values differ from spec defaults

**Thorg Notes:**
- No thorg note references found in `src/core/` source files. No updates needed.

**No Updates Needed:**
- No anchor points in Phase 03 code
- No new path aliases or build commands introduced
- Testing standards unchanged (BDD/GIVEN-WHEN-THEN pattern followed as documented)
