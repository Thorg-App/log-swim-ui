import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../core/types'
import type { ElectronApi } from '../core/types'

const api: ElectronApi = {
  // Push channels (main -> renderer): register callbacks
  onLogLine: (callback) =>
    ipcRenderer.on(IPC_CHANNELS.LOG_LINE, (_event, line) => callback(line)),
  onStreamEnd: (callback) =>
    ipcRenderer.on(IPC_CHANNELS.STREAM_END, (_event) => callback()),
  onStreamError: (callback) =>
    ipcRenderer.on(IPC_CHANNELS.STREAM_ERROR, (_event, error) => callback(error)),
  onConfigError: (callback) =>
    ipcRenderer.on(IPC_CHANNELS.CONFIG_ERROR, (_event, error) => callback(error)),

  // Request channels (renderer -> main): invoke and await response
  getConfig: () => ipcRenderer.invoke(IPC_CHANNELS.GET_CONFIG),
  saveConfig: (config) => ipcRenderer.invoke(IPC_CHANNELS.SAVE_CONFIG, config),
  getCliArgs: () => ipcRenderer.invoke(IPC_CHANNELS.GET_CLI_ARGS)
}

contextBridge.exposeInMainWorld('api', api)
