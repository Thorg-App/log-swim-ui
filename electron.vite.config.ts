import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    // electron-vite 5.0: externalizeDeps is enabled by default
  },
  preload: {
    // electron-vite 5.0: externalizeDeps is enabled by default
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@core': resolve('src/core')
      }
    },
    plugins: [react()]
  }
})
