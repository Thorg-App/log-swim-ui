import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import { IPC_CHANNELS } from '../core/types'
import type { ElectronApi, IpcLogLine } from '../core/types'

const api: ElectronApi = {
  // Push channels (main -> renderer): register callbacks, return unsubscribe function
  // WHY: wrapper function stored so removeListener gets the exact same reference
  onLogLine: (callback) => {
    const handler = (_event: IpcRendererEvent, line: IpcLogLine): void => callback(line)
    ipcRenderer.on(IPC_CHANNELS.LOG_LINE, handler)
    return () => { ipcRenderer.removeListener(IPC_CHANNELS.LOG_LINE, handler) }
  },
  onStreamEnd: (callback) => {
    const handler = (_event: IpcRendererEvent): void => callback()
    ipcRenderer.on(IPC_CHANNELS.STREAM_END, handler)
    return () => { ipcRenderer.removeListener(IPC_CHANNELS.STREAM_END, handler) }
  },
  onStreamError: (callback) => {
    const handler = (_event: IpcRendererEvent, error: string): void => callback(error)
    ipcRenderer.on(IPC_CHANNELS.STREAM_ERROR, handler)
    return () => { ipcRenderer.removeListener(IPC_CHANNELS.STREAM_ERROR, handler) }
  },
  onConfigError: (callback) => {
    const handler = (_event: IpcRendererEvent, error: string): void => callback(error)
    ipcRenderer.on(IPC_CHANNELS.CONFIG_ERROR, handler)
    return () => { ipcRenderer.removeListener(IPC_CHANNELS.CONFIG_ERROR, handler) }
  },

  // Request channels (renderer -> main): invoke and await response
  getConfig: () => ipcRenderer.invoke(IPC_CHANNELS.GET_CONFIG),
  saveConfig: (config) => ipcRenderer.invoke(IPC_CHANNELS.SAVE_CONFIG, config),
  getCliArgs: () => ipcRenderer.invoke(IPC_CHANNELS.GET_CLI_ARGS),
  resetConfig: () => ipcRenderer.invoke(IPC_CHANNELS.RESET_CONFIG),

  // Handshake signal: renderer tells main that all IPC listeners are registered
  signalReady: () => ipcRenderer.send(IPC_CHANNELS.RENDERER_READY)
}

contextBridge.exposeInMainWorld('api', api)
