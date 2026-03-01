import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { IPC_CHANNELS } from '../core/types'
import { CliParser, CliValidationError } from './cli-parser'
import { ConfigManager } from './config-manager'
import { IpcBridge } from './ipc-bridge'

// --- E2E Test Mode Detection ---
// WHY: When launched via Playwright _electron.launch(), process.stdin is piped by Playwright
// and Chromium flags (--no-sandbox, --ozone-platform, etc.) appear in process.argv.
// E2E_TEST=1 enables: skip TTY check, offscreen rendering, filter Chromium flags from argv.
const isE2eTest = process.env['E2E_TEST'] === '1'

// --- Step 1: Check TTY (must be piped stdin, not interactive terminal) ---

if (!isE2eTest && process.stdin.isTTY) {
  process.stderr.write(CliParser.formatUsage() + '\n')
  process.exit(1)
}

// --- Step 2: Parse CLI arguments ---
// WHY: When launched via Playwright, process.argv contains Chromium flags (--no-sandbox,
// --disable-gpu, etc.) and the app entry path as a positional arg. Playwright's loader removes
// --inspect and --remote-debugging-port, but other flags and the app path remain.
// We extract only the known app flags (--key-level, --key-timestamp, --lanes) by finding
// the first known app flag and taking everything from there.

function extractAppArgs(argv: readonly string[]): string[] {
  const APP_FLAGS = ['--key-level', '--key-timestamp', '--lanes']
  const firstAppFlagIndex = argv.findIndex((arg) =>
    APP_FLAGS.some((flag) => arg === flag)
  )
  if (firstAppFlagIndex === -1) return []
  return argv.slice(firstAppFlagIndex)
}

let cliArgs: ReturnType<typeof CliParser.parse>
try {
  const rawArgs = process.argv.slice(2)
  const appArgs = isE2eTest ? extractAppArgs(rawArgs) : rawArgs
  cliArgs = CliParser.parse(appArgs)
} catch (e: unknown) {
  if (e instanceof CliValidationError) {
    process.stderr.write(e.message + '\n\n' + CliParser.formatUsage() + '\n')
    process.exit(1)
  }
  throw e // unexpected error, let it crash
}

// --- Step 3: Create Window ---

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    // WHY: show:false + offscreen:true needed for headless ozone platform (E2E tests without X display)
    show: !isE2eTest,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      offscreen: isE2eTest
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

// --- Step 4: App Ready + Orchestration ---

app.whenReady().then(async () => {
  // Load config
  const configManager = new ConfigManager(app.getPath('userData'))
  const configResult = await configManager.load()

  // Create window
  const mainWindow = createWindow()

  // Register IPC handlers (request channels: renderer -> main)
  ipcMain.handle(IPC_CHANNELS.GET_CONFIG, () => configManager.getConfig())
  ipcMain.handle(IPC_CHANNELS.SAVE_CONFIG, (_event, config) => configManager.save(config))
  ipcMain.handle(IPC_CHANNELS.RESET_CONFIG, async () => configManager.reset())
  ipcMain.handle(IPC_CHANNELS.GET_CLI_ARGS, () => ({
    keyLevel: cliArgs.keyLevel,
    keyTimestamp: cliArgs.keyTimestamp,
    lanePatterns: cliArgs.lanePatterns
  }))

  // Wait for window to finish loading before starting IPC bridge
  // WHY: webContents.send silently drops messages before did-finish-load
  mainWindow.webContents.on('did-finish-load', () => {
    // WHY: In E2E mode, test data is injected via webContents.send() from Playwright,
    // not via stdin. Skip IpcBridge to avoid reading Playwright's control pipe as log data.
    // E2E tests have their own implicit handshake (waitForSelector('.swimlane-grid'))
    // so they do not need the RENDERER_READY signal.
    if (isE2eTest) {
      // Send config error if applicable (E2E mode: no bridge, no handshake needed)
      if (!configResult.ok) {
        mainWindow.webContents.send(IPC_CHANNELS.CONFIG_ERROR, configResult.error)
      }
      return
    }

    // WHY: did-finish-load fires when the HTML/JS loads, but React's useEffect hooks
    // (which register IPC listeners) run asynchronously later. If we start stdin
    // ingestion now, all LOG_LINE and STREAM_END messages are sent before the renderer
    // registers its listeners, causing complete data loss (e.g. `cat file | log-swim-ui`).
    // The renderer calls signalReady() after ALL IPC listeners are registered in
    // useLogIngestion, ensuring no messages are dropped.
    const RENDERER_READY_TIMEOUT_MS = 10_000
    let bridgeStarted = false

    const timeoutId = setTimeout(() => {
      // WHY: Safety net -- if renderer crashes or fails to signal, avoid hanging forever.
      // Start the bridge anyway; data may be lost, but the app does not freeze.
      console.error(
        `[log-swim-ui] renderer did not signal ready within ${RENDERER_READY_TIMEOUT_MS}ms, starting bridge anyway`
      )
      startBridge()
    }, RENDERER_READY_TIMEOUT_MS)

    ipcMain.once(IPC_CHANNELS.RENDERER_READY, () => {
      clearTimeout(timeoutId)
      startBridge()
    })

    // WHY: Guard prevents double invocation if both timeout and RENDERER_READY fire
    // (e.g. renderer signals just after timeout fires but before once-listener is removed).
    function startBridge(): void {
      if (bridgeStarted) return
      bridgeStarted = true
      // Send config error if applicable
      if (!configResult.ok) {
        mainWindow.webContents.send(IPC_CHANNELS.CONFIG_ERROR, configResult.error)
      }

      // Start the IPC bridge (stdin -> parse -> IPC to renderer)
      const bridge = new IpcBridge({
        keyLevel: cliArgs.keyLevel,
        keyTimestamp: cliArgs.keyTimestamp,
        sender: mainWindow.webContents
      })
      bridge.start(process.stdin)
    }
  })

  // WHY: No macOS 'activate' handler. This is a stdin-piped CLI tool: window-all-closed
  // unconditionally quits the app, so activate never fires. If it somehow did, recreating
  // a window without an IPC bridge would produce a non-functional shell.
})

app.on('window-all-closed', () => {
  app.quit()
})
