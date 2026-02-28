# Plan Reviewer Private Notes

## Verification Method

All package versions were verified by running `npm view <package>@latest version` directly from the machine. The `@electron-toolkit/tsconfig` and `electron-vite` packages were also downloaded and extracted to verify internal content (tsconfig base values, type declarations, deprecated markers).

## Key Verification Results

- `electron-vite@5.0.0` peer deps: `vite ^5.0.0 || ^6.0.0 || ^7.0.0` and `@swc/core ^1.0.0` (optional)
- Note: `@swc/core` is an optional peer dep of electron-vite. The plan does not mention it. This is fine -- it is optional and only needed if using SWC for transpilation instead of the default.
- The base `@electron-toolkit/tsconfig/tsconfig.json` has: `target: esnext, module: esnext, strict: true, jsx: preserve, noImplicitAny: false, moduleResolution: bundler`
- `tsconfig.node.json` extends base and adds `types: ["node"]`
- `tsconfig.web.json` extends base and adds `lib: ["ESNext", "DOM", "DOM.Iterable"]`

## Issues Found

1. **BLOCKER**: Missing `bin` field in package.json -- task spec explicitly requires it
2. **BUG**: Missing `import { resolve } from 'path'` in vitest.config.ts
3. **MINOR**: Missing `@core` path alias in tsconfig.node.json (not blocking for Phase 01)

## Confidence Level

HIGH -- all factual claims verified. The plan demonstrates genuine research rather than hallucination. Every version number checks out.

## Notes for Implementor

- When creating `src/main/index.ts`, the `is.dev` check from `@electron-toolkit/utils` is the idiomatic way. The import would be: `import { is } from '@electron-toolkit/utils'`, then `if (is.dev && process.env['ELECTRON_RENDERER_URL'])`.
- The `electronApp` and `optimizer` exports from `@electron-toolkit/utils` might also be useful for HMR in the main process, but are not needed for the scaffold.
- Vitest 4.x does NOT list vite as a peer dependency, so there should be no conflict between vitest's internal vite and the project's vite 7.x.
- The `@swc/core` optional peer dep warning from electron-vite can be safely ignored or silenced with `--legacy-peer-deps` if it causes npm install warnings.

## Decision on Plan Iteration

SKIP PLAN_ITERATION. The fixes are trivial (add one import, add one JSON field + stub file). The implementor can apply them directly.
