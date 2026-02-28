import { contextBridge } from 'electron'

// Stub: IPC channels will be added in Phase 04
contextBridge.exposeInMainWorld('api', {})
