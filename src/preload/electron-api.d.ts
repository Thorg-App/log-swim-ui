import type { ElectronApi } from '../core/types'

declare global {
  interface Window {
    api: ElectronApi
  }
}
