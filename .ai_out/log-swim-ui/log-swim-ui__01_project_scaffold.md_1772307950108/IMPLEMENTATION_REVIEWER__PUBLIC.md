# Implementation Review: Phase 01 - Project Scaffold & Build Config

## Summary

The scaffold implementation is well-structured and faithfully follows the plan. All 21 files were created, both plan reviewer fixes were applied, `npm run build` produces correct output, and `npm test` passes. However, the review uncovered **two blockers**: the typecheck script is a no-op (checks zero files), and the `App.tsx` has a TypeScript error (`JSX.Element` namespace not found) that was masked by the broken typecheck. These are straightforward to fix.

## Verification Results

| Check | Result | Notes |
|-------|--------|-------|
| `npm install` | PASS | Clean install, no errors |
| `npm run build` | PASS | Produces `out/main/index.js`, `out/preload/index.js`, `out/renderer/index.html` |
| `npm test` | PASS | 1 test (sanity), exits 0 |
| `npm run typecheck` | **FALSE PASS** | Exits 0 but compiles ZERO files (see BLOCKER 1) |
| `tsc --build --noEmit` | **FAIL** | `App.tsx(1,17): error TS2503: Cannot find namespace 'JSX'` (see BLOCKER 2) |
| Build output exists | PASS | All three process outputs present |
| Directory structure | PASS | `src/main/`, `src/preload/`, `src/renderer/`, `src/core/`, `tests/unit/`, `tests/e2e/` |
| `.mcp.json` content | PASS | Matches spec exactly |
| `CLAUDE.md` content | PASS | All required sections present |
| `.npmignore` content | PASS | Appropriate exclusions |
| `.gitignore` content | PASS | Appropriate exclusions |
| `bin/log-swim-ui.js` executable | PASS | Has shebang, exits with code 1, is chmod +x |
| Plan reviewer fix 1 (bin field) | PASS | `"bin": { "log-swim-ui": "./bin/log-swim-ui.js" }` in package.json |
| Plan reviewer fix 2 (resolve import) | PASS | `import { resolve } from 'path'` in vitest.config.ts |

---

## BLOCKER Issues (must fix)

### BLOCKER 1: `npm run typecheck` is a no-op -- checks zero files

**File**: `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/package.json` (line 16)

**Problem**: The `typecheck` script runs `tsc --noEmit`. The root `tsconfig.json` has `"files": []` and no `include`, with only `references`. Without the `--build` flag, `tsc` compiles zero files and exits 0 regardless of any TypeScript errors in the project.

**Evidence**:
```bash
$ npx tsc --noEmit --listFiles
# (no output -- zero files compiled)
```

**Fix**: Change the `typecheck` script to use `--build`:
```json
"typecheck": "tsc --build --noEmit"
```

This tells `tsc` to follow the project references and compile both `tsconfig.node.json` and `tsconfig.web.json`.

**Impact**: Without this fix, the typecheck acceptance criterion ("TypeScript strict mode is enabled and compiles cleanly") is falsely passing. Type errors will go undetected during development.

---

### BLOCKER 2: `App.tsx` uses `JSX.Element` which is not in scope

**File**: `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/renderer/src/App.tsx` (line 1)

**Problem**: `function App(): JSX.Element` references the global `JSX` namespace, but with React 19 types and `"jsx": "react-jsx"`, the `JSX` namespace is not globally available without an explicit import. When properly type-checked (via `tsc --build --noEmit`), this produces:

```
src/renderer/src/App.tsx(1,17): error TS2503: Cannot find namespace 'JSX'.
```

**Fix** (choose one):

Option A -- Remove explicit return type (simplest, idiomatic React):
```tsx
function App() {
  return (
    <div style={{ backgroundColor: '#0F172A', color: '#E2E8F0', minHeight: '100vh', padding: '2rem' }}>
      <h1>Hello, log-swim-ui</h1>
    </div>
  )
}

export default App
```

Option B -- Import JSX from React:
```tsx
import type { JSX } from 'react'

function App(): JSX.Element {
  // ...
}
```

Option A is recommended because this is a scaffold stub that will be replaced in Phase 02, and removing the annotation is simpler.

**Note**: This error was masked by BLOCKER 1 (the typecheck was a no-op). Fixing BLOCKER 1 first will surface this error, which can then be fixed.

---

## MAJOR Issues (should fix)

None.

---

## MINOR Issues (nice to have)

### MINOR 1: `npm run test:e2e` exits with code 1

**Observed**: `npx playwright test` exits with code 1 and prints `Error: No tests found` when there are no test files in `tests/e2e/`. The plan expected it to exit 0 with "0 tests".

**Impact**: Low. This is Playwright's default behavior and cannot be changed without creating a dummy test. It's acceptable for a scaffold phase since the E2E framework is correctly configured and will work once actual test files are added.

**Suggestion**: No action needed. Could optionally add a `// TODO: first e2e test` comment in `tests/e2e/.gitkeep`, but this is cosmetic.

### MINOR 2: CLAUDE.md documents `@core` alias for `tsconfig.node.json` but it's not configured

**File**: `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/CLAUDE.md` (Import Conventions section, line 230-233)

**Observed**: CLAUDE.md says "@core/* maps to src/core/*" and these aliases are "configured in both tsconfig.web.json (TypeScript) and electron.vite.config.ts (Vite bundler)". This is accurate for the renderer process. However, the main process (`tsconfig.node.json`) does not have the `@core` path alias configured, meaning main process code must use relative imports for core modules.

**Impact**: Low. The implementor noted this as a "Known Gap" in their public notes. It should be addressed in Phase 03 when actual shared code is added. The CLAUDE.md documentation is not incorrect per se (it just doesn't mention the main process gap).

### MINOR 3: `sandbox: false` in BrowserWindow webPreferences

**File**: `/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/src/main/index.ts` (line 11)

**Observed**: The preload script has `sandbox: false`. This is a common electron-vite pattern needed for preload scripts to have full Node.js API access, which is required for `contextBridge` usage with `@electron-toolkit/preload`. This is acceptable for the scaffold but should be revisited in Phase 04 when the actual IPC bridge is implemented -- consider whether the preload can run sandboxed.

---

## Alignment Check

### Plan alignment: GOOD
The implementation follows all 10 phases (A through J) from the plan. File structure, dependency versions, configuration decisions, and code patterns all match the plan.

### High-level spec alignment: GOOD
Technology choices (Electron, React, TypeScript strict, Vitest, Playwright, npm) all match the high-level spec.

### Task spec alignment: GOOD (with blockers fixed)
All acceptance criteria will be genuinely met once the two blockers are fixed:
- [x] `npm install` succeeds
- [ ] `npm run typecheck` actually checks files (BLOCKER 1)
- [ ] TypeScript compiles cleanly when properly checked (BLOCKER 2)
- [x] `npm run build` produces output
- [x] `npm test` runs Vitest (1 test passes)
- [x] Playwright configured
- [x] `.mcp.json` matches spec
- [x] `CLAUDE.md` has all required sections
- [x] `.npmignore` exists
- [x] Directory structure correct
- [x] `bin` field in package.json

---

## Verdict

- [ ] APPROVED
- [x] APPROVED WITH REQUIRED FIXES (2 blockers)
- [ ] NEEDS MAJOR REVISION
- [ ] REJECTED

**Rationale**: The implementation is solid and well-executed. The two blockers are straightforward 1-line fixes (change `tsc --noEmit` to `tsc --build --noEmit`, and remove the `JSX.Element` return type from `App.tsx`). Once these are applied and `npm run typecheck` passes cleanly, the scaffold is ready for Phase 02.
