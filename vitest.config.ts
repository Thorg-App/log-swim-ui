import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts', 'src/**/*.test.ts'],
    globals: false,
    environment: 'node'
  },
  resolve: {
    alias: {
      '@core': resolve('src/core')
    }
  }
})
