# log-swim-ui

Swimlane visualization for JSON log streams. An Electron desktop app (macOS/Linux) that reads line-delimited JSON from stdin, classifies entries into regex-based lanes, and renders them in a real-time virtualized grid.

## Prerequisites

- Node.js >= 20.0.0
- npm

## Setup

```bash
npm install
```

## Development

```bash
npm run dev        # Launch Electron in dev mode with HMR
npm run build      # Build all processes to out/
npm run preview    # Preview the built app
```

## Testing

```bash
npm test           # Run Vitest unit tests
npm run test:watch # Vitest in watch mode
npm run test:e2e   # Playwright E2E tests
npm run typecheck  # TypeScript type checking
```

For E2E tests, install Playwright browsers first:

```bash
npx playwright install
```

## Usage (not yet implemented)

```bash
cat logs.json | log-swim-ui --input_key.level level --input_key.timestamp timestamp
cat logs.json | log-swim-ui --input_key.level level --input_key.timestamp timestamp --regexes_for_filter_columns "error|ERROR|fatal" "auth"
```

## Project Structure

```
src/
  main/        # Electron main process
  preload/     # Preload scripts (contextBridge)
  renderer/    # React renderer process
  core/        # Shared pure logic (no Electron/React imports)
tests/
  unit/        # Vitest unit tests
  e2e/         # Playwright E2E tests
bin/           # CLI entry point
```
