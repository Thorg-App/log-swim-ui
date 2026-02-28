# Plan Review: Phase 01 - Project Scaffold & Build Config

## Executive Summary

The plan is thorough, well-researched, and demonstrates strong understanding of the electron-vite ecosystem. All package versions have been independently verified as real and current (as of 2026-02-28). There are **two issues** that need addressing: one blocker (missing `bin` field required by the task spec) and one code bug (missing `resolve` import in `vitest.config.ts`). Both are straightforward fixes that can be made inline -- **no plan iteration needed**.

## Critical Issues (BLOCKERS)

### 1. Missing `bin` field in `package.json`

- **Issue**: The task spec at `doc/ralph/log-swim-ui/tasks/todo/01_project_scaffold.md` line 48 explicitly requires: `Set "bin" field for npm global install: "log-swim-ui": "./dist/cli.js" (or appropriate entry)`. The high-level spec lists distribution as "npm global install". The plan's `package.json` definition in Phase A has NO `bin` field at all.
- **Impact**: Without a `bin` field, `npm install -g log-swim-ui` would install the package but not create a CLI command. This is a core distribution requirement.
- **Recommendation**: Add a `bin` field to the `package.json` definition. For an electron-vite project, the appropriate entry would be a thin shell script or Node.js wrapper that launches Electron. The exact path depends on the CLI entry point design (Phase 04), but a stub should be established now. Suggested approach:
  ```json
  "bin": {
    "log-swim-ui": "./bin/log-swim-ui.js"
  }
  ```
  With a placeholder `bin/log-swim-ui.js` that simply prints "not yet implemented" -- to be fleshed out in Phase 04 (Electron Shell & CLI). This keeps the scaffold aligned with the spec without implementing business logic.

  **Alternative (simpler)**: Just add the `bin` field pointing to a non-existent path with a TODO comment in the plan. The implementor creates a minimal stub. This is acceptable for a scaffold phase.

### 2. Missing `resolve` import in `vitest.config.ts` (Phase E)

- **Issue**: The `vitest.config.ts` code uses `resolve('src/core')` but does not import `resolve` from `path`. The `electron.vite.config.ts` correctly imports it, but the vitest config does not.
- **Impact**: TypeScript compilation error. `npm test` would fail.
- **Recommendation**: Add `import { resolve } from 'path'` to the vitest config, or use `import path from 'path'` and `path.resolve(...)`. The fix is:
  ```ts
  import { resolve } from 'path'
  import { defineConfig } from 'vitest/config'
  ```

## Major Concerns

None. The plan is architecturally sound.

## Minor Suggestions

### 1. Missing `@core` path alias in `tsconfig.node.json` and main process electron-vite config

- **Concern**: `tsconfig.node.json` includes `src/core/**/*` in its `include` but does not define `@core/*` path aliases. The `electron.vite.config.ts` also only defines `@core` alias for the renderer section. This means the main process would need to use relative imports for core code (e.g., `../../core/types` instead of `@core/types`).
- **Why**: Inconsistency between main and renderer import conventions.
- **Suggestion**: Add `paths` to `tsconfig.node.json` and `resolve.alias` to the main section of `electron.vite.config.ts`. However, this is **not blocking for Phase 01** since there is no core code yet. It can be addressed when Phase 03 (Core Data Pipeline) adds actual shared code. Flag it as a known gap.

### 2. `"type": "module"` decision is sound but should be documented

- **Note**: The plan correctly decides NOT to set `"type": "module"`. The task spec suggests setting it "if using ESM", and the plan's rationale (electron-vite handles ESM/CJS internally) is correct. With Electron 40, ESM would actually work, but CJS is safer and avoids complications with preload scripts. This decision is well-justified.

### 3. `@electron-toolkit/utils` import in main process

- **Note**: The plan mentions using `is.dev` from `@electron-toolkit/utils` in `src/main/index.ts` (Phase D, step 1). This is valid -- `is.dev` is exported as `{ is: { dev: boolean } }` from `@electron-toolkit/utils@4.0.0`. The alternative `process.env.NODE_ENV` check is also mentioned as a fallback, which is good defensive planning.

### 4. Consider adding `@core` alias resolution to `tsconfig.node.json`

- For consistency, when the implementor builds Phase D, the `tsconfig.node.json` should eventually get:
  ```json
  "paths": {
    "@core/*": ["src/core/*"]
  }
  ```
  And the `electron.vite.config.ts` main section should get:
  ```ts
  main: {
    resolve: {
      alias: {
        '@core': resolve('src/core')
      }
    }
  }
  ```
  This can be deferred to Phase 03.

## Simplification Opportunities (PARETO)

None. The plan is already appropriately minimal for a scaffold phase. The "What NOT to Do" section is excellent and prevents scope creep.

## Strengths

1. **Version research is impeccable**: Every single package version listed in the plan matches the actual latest version on npm as of today. This is rare and valuable.

2. **Deprecated API awareness**: The plan correctly identifies that `externalizeDepsPlugin` is deprecated in electron-vite 5.0 (verified: the type declaration has `@deprecated` JSDoc) and uses the new `build.externalizeDeps` default behavior instead.

3. **`noImplicitAny` override**: The plan correctly identifies that `@electron-toolkit/tsconfig@2.0.0` base config sets `noImplicitAny: false` despite having `strict: true`. The explicit override in both tsconfigs is essential and well-documented.

4. **Clear phase ordering with dependency graph**: The implementation order table with "Depends On" column is clear and actionable.

5. **"What NOT to Do" section**: Explicitly calling out anti-patterns (no `create-electron-vite`, no ESLint, no `"type": "module"`, no `externalizeDepsPlugin`) prevents the implementor from going off-track.

6. **Conservative, correct decisions**: Not setting `"type": "module"`, explicit vitest imports (no globals), and the careful tsconfig structure all demonstrate solid engineering judgment.

7. **Acceptance criteria verification table**: Maps each criterion to a concrete verification command.

## Verified Facts

| Claim in Plan | Verified? | Evidence |
|---------------|-----------|----------|
| `electron-vite@5.0.0` exists | YES | `npm view electron-vite versions` |
| `electron-vite` peer dep: `vite ^5.0.0 \|\| ^6.0.0 \|\| ^7.0.0` | YES | `npm view electron-vite peerDependencies` |
| `vite@7.3.1` is latest | YES | `npm view vite@latest version` |
| `electron@40.6.1` is latest | YES | `npm view electron@latest version` |
| `react@19.2.4` is latest | YES | `npm view react@latest version` |
| `typescript@5.9.3` is latest | YES | `npm view typescript@latest version` |
| `vitest@4.0.18` is latest | YES | `npm view vitest@latest version` |
| `@playwright/test@1.58.2` is latest | YES | `npm view @playwright/test@latest version` |
| `@vitejs/plugin-react@5.1.4` is latest | YES | `npm view @vitejs/plugin-react@latest version` |
| `@electron-toolkit/tsconfig@2.0.0` is latest | YES | `npm view` |
| `@electron-toolkit/preload@3.0.2` is latest | YES | `npm view` |
| `@electron-toolkit/utils@4.0.0` is latest | YES | `npm view` |
| Base tsconfig has `noImplicitAny: false` | YES | Extracted `package/tsconfig.json` from tarball |
| Base tsconfig has `strict: true` | YES | Extracted and verified |
| Base tsconfig has `jsx: "preserve"` | YES | Extracted and verified |
| `externalizeDepsPlugin` is deprecated | YES | `@deprecated` in `index.d.ts` |
| `is.dev` exists in `@electron-toolkit/utils` | YES | Verified `Is` interface in type declarations |
| `electron-vite/node` types exist | YES | `node.d.ts` in package, exported via `"./node"` |

## Inline Fixes (apply during implementation)

The following fixes should be applied by the implementor. They are small enough that **PLAN_ITERATION can be skipped**.

### Fix 1: Add `bin` field to `package.json` (Phase A)

Add to the `package.json` definition:
```json
"bin": {
  "log-swim-ui": "./bin/log-swim-ui.js"
}
```

Create a minimal `bin/log-swim-ui.js` stub:
```js
#!/usr/bin/env node
console.error('log-swim-ui: CLI not yet implemented. See Phase 04.')
process.exit(1)
```

Add `bin/` directory to the project structure. Add `bin/log-swim-ui.js` to the file creation list in Phase D.

### Fix 2: Add missing import to `vitest.config.ts` (Phase E)

Change:
```ts
import { defineConfig } from 'vitest/config'
```
To:
```ts
import { resolve } from 'path'
import { defineConfig } from 'vitest/config'
```

## Verdict

- [ ] APPROVED
- [x] APPROVED WITH MINOR REVISIONS
- [ ] NEEDS REVISION
- [ ] REJECTED

**Rationale**: The plan is excellent overall. Two concrete fixes are needed (missing `bin` field, missing import) but both are trivial and can be applied inline during implementation. No architectural or structural changes needed. The planner did thorough research and all package versions are verified correct.
