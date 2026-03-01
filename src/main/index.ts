import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { IPC_CHANNELS } from '../core/types'
import { CliParser, CliValidationError } from './cli-parser'
import { ConfigManager } from './config-manager'
import { IpcBridge } from './ipc-bridge'

// --- Step 1: Check TTY (must be piped stdin, not interactive terminal) ---

if (process.stdin.isTTY) {
  process.stderr.write(CliParser.formatUsage() + '\n')
  process.exit(1)
}

// --- Step 2: Parse CLI arguments ---

let cliArgs: ReturnType<typeof CliParser.parse>
try {
  cliArgs = CliParser.parse(process.argv.slice(2))
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
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
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
  ipcMain.handle(IPC_CHANNELS.GET_CLI_ARGS, () => ({
    keyLevel: cliArgs.keyLevel,
    keyTimestamp: cliArgs.keyTimestamp,
    lanePatterns: cliArgs.lanePatterns
  }))

  // Wait for window to finish loading before starting IPC bridge
  // WHY: webContents.send silently drops messages before did-finish-load
  mainWindow.webContents.on('did-finish-load', () => {
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
  })

  // macOS: re-create window on activate
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  app.quit()
})
