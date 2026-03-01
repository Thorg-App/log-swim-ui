import { _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { resolve } from 'path'

// --- IPC Log Line (duplicated from core/types to avoid import path issues in e2e) ---
// WHY: E2E tests run outside the Vite/TS alias context, so @core imports don't resolve.
// Keeping a minimal local copy avoids complex tsconfig gymnastics for test helpers.

interface IpcLogLine {
  readonly rawJson: string
  readonly fields: Record<string, unknown>
  readonly timestamp: number
  readonly level: string
}

// --- Constants ---

const BUILT_MAIN_ENTRY = resolve(__dirname, '../../../out/main/index.js')

// WHY: The LogBuffer flush interval in production is 200ms (configured in AppConfig).
// E2E tests need to wait at least this long + some margin for React re-render.
const FLUSH_WAIT_MS = 400

// --- Test App Handle ---

interface TestApp {
  readonly electronApp: ElectronApplication
  readonly page: Page
}

// --- Launch Helper ---

// WHY: Chromium flags needed for headless Electron on Linux without X display.
// --no-sandbox: avoids SUID sandbox configuration requirement
// --disable-gpu: avoids GPU initialization in headless mode
// --enable-features=UseOzonePlatform + --ozone-platform=headless: runs without X/Wayland display server
const CHROMIUM_HEADLESS_FLAGS = [
  '--no-sandbox',
  '--disable-gpu',
  '--enable-features=UseOzonePlatform',
  '--ozone-platform=headless'
]

/**
 * Launch the built Electron app with CLI arguments.
 * Waits for the first window to load and the swimlane-grid to be visible.
 *
 * IMPORTANT: The app must be built before running E2E tests (`npm run build`).
 *
 * Sets E2E_TEST=1 env to enable test seam in main process:
 * - Skips TTY check (stdin is Playwright's pipe)
 * - Enables offscreen rendering (required for headless ozone)
 * - Filters Chromium flags from CLI args before CliParser
 * - Skips IpcBridge stdin reading (test data injected via webContents.send)
 */
async function launchApp(cliArgs: string[]): Promise<TestApp> {
  const electronApp = await electron.launch({
    args: [...CHROMIUM_HEADLESS_FLAGS, BUILT_MAIN_ENTRY, ...cliArgs],
    env: { ...process.env, E2E_TEST: '1' }
  })

  const page = await electronApp.firstWindow()

  // Wait for the app to finish loading and render the grid
  await page.waitForSelector('.swimlane-grid', { timeout: 10_000 })

  return { electronApp, page }
}

// --- IPC Injection Helpers ---
// WHY: Instead of piping to stdin, we inject test data directly via IPC.
// This tests the same IPC path that stdin data follows (webContents.send -> preload -> renderer).

/**
 * Inject IPC log lines into the renderer process via the main process.
 * Uses BrowserWindow.getAllWindows()[0].webContents.send() to simulate
 * what IpcBridge does after parsing stdin.
 */
async function injectLogLines(electronApp: ElectronApplication, lines: readonly IpcLogLine[]): Promise<void> {
  for (const line of lines) {
    await electronApp.evaluate(({ BrowserWindow }, ipcLine) => {
      const win = BrowserWindow.getAllWindows()[0]
      if (win) {
        win.webContents.send('log-line', ipcLine)
      }
    }, line)
  }
}

/**
 * Send the stream-end signal to the renderer process.
 */
async function sendStreamEnd(electronApp: ElectronApplication): Promise<void> {
  await electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      win.webContents.send('stream-end')
    }
  })
}

/**
 * Wait for the LogBuffer flush interval + React re-render.
 */
async function waitForFlush(page: Page): Promise<void> {
  await page.waitForTimeout(FLUSH_WAIT_MS)
}

// --- Test Data Factory ---

/**
 * Create an IpcLogLine from simple parameters.
 * Produces the same structure that IpcBridge.handleLine would emit.
 */
function createIpcLogLine(
  level: string,
  message: string,
  timestamp: string,
  extraFields?: Record<string, unknown>
): IpcLogLine {
  const fields: Record<string, unknown> = {
    level,
    message,
    timestamp,
    ...extraFields
  }
  return {
    rawJson: JSON.stringify(fields),
    fields,
    timestamp: new Date(timestamp).getTime(),
    level
  }
}

export { launchApp, injectLogLines, sendStreamEnd, waitForFlush, createIpcLogLine, FLUSH_WAIT_MS }
export type { TestApp, IpcLogLine }
