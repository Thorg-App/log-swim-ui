# Exploration: Phase 01 - Project Scaffold

## Current Repo State
- **Greenfield** — no source code, package.json, or config files exist
- Only docs: high-level spec, start_spec.md, phase task files (01-07)
- Branch: `log-swim-ui__01_project_scaffold.md_1772307950108` (clean)
- Feature branch: `log-swim-ui` (exists)

## What Phase 01 Must Create
1. `package.json` — electron app with bin field for npm global install
2. `electron.vite.config.ts` — electron-vite build config (main, preload, renderer)
3. `tsconfig.json` — TypeScript strict mode
4. Vitest config — unit testing
5. Playwright config — E2E testing
6. `.mcp.json` — Playwright MCP server
7. `CLAUDE.md` — Project-specific coding standards
8. `.npmignore` — Publishing exclusions
9. Directory structure: `src/main/`, `src/renderer/`, `src/core/`, `src/preload/`
10. Minimal Electron main entry (window creation)
11. Minimal React renderer (hello world)
12. Preload script stub

## Key Technology Decisions (from high-level spec)
- electron-vite (NOT vanilla vite)
- React for renderer
- TypeScript strict
- Vitest for unit tests
- Playwright for E2E
- npm (not yarn/pnpm)
- @tanstack/virtual (later phases)
- CSS custom properties for theming (later phases)

## Acceptance Criteria
- `npm install` succeeds
- `npm run dev` launches Electron window with React hello world
- `npm run build` produces output
- `npm test` runs Vitest (0 tests OK, framework works)
- TypeScript strict mode compiles cleanly
- Playwright configured and installable
- `.mcp.json`, `CLAUDE.md`, `.npmignore` exist
- Directory structure exists

## Notes
- CLAUDE.md content was referenced as "provided by the engineer" in the task spec but the verbatim text is not in the repo. Will construct from the key sections listed in the task: Core Principles, SOLID, TypeScript Standards, Testing, CSS, Composition over Inheritance, Structured Logging.
- The `start_spec.md` uses `NAME::REGEX` lane format but high-level spec uses regex-only. High-level spec is authoritative.
