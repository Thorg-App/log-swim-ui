# Planner Output: Phase 01 - Project Scaffold & Build Config

## Summary

Plan is complete and written to `PLAN.md` in this directory. The plan covers 10 implementation phases (A through J) to scaffold the greenfield Electron app with electron-vite, React, TypeScript strict mode, Vitest, Playwright, and all required configuration files.

## Key Decisions Made

1. **Vite 7.x** (not 5 or 6) -- electron-vite 5.0 supports `^7.0.0` as a peer dependency, and 7.3.1 is the current latest.

2. **No `"type": "module"` in package.json** -- electron-vite handles ESM/CJS internally. Adding it would break the main process CJS output.

3. **No deprecated `externalizeDepsPlugin`** -- electron-vite 5.0 enables `build.externalizeDeps` by default. The plugin is deprecated.

4. **Override `noImplicitAny: true`** -- The `@electron-toolkit/tsconfig` base sets `noImplicitAny: false`, which contradicts strict mode. Both tsconfig files explicitly override this.

5. **JSX mode `react-jsx`** -- The base tsconfig uses `jsx: "preserve"` which is for Vue. React 19 requires `"react-jsx"`.

6. **`globals: false` in Vitest** -- Explicit imports over magic globals. Aligns with the project's "explicit over magic" principle.

7. **Sanity test included** -- A trivial `sanity.test.ts` confirms the test runner works, avoiding the ambiguity of "0 tests passed = is it working or broken?"

8. **React 19** -- Current stable, well-supported by all tooling in the stack.

## Files to Create (20 files)

| File | Purpose |
|------|---------|
| `package.json` | Project metadata, dependencies, scripts |
| `tsconfig.json` | Project references root |
| `tsconfig.node.json` | TypeScript config for main + preload + core |
| `tsconfig.web.json` | TypeScript config for renderer + core |
| `electron.vite.config.ts` | Build config for all 3 Electron processes |
| `vitest.config.ts` | Unit test runner config |
| `playwright.config.ts` | E2E test runner config |
| `.mcp.json` | Playwright MCP server config |
| `.gitignore` | Git exclusions |
| `.npmignore` | npm publish exclusions |
| `CLAUDE.md` | Project-level coding standards |
| `src/main/index.ts` | Electron main process entry |
| `src/preload/index.ts` | Preload script stub |
| `src/renderer/index.html` | HTML entry for renderer |
| `src/renderer/src/main.tsx` | React entry point |
| `src/renderer/src/App.tsx` | Hello world component |
| `src/core/.gitkeep` | Core logic directory placeholder |
| `tests/unit/.gitkeep` | Unit test directory placeholder |
| `tests/unit/sanity.test.ts` | Trivial sanity test |
| `tests/e2e/.gitkeep` | E2E test directory placeholder |

## Risks Identified

1. **Low risk**: electron-vite 5.0 + Vite 7.x compatibility (fallback: use Vite 6.x)
2. **Medium risk**: `@electron-toolkit/tsconfig` override of `noImplicitAny` (mitigated: explicit override in both tsconfigs)
3. **Medium risk**: `"type": "module"` confusion (mitigated: documented in plan with clear rationale)

## Open Questions

None. All requirements are clear and all package versions have been verified.
