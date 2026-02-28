# Implementation Plan: Phase 01 - Project Scaffold & Build Config

## Problem Understanding

This is a greenfield Electron desktop app. No source code exists yet. The goal is to establish the complete build toolchain, project structure, and configuration files so that all subsequent phases (core data pipeline, UI, settings) have a working foundation to build on.

**Key constraint**: This is pure infrastructure. No business logic. Keep it minimal and correct.

### What "done" looks like
- `npm install` succeeds cleanly
- `npm run dev` launches an Electron window showing a React "hello world"
- `npm run build` produces distributable output in `out/`
- `npm test` runs Vitest (passes with zero tests or a trivial sanity test)
- TypeScript strict mode is on and compiles cleanly
- Playwright is configured (installable, config present)
- `.mcp.json`, `CLAUDE.md`, `.npmignore`, `.gitignore` all exist
- Directory structure `src/main/`, `src/renderer/`, `src/core/`, `src/preload/` exists

---

## Package Versions (researched 2026-02-28)

| Package | Version | Role |
|---------|---------|------|
| `electron` | `^40.6.1` | App shell |
| `electron-vite` | `^5.0.0` | Build tooling (main + preload + renderer) |
| `vite` | `^7.3.1` | Underlying bundler (peer dep of electron-vite) |
| `@vitejs/plugin-react` | `^5.1.4` | React JSX/HMR support in renderer |
| `react` | `^19.2.4` | UI framework |
| `react-dom` | `^19.2.4` | React DOM renderer |
| `@types/react` | `^19.2.14` | React type definitions |
| `@types/react-dom` | `^19.2.3` | React DOM type definitions |
| `typescript` | `^5.9.3` | Language |
| `vitest` | `^4.0.18` | Unit test runner |
| `@playwright/test` | `^1.58.2` | E2E test runner |
| `@electron-toolkit/tsconfig` | `^2.0.0` | Base tsconfig for Electron projects |
| `@electron-toolkit/preload` | `^3.0.2` | Preload script utilities (contextBridge helpers) |
| `@electron-toolkit/utils` | `^4.0.0` | Main process utilities (optimizer, etc.) |

### Version notes
- `electron-vite@5.0.0` accepts `vite ^5.0.0 || ^6.0.0 || ^7.0.0`. Use vite 7.x (latest).
- `electron-vite@5.0.0` deprecated `externalizeDepsPlugin` in favor of `build.externalizeDeps` config (now enabled by default). Do NOT import `externalizeDepsPlugin`.
- `@electron-toolkit/tsconfig@2.0.0` base already includes `strict: true`, `moduleResolution: "bundler"`, `target: "esnext"`, `module: "esnext"`. However it sets `noImplicitAny: false` -- we must override this to `true`.
- React 19 is the current stable. Types packages are on 19.x.

---

## High-Level Architecture

```
project root
├── .gitignore
├── .npmignore
├── .mcp.json
├── CLAUDE.md
├── package.json                  # main: "./out/main/index.js"
├── electron.vite.config.ts       # 3-process config: main, preload, renderer
├── tsconfig.json                 # Project references root (files: [], references: [...])
├── tsconfig.node.json            # For main + preload (extends @electron-toolkit/tsconfig/tsconfig.node.json)
├── tsconfig.web.json             # For renderer (extends @electron-toolkit/tsconfig/tsconfig.web.json)
├── vitest.config.ts              # Vitest config for src/core/ unit tests
├── playwright.config.ts          # Playwright E2E config
├── src/
│   ├── main/
│   │   └── index.ts              # Electron main process entry (window creation stub)
│   ├── preload/
│   │   └── index.ts              # Preload script stub (contextBridge)
│   ├── renderer/
│   │   ├── index.html            # HTML entry for renderer
│   │   └── src/
│   │       ├── main.tsx          # React entry point (createRoot, render <App />)
│   │       └── App.tsx           # Hello world React component
│   └── core/                     # Shared pure-logic (no Electron or React imports)
│       └── .gitkeep              # Placeholder so directory is tracked
├── tests/
│   ├── unit/
│   │   └── .gitkeep              # Placeholder for future Vitest tests
│   └── e2e/
│       └── .gitkeep              # Placeholder for future Playwright tests
└── out/                          # Build output (gitignored)
```

### Data flow for this phase
None -- there is no business logic. The only runtime flow is:
1. Electron main process creates a `BrowserWindow`
2. Preload script exposes nothing (stub)
3. Renderer loads `index.html` which loads React
4. React renders "Hello, log-swim-ui" to the screen

---

## Implementation Phases

### Phase A: Project Init & Dependencies

**Goal**: Working `package.json` with all dependencies and correct metadata.

**Steps**:

1. Create `package.json` with:
   - `name`: `"log-swim-ui"`
   - `version`: `"0.1.0"`
   - `description`: `"Swimlane visualization for JSON log streams"`
   - `main`: `"./out/main/index.js"` (electron-vite default output location)
   - `type`: Do NOT set `"type": "module"` -- electron-vite handles ESM/CJS internally. The main process output is CJS by default.
   - `scripts`:
     - `"dev"`: `"electron-vite dev"`
     - `"build"`: `"electron-vite build"`
     - `"preview"`: `"electron-vite preview"`
     - `"test"`: `"vitest run"`
     - `"test:watch"`: `"vitest"`
     - `"test:e2e"`: `"playwright test"`
     - `"typecheck"`: `"tsc --noEmit"`
   - `dependencies`: `react`, `react-dom`, `@electron-toolkit/preload`, `@electron-toolkit/utils`
   - `devDependencies`: `electron`, `electron-vite`, `vite`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`, `vitest`, `@playwright/test`, `@electron-toolkit/tsconfig`
   - `engines`: `{ "node": ">=20.0.0" }`

2. Run `npm install`.

**Verification**: `npm install` exits 0 with no errors. `node_modules/` is populated.

---

### Phase B: TypeScript Configuration

**Goal**: Three tsconfig files following electron-vite conventions. Strict mode everywhere.

**Steps**:

1. Create `tsconfig.json` (project references root):
   ```json
   {
     "files": [],
     "references": [
       { "path": "./tsconfig.node.json" },
       { "path": "./tsconfig.web.json" }
     ]
   }
   ```

2. Create `tsconfig.node.json` (main process + preload + config files):
   ```json
   {
     "extends": "@electron-toolkit/tsconfig/tsconfig.node.json",
     "include": [
       "electron.vite.config.*",
       "src/main/**/*",
       "src/preload/**/*",
       "src/core/**/*"
     ],
     "compilerOptions": {
       "composite": true,
       "types": ["electron-vite/node"],
       "strict": true,
       "noImplicitAny": true
     }
   }
   ```
   Note: `src/core/` is included here because core logic runs in Node (main process). The renderer tsconfig also includes it so both processes can import from core.

3. Create `tsconfig.web.json` (renderer process):
   ```json
   {
     "extends": "@electron-toolkit/tsconfig/tsconfig.web.json",
     "include": [
       "src/renderer/src/**/*",
       "src/core/**/*"
     ],
     "compilerOptions": {
       "composite": true,
       "jsx": "react-jsx",
       "strict": true,
       "noImplicitAny": true,
       "baseUrl": ".",
       "paths": {
         "@renderer/*": ["src/renderer/src/*"],
         "@core/*": ["src/core/*"]
       }
     }
   }
   ```
   Note: Override `jsx` from `"preserve"` (the base default) to `"react-jsx"` for React 19.

**Verification**: `npx tsc --noEmit` (once source files exist) should exit 0.

---

### Phase C: electron-vite Configuration

**Goal**: `electron.vite.config.ts` that handles all three Electron processes.

**Steps**:

1. Create `electron.vite.config.ts`:
   ```ts
   import { resolve } from 'path'
   import { defineConfig } from 'electron-vite'
   import react from '@vitejs/plugin-react'

   export default defineConfig({
     main: {
       // electron-vite 5.0: externalizeDeps is enabled by default
       // No plugins needed for main process
     },
     preload: {
       // electron-vite 5.0: externalizeDeps is enabled by default
       // No plugins needed for preload
     },
     renderer: {
       resolve: {
         alias: {
           '@renderer': resolve('src/renderer/src'),
           '@core': resolve('src/core')
         }
       },
       plugins: [react()]
     }
   })
   ```

**Key decisions**:
- Do NOT use the deprecated `externalizeDepsPlugin()` -- electron-vite 5.0 enables `build.externalizeDeps` by default.
- The `@renderer` alias matches the path alias in `tsconfig.web.json`.
- React plugin goes only in the renderer section.

**Verification**: `npx electron-vite build` should succeed once source files exist.

---

### Phase D: Source File Stubs

**Goal**: Minimal source files that compile and run.

**Steps**:

1. **`src/main/index.ts`** -- Electron main process entry:
   - Import `app`, `BrowserWindow` from `electron`
   - Import `join` from `path`
   - On `app.whenReady()`:
     - Create a `BrowserWindow` with `webPreferences.preload` pointing to `../preload/index.js` (resolved via `__dirname`)
     - Use `is.dev` from `@electron-toolkit/utils` (or check `process.env.NODE_ENV`) to decide:
       - Dev: load the dev server URL (provided by electron-vite as `process.env['ELECTRON_RENDERER_URL']`)
       - Prod: load `index.html` from `../renderer/index.html` (resolved via `__dirname`)
   - Handle `window-all-closed` to quit (except macOS per convention -- though since we only support macOS/Linux, quit on both for simplicity; this is a log viewer, not a multi-window app)

2. **`src/preload/index.ts`** -- Preload script stub:
   - Import `contextBridge` from `electron`
   - Expose an empty API object via `contextBridge.exposeInMainWorld('api', {})`
   - This is a stub; IPC channels will be added in Phase 04

3. **`src/renderer/index.html`** -- HTML entry:
   - Standard HTML5 boilerplate
   - A `<div id="root"></div>` container
   - A `<script type="module" src="./src/main.tsx"></script>` entry

4. **`src/renderer/src/main.tsx`** -- React entry:
   - Import `createRoot` from `react-dom/client`
   - Import `App` from `./App`
   - `createRoot(document.getElementById('root')!).render(<App />)`

5. **`src/renderer/src/App.tsx`** -- Hello world:
   - A simple functional component rendering `<h1>Hello, log-swim-ui</h1>`
   - Include a minimal style: dark background, white text (matches the spec's dark theme direction)

6. **`src/core/.gitkeep`** -- Empty placeholder

7. **`tests/unit/.gitkeep`** and **`tests/e2e/.gitkeep`** -- Empty placeholders

**Verification**: `npm run dev` launches Electron window with "Hello, log-swim-ui" visible.

---

### Phase E: Vitest Configuration

**Goal**: Vitest configured to test `src/core/` (and future unit tests).

**Steps**:

1. Create `vitest.config.ts`:
   ```ts
   import { defineConfig } from 'vitest/config'

   export default defineConfig({
     test: {
       include: ['tests/unit/**/*.test.ts', 'src/**/*.test.ts'],
       globals: false,
       environment: 'node'
     },
     resolve: {
       alias: {
         '@core': resolve('src/core')
       }
     }
   })
   ```
   Notes:
   - `globals: false` -- explicit imports (`import { describe, it, expect } from 'vitest'`). This is explicit and avoids magic globals.
   - Environment is `node` because `src/core/` is pure logic (no DOM). If future renderer-side tests need `jsdom`, they can override per-file.
   - Alias `@core` to match the path alias convention.

2. Optionally create a single sanity test `tests/unit/sanity.test.ts`:
   - `describe('sanity', () => { it('passes', () => { expect(1 + 1).toBe(2) }) })`
   - This confirms the test runner works.

**Verification**: `npm test` runs and exits 0. If the sanity test exists, it reports 1 passing test.

---

### Phase F: Playwright Configuration

**Goal**: Playwright configured for E2E tests (no tests yet, just the framework).

**Steps**:

1. Create `playwright.config.ts`:
   ```ts
   import { defineConfig } from '@playwright/test'

   export default defineConfig({
     testDir: './tests/e2e',
     timeout: 30_000,
     use: {
       headless: true
     }
   })
   ```
   Note: Electron-specific Playwright setup (launching the app via `electron.launch()`) will be configured in Phase 04 or 05 when we actually have E2E tests. For now, just have the config file with the test directory pointing to `tests/e2e/`.

2. Install Playwright browsers: Add a script or note that `npx playwright install` needs to be run. Do NOT add this to `postinstall` -- it downloads ~400MB of browsers and should be explicit.

**Verification**: `npx playwright test` runs and reports 0 tests (exits 0 because no test files exist).

---

### Phase G: .mcp.json

**Goal**: MCP configuration for Playwright.

**Steps**:

1. Create `.mcp.json`:
   ```json
   {
     "mcpServers": {
       "playwright": {
         "command": "npx",
         "args": ["@playwright/mcp@latest", "--headless", "--no-sandbox", "--isolated"]
       }
     }
   }
   ```
   This matches the spec exactly.

**Verification**: File exists with correct content.

---

### Phase H: .gitignore

**Goal**: Prevent build output, dependencies, and temp files from being committed.

**Steps**:

1. Create `.gitignore`:
   ```
   # Dependencies
   node_modules/

   # Build output
   out/
   dist/

   # Temp files
   .tmp/

   # IDE
   .idea/
   .vscode/
   *.swp
   *.swo

   # OS
   .DS_Store
   Thumbs.db

   # Test output
   test-results/
   playwright-report/

   # Environment
   .env
   .env.*

   # npm
   *.tgz

   # Logs
   npm-debug.log*

   # Electron
   *.asar

   # Output directory
   .out/
   ```

**Verification**: `git status` shows `.gitignore` and no unwanted files.

---

### Phase I: .npmignore

**Goal**: Clean npm publishing (exclude dev-only files).

**Steps**:

1. Create `.npmignore`:
   ```
   # Source (publish only built output)
   src/
   tests/

   # Docs
   doc/
   docs/
   *.md
   !README.md

   # Config files not needed at runtime
   .mcp.json
   electron.vite.config.*
   tsconfig*.json
   vitest.config.*
   playwright.config.*

   # Dev/build artifacts
   .tmp/
   .ai_out/
   .out/
   .idea/
   .vscode/
   .git/
   .gitignore
   .claude-memory/

   # Test output
   test-results/
   playwright-report/

   # IDE and OS
   .DS_Store
   Thumbs.db
   *.swp

   # Misc
   *.test.ts
   *.spec.ts
   ```

**Verification**: File exists with appropriate exclusions.

---

### Phase J: CLAUDE.md

**Goal**: Project-level coding standards document.

**Steps**:

1. Create `CLAUDE.md` at project root with comprehensive TypeScript coding standards. The content must cover all sections specified in the task:
   - **Project overview**: Brief description of log-swim-ui, tech stack reference
   - **Core Principles**: 80/20, DRY, SRP, OCP, KISS + Evolvable
   - **SOLID Principles**: Applied to TypeScript -- with emphasis on Interface Segregation and Dependency Inversion via composition
   - **TypeScript Coding Standards**:
     - Type safety: `strict: true`, no `any` (use `unknown`), no type assertions unless justified with a comment
     - Data structures: Use `interface` for object shapes, `type` for unions/intersections. Descriptive `interface` over `Pair`/`Triple`. No `enum` -- use `as const` objects or union types.
     - Async: Always handle errors in async paths. Prefer `async/await` over raw Promises. No fire-and-forget promises.
     - Error handling: Use `Result<T, E>` pattern or explicit error types over thrown exceptions for business logic. Thrown exceptions are for truly exceptional/unrecoverable cases.
   - **Testing Standards**:
     - Vitest for unit tests. BDD style with GIVEN/WHEN/THEN.
     - One assert per test (preferably).
     - Playwright for E2E. Screenshot-based visual verification.
     - Tests go in `tests/unit/` and `tests/e2e/`.
   - **CSS Best Practices**:
     - Use CSS custom properties (tokens) for all visual values
     - `2px` borders over `1px` (visibility/accessibility)
     - No inline styles in components -- use CSS classes referencing variables
   - **Composition over Inheritance**: No class inheritance for component behavior. Use composition, hooks (React), and dependency injection.
   - **Structured Logging**: No `console.log` in production code. Use a structured logger (to be defined). `console.log` is acceptable in tests and dev scripts only.
   - **Project structure**: Document the `src/main`, `src/preload`, `src/renderer`, `src/core` layout and what belongs where.
   - **Import conventions**: `@renderer/*` and `@core/*` path aliases.

**Verification**: File exists with all required sections.

---

## Risks & Considerations

### Risk 1: electron-vite 5.0 compatibility with Vite 7.x
**Likelihood**: Low. electron-vite 5.0 explicitly lists `vite ^7.0.0` as a supported peer dependency.
**Mitigation**: If issues arise, fall back to vite 6.x (`^6.0.0`). Both are in the peer dep range.

### Risk 2: React 19 with @vitejs/plugin-react
**Likelihood**: Very low. React 19 has been stable for over a year and plugin-react 5.x supports it.
**Mitigation**: None needed.

### Risk 3: @electron-toolkit/tsconfig overrides
**Likelihood**: Medium. The base tsconfig sets `noImplicitAny: false` which contradicts our strict-mode requirement.
**Mitigation**: Already addressed in the plan -- we explicitly override `noImplicitAny: true` in both `tsconfig.node.json` and `tsconfig.web.json`.

### Risk 4: `package.json` `"main"` field pointing to `./out/main/index.js`
**Likelihood**: None. This is the electron-vite default output directory.
**Mitigation**: Verify after first build that the file exists at that path.

### Risk 5: `"type": "module"` confusion
**Likelihood**: Medium. Developers might assume ESM requires `"type": "module"` in package.json.
**Mitigation**: Do NOT set `"type": "module"`. electron-vite handles module format internally. The main process outputs CJS by default. The renderer uses Vite's ESM handling. Adding `"type": "module"` would break the main process output.

---

## Acceptance Criteria Verification

| Criterion | How to verify |
|-----------|---------------|
| `npm install` succeeds | Run `npm install`, check exit code 0 |
| `npm run dev` launches Electron window | Run `npm run dev`, visually confirm window with "Hello, log-swim-ui" |
| `npm run build` produces output | Run `npm run build`, check `out/main/index.js`, `out/preload/index.js`, `out/renderer/index.html` exist |
| `npm test` runs Vitest | Run `npm test`, check exit code 0, Vitest output visible |
| TypeScript strict mode | Run `npx tsc --noEmit`, check exit code 0. Verify `tsconfig.node.json` and `tsconfig.web.json` both have `strict: true` and `noImplicitAny: true` |
| Playwright configured | Check `playwright.config.ts` exists. Run `npx playwright test` (0 tests, exits 0) |
| `.mcp.json` exists | Check file content matches spec |
| `CLAUDE.md` exists | Check file has all required sections |
| `.npmignore` exists | Check file content |
| Directory structure | Check `src/main/`, `src/renderer/`, `src/core/`, `src/preload/` all exist |

### Automated verification script

The implementor should create a quick smoke-test script (or just run these commands sequentially) after implementation:

```bash
# 1. Install
npm install

# 2. Typecheck
npx tsc --noEmit

# 3. Build
npm run build

# 4. Verify build output exists
ls out/main/index.js out/preload/index.js out/renderer/index.html

# 5. Run tests
npm test

# 6. Verify directory structure
ls -d src/main src/preload src/renderer src/core

# 7. Verify config files exist
ls .mcp.json CLAUDE.md .npmignore .gitignore electron.vite.config.ts vitest.config.ts playwright.config.ts

# 8. Dev launch (manual -- requires display)
# npm run dev
```

---

## Implementation Order Summary

| Order | Phase | Files Created | Depends On |
|-------|-------|--------------|------------|
| 1 | A: Project Init | `package.json` | Nothing |
| 2 | B: TypeScript Config | `tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json` | A |
| 3 | C: electron-vite Config | `electron.vite.config.ts` | A, B |
| 4 | D: Source Stubs | `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/index.html`, `src/renderer/src/main.tsx`, `src/renderer/src/App.tsx`, `src/core/.gitkeep`, `tests/**/.gitkeep` | A, B, C |
| 5 | E: Vitest Config | `vitest.config.ts`, optional `tests/unit/sanity.test.ts` | A |
| 6 | F: Playwright Config | `playwright.config.ts` | A |
| 7 | G: .mcp.json | `.mcp.json` | Nothing |
| 8 | H: .gitignore | `.gitignore` | Nothing |
| 9 | I: .npmignore | `.npmignore` | Nothing |
| 10 | J: CLAUDE.md | `CLAUDE.md` | Nothing |

Phases G, H, I, J are independent and can be done in any order. A through D must be sequential. E and F depend only on A.

---

## What NOT to Do

- Do NOT use `create-electron-vite` scaffolding tool. We are setting up from scratch to have full control and understanding of every file.
- Do NOT add ESLint/Prettier in this phase. That is not in scope and adds unnecessary complexity to the scaffold.
- Do NOT add `electron-builder` or packaging config. Distribution packaging is not in scope for Phase 01.
- Do NOT add any application logic, CLI parsing, IPC channels, or data pipeline code.
- Do NOT set `"type": "module"` in package.json.
- Do NOT use the deprecated `externalizeDepsPlugin` -- electron-vite 5.0 handles this via config defaults.
- Do NOT add `postinstall` scripts for Playwright browser download.
