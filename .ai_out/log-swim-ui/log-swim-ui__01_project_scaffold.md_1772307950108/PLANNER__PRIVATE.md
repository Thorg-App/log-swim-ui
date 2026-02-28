# Planner Private Notes: Phase 01

## Research Findings

### Package versions verified via `npm view` on 2026-02-28:
- electron: 40.6.1
- electron-vite: 5.0.0
- vite: 7.3.1
- @vitejs/plugin-react: 5.1.4
- react: 19.2.4
- react-dom: 19.2.4
- @types/react: 19.2.14
- @types/react-dom: 19.2.3
- typescript: 5.9.3
- vitest: 4.0.18
- @playwright/test: 1.58.2
- @playwright/mcp: 0.0.68
- @electron-toolkit/tsconfig: 2.0.0
- @electron-toolkit/preload: 3.0.2
- @electron-toolkit/utils: 4.0.0

### electron-vite 5.0 breaking changes:
- `externalizeDepsPlugin` deprecated -> use `build.externalizeDeps` config (enabled by default)
- `bytecodePlugin` deprecated -> use `build.bytecode` config
- New `build.isolatedEntries` option for multi-entry builds

### @electron-toolkit/tsconfig base config analysis:
Base `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "esnext",
    "module": "esnext",
    "sourceMap": false,
    "strict": true,
    "jsx": "preserve",
    "esModuleInterop": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitAny": false,   // <-- MUST OVERRIDE
    "noImplicitReturns": true
  }
}
```

`tsconfig.node.json` extends base + adds `"types": ["node"]`
`tsconfig.web.json` extends base + adds `"lib": ["ESNext", "DOM", "DOM.Iterable"]`

### electron-vite project conventions:
- Default entry points: `src/main/{index|main}.{js|ts}`, `src/preload/{index|preload}.{js|ts}`, `src/renderer/index.html`
- Default output: `out/main/`, `out/preload/`, `out/renderer/`
- `package.json` `main` field must point to `./out/main/index.js`
- Dev server URL available via `process.env['ELECTRON_RENDERER_URL']`

### Spec discrepancies noticed:
- `start_spec.md` uses `NAME::REGEX` lane format; `log-swim-ui-high-level.md` uses regex-only (no names). High-level spec is authoritative per exploration notes.
- `start_spec.md` says `--lanes` is required; high-level spec says it's optional. High-level spec is authoritative.
- Config field name differs: start_spec uses `"timestampFormat"`, high-level uses `"viewTimestampFormat"`. Not relevant for Phase 01 but flagged.
- Unrecognized level color: start_spec says `#FFFFFF`, high-level says `#F97316` (orange). Not relevant for Phase 01 but flagged.

### Node.js version in dev env: v20.20.0 (compatible with all packages)

## Watchpoints for Implementor

1. When writing `src/main/index.ts`, use the electron-vite pattern for loading the renderer:
   - Dev: `mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']!)`
   - Prod: `mainWindow.loadFile(join(__dirname, '../renderer/index.html'))`
   - The `@electron-toolkit/utils` package provides an `is` object with `is.dev` for checking environment.

2. The `electron.vite.config.ts` must use `import { defineConfig } from 'electron-vite'` (NOT from `vite`).

3. The `vitest.config.ts` must use `import { defineConfig } from 'vitest/config'` (NOT from `vite`), so that Vitest's test options are properly typed.

4. When creating `src/renderer/index.html`, the script tag must be `<script type="module" src="./src/main.tsx"></script>` (relative to index.html location).

5. The preload script path in `BrowserWindow` webPreferences should be: `join(__dirname, '../preload/index.js')` -- relative to the built output location in `out/main/`.

6. For `resolve` in `vitest.config.ts`, need to import `resolve` from `path`.
