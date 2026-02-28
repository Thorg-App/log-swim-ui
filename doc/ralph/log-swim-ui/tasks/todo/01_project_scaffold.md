# Phase 01: Project Scaffold & Build Config

## Objective
Set up the greenfield project with electron-vite, TypeScript, Vitest, Playwright, and all foundational configuration files so that subsequent phases have a working build, test, and dev environment.

## Prerequisites
- None — this is the first phase.

## Scope
### In Scope
- Initialize npm project (`package.json`) with correct metadata for npm global install
- Install and configure electron-vite with TypeScript
- Configure TypeScript (`tsconfig.json`) with strict mode
- Configure Vitest for unit tests (BDD style)
- Configure Playwright for E2E tests
- Create `.mcp.json` with Playwright MCP server config:
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
- Create `CLAUDE.md` with the TypeScript coding standards provided by the engineer (full content provided below)
- Create `.npmignore` for clean npm publishing
- Create basic directory structure: `src/main/`, `src/renderer/`, `src/core/`, `src/preload/`
- Create minimal Electron main process entry point (window creation stub)
- Create minimal React renderer entry point (hello world)
- Create preload script stub
- Verify: `npm run dev` launches Electron window, `npm test` runs Vitest, build succeeds

### Out of Scope
- Any application logic (data pipeline, UI components, CLI parsing)
- Design system / CSS tokens (Phase 02)
- Core types beyond basic stubs

## Implementation Guidance

### electron-vite Setup
- Use `electron-vite` as the build tool (handles main, preload, and renderer processes)
- Configure three entry points: main, preload, renderer
- React for renderer process

### Package.json
- Set `"bin"` field for npm global install: `"log-swim-ui": "./dist/cli.js"` (or appropriate entry)
- Set `"type": "module"` if using ESM
- Include scripts: `dev`, `build`, `test`, `test:e2e`, `preview`

### CLAUDE.md Content
The engineer provided a comprehensive TypeScript coding standards document. Write it to `CLAUDE.md` at the project root. Key sections include:
- Core Principles (80/20, DRY, SRP, OCP, KISS)
- SOLID Principles
- TypeScript Coding Standards (type safety, data structures, async, error handling)
- Testing standards (Vitest, BDD, Playwright)
- CSS best practices (2px borders over 1px)
- Composition over inheritance
- Structured logging (no console.log)

### .npmignore
Exclude: `src/`, `tests/`, `docs/`, `.tmp/`, `.idea/`, `*.test.ts`, `node_modules/`, `.mcp.json`, etc.

## Acceptance Criteria
- [ ] `npm install` succeeds with no errors
- [ ] `npm run dev` launches an Electron window with a React "hello world" page
- [ ] `npm run build` produces distributable output
- [ ] `npm test` runs Vitest and reports 0 tests (no test files yet, but framework works)
- [ ] TypeScript strict mode is enabled and compiles cleanly
- [ ] Playwright is configured and installable
- [ ] `.mcp.json` exists with Playwright MCP server configuration
- [ ] `CLAUDE.md` exists with full TypeScript coding standards
- [ ] `.npmignore` exists with appropriate exclusions
- [ ] Directory structure: `src/main/`, `src/renderer/`, `src/core/`, `src/preload/` exist

## Notes
- The CLAUDE.md content was explicitly provided by the engineer — use it verbatim (it's the full TypeScript coding standards block from the requirements conversation).
- This phase is pure infrastructure — no business logic.
