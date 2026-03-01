import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  // WHY: No `use.headless` or browser `projects` needed.
  // Electron tests launch via _electron.launch() which manages its own window.
  // No webServer config needed -- we launch the built app directly.
  retries: 0,
  workers: 1 // WHY: Electron tests must run serially to avoid display conflicts
})
