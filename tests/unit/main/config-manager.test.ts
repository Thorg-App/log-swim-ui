import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { ConfigManager } from '../../../src/main/config-manager'
import { DEFAULT_APP_CONFIG } from '../../../src/core/types'
import type { AppConfig } from '../../../src/core/types'

let tempDir: string

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'config-manager-test-'))
})

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true })
})

async function writeConfigFile(config: unknown): Promise<void> {
  await writeFile(join(tempDir, 'config.json'), JSON.stringify(config, null, 2), 'utf-8')
}

async function readConfigFile(): Promise<unknown> {
  const content = await readFile(join(tempDir, 'config.json'), 'utf-8')
  return JSON.parse(content)
}

describe('ConfigManager', () => {
  describe('GIVEN config file does not exist', () => {
    describe('WHEN load() is called', () => {
      it('THEN returns ok: true', async () => {
        const manager = new ConfigManager(tempDir)
        const result = await manager.load()
        expect(result.ok).toBe(true)
      })

      it('THEN returns source: defaults', async () => {
        const manager = new ConfigManager(tempDir)
        const result = await manager.load()
        if (!result.ok) throw new Error('Expected success')
        expect(result.source).toBe('defaults')
      })

      it('THEN config matches DEFAULT_APP_CONFIG', async () => {
        const manager = new ConfigManager(tempDir)
        const result = await manager.load()
        expect(result.config).toEqual(DEFAULT_APP_CONFIG)
      })

      it('THEN creates the config file on disk', async () => {
        const manager = new ConfigManager(tempDir)
        await manager.load()
        const fileContent = await readConfigFile()
        expect(fileContent).toEqual(DEFAULT_APP_CONFIG)
      })
    })
  })

  describe('GIVEN config file does not exist and directory does not exist', () => {
    describe('WHEN load() is called', () => {
      it('THEN creates directory and file with defaults', async () => {
        const nestedDir = join(tempDir, 'nested', 'dir')
        const manager = new ConfigManager(nestedDir)
        const result = await manager.load()
        expect(result.ok).toBe(true)
        expect(result.config).toEqual(DEFAULT_APP_CONFIG)
      })
    })
  })

  describe('GIVEN valid config file with all fields', () => {
    const customConfig: AppConfig = {
      colors: {
        levels: {
          trace: '#111111',
          debug: '#222222',
          info: '#333333',
          warn: '#444444',
          error: '#555555',
          fatal: '#666666'
        },
        unrecognizedLevel: '#777777',
        swimlaneHeaders: '#888888',
        background: '#999999',
        rowHover: '#AAAAAA',
        expandedRow: '#BBBBBB'
      },
      ui: {
        rowHeight: 32,
        fontFamily: 'Courier New',
        fontSize: 14,
        viewTimestampFormat: 'local'
      },
      performance: {
        flushIntervalMs: 300,
        maxLogEntries: 10000
      }
    }

    describe('WHEN load() is called', () => {
      it('THEN returns ok: true with source: file', async () => {
        await writeConfigFile(customConfig)
        const manager = new ConfigManager(tempDir)
        const result = await manager.load()
        expect(result.ok).toBe(true)
        if (!result.ok) throw new Error('Expected success')
        expect(result.source).toBe('file')
      })

      it('THEN values from file are used', async () => {
        await writeConfigFile(customConfig)
        const manager = new ConfigManager(tempDir)
        const result = await manager.load()
        expect(result.config.ui.rowHeight).toBe(32)
        expect(result.config.ui.fontFamily).toBe('Courier New')
        expect(result.config.colors.levels['info']).toBe('#333333')
      })
    })
  })

  describe('GIVEN config file with partial fields (missing some)', () => {
    describe('WHEN load() is called', () => {
      it('THEN missing fields are filled from defaults', async () => {
        // Only provide ui section, missing colors and performance
        await writeConfigFile({
          ui: {
            rowHeight: 40,
            fontFamily: 'monospace',
            fontSize: 13,
            viewTimestampFormat: 'iso'
          }
        })
        const manager = new ConfigManager(tempDir)
        const result = await manager.load()
        expect(result.ok).toBe(true)
        expect(result.config.ui.rowHeight).toBe(40)
        expect(result.config.colors).toEqual(DEFAULT_APP_CONFIG.colors)
        expect(result.config.performance).toEqual(DEFAULT_APP_CONFIG.performance)
      })

      it('THEN partially missing nested fields get defaults', async () => {
        // Provide colors but missing some color fields
        await writeConfigFile({
          colors: {
            levels: { info: '#00FF00' },
            background: '#000000'
          }
        })
        const manager = new ConfigManager(tempDir)
        const result = await manager.load()
        expect(result.ok).toBe(true)
        // The provided value is used
        expect(result.config.colors.levels['info']).toBe('#00FF00')
        expect(result.config.colors.background).toBe('#000000')
        // Missing color fields get defaults
        expect(result.config.colors.unrecognizedLevel).toBe(DEFAULT_APP_CONFIG.colors.unrecognizedLevel)
        expect(result.config.colors.rowHover).toBe(DEFAULT_APP_CONFIG.colors.rowHover)
      })
    })
  })

  describe('GIVEN config file with invalid JSON', () => {
    describe('WHEN load() is called', () => {
      it('THEN returns ok: false', async () => {
        await writeFile(join(tempDir, 'config.json'), '{not valid json}', 'utf-8')
        const manager = new ConfigManager(tempDir)
        const result = await manager.load()
        expect(result.ok).toBe(false)
      })

      it('THEN error message mentions invalid JSON', async () => {
        await writeFile(join(tempDir, 'config.json'), '{not valid json}', 'utf-8')
        const manager = new ConfigManager(tempDir)
        const result = await manager.load()
        if (result.ok) throw new Error('Expected failure')
        expect(result.error).toContain('invalid JSON')
      })

      it('THEN config is DEFAULT_APP_CONFIG (safe fallback)', async () => {
        await writeFile(join(tempDir, 'config.json'), '{not valid json}', 'utf-8')
        const manager = new ConfigManager(tempDir)
        const result = await manager.load()
        expect(result.config).toEqual(DEFAULT_APP_CONFIG)
      })
    })
  })

  describe('GIVEN config file with invalid types (e.g. rowHeight is a string)', () => {
    describe('WHEN load() is called', () => {
      it('THEN returns ok: false with validation error', async () => {
        await writeConfigFile({
          ui: { rowHeight: 'not-a-number' }
        })
        const manager = new ConfigManager(tempDir)
        const result = await manager.load()
        expect(result.ok).toBe(false)
        if (result.ok) throw new Error('Expected failure')
        expect(result.error).toContain('rowHeight')
      })
    })
  })

  describe('GIVEN config file with invalid hex color', () => {
    describe('WHEN load() is called', () => {
      it('THEN returns ok: false with validation error', async () => {
        await writeConfigFile({
          colors: {
            levels: { info: 'not-a-color' }
          }
        })
        const manager = new ConfigManager(tempDir)
        const result = await manager.load()
        expect(result.ok).toBe(false)
        if (result.ok) throw new Error('Expected failure')
        expect(result.error).toContain('hex color')
      })
    })
  })

  describe('GIVEN config file with invalid viewTimestampFormat', () => {
    describe('WHEN load() is called', () => {
      it('THEN returns ok: false with validation error', async () => {
        await writeConfigFile({
          ui: { viewTimestampFormat: 'invalid-format' }
        })
        const manager = new ConfigManager(tempDir)
        const result = await manager.load()
        expect(result.ok).toBe(false)
        if (result.ok) throw new Error('Expected failure')
        expect(result.error).toContain('viewTimestampFormat')
      })
    })
  })

  describe('GIVEN config file with negative flushIntervalMs', () => {
    describe('WHEN load() is called', () => {
      it('THEN returns ok: false with validation error', async () => {
        await writeConfigFile({
          performance: { flushIntervalMs: -100 }
        })
        const manager = new ConfigManager(tempDir)
        const result = await manager.load()
        expect(result.ok).toBe(false)
        if (result.ok) throw new Error('Expected failure')
        expect(result.error).toContain('flushIntervalMs')
      })
    })
  })

  describe('GIVEN config file with levels as a non-object', () => {
    describe('WHEN load() is called', () => {
      it('THEN returns ok: false with validation error', async () => {
        await writeConfigFile({
          colors: { levels: 'red' }
        })
        const manager = new ConfigManager(tempDir)
        const result = await manager.load()
        expect(result.ok).toBe(false)
        if (result.ok) throw new Error('Expected failure')
        expect(result.error).toContain('levels')
      })
    })
  })

  describe('GIVEN config file with empty fontFamily', () => {
    describe('WHEN load() is called', () => {
      it('THEN returns ok: false with validation error', async () => {
        await writeConfigFile({
          ui: { fontFamily: '' }
        })
        const manager = new ConfigManager(tempDir)
        const result = await manager.load()
        expect(result.ok).toBe(false)
        if (result.ok) throw new Error('Expected failure')
        expect(result.error).toContain('fontFamily')
      })
    })
  })

  describe('GIVEN save() is called with a new config', () => {
    const newConfig: AppConfig = {
      ...DEFAULT_APP_CONFIG,
      ui: { ...DEFAULT_APP_CONFIG.ui, rowHeight: 50 }
    }

    describe('WHEN getConfig() is called after save', () => {
      it('THEN returns the saved config', async () => {
        const manager = new ConfigManager(tempDir)
        await manager.save(newConfig)
        expect(manager.getConfig().ui.rowHeight).toBe(50)
      })
    })

    describe('WHEN file is read from disk after save', () => {
      it('THEN contains the saved config as JSON', async () => {
        const manager = new ConfigManager(tempDir)
        await manager.save(newConfig)
        const fileContent = await readConfigFile() as AppConfig
        expect(fileContent.ui.rowHeight).toBe(50)
      })
    })
  })

  describe('GIVEN save() is called when directory does not exist', () => {
    describe('WHEN called', () => {
      it('THEN creates directory and saves successfully', async () => {
        const nestedDir = join(tempDir, 'new', 'dir')
        const manager = new ConfigManager(nestedDir)
        await manager.save(DEFAULT_APP_CONFIG)
        const content = await readFile(join(nestedDir, 'config.json'), 'utf-8')
        expect(JSON.parse(content)).toEqual(DEFAULT_APP_CONFIG)
      })
    })
  })

  describe('GIVEN getConfig() is called before load()', () => {
    describe('WHEN called', () => {
      it('THEN returns DEFAULT_APP_CONFIG', () => {
        const manager = new ConfigManager(tempDir)
        expect(manager.getConfig()).toEqual(DEFAULT_APP_CONFIG)
      })
    })
  })

  describe('GIVEN config file root is a JSON array', () => {
    describe('WHEN load() is called', () => {
      it('THEN returns ok: false', async () => {
        await writeFile(join(tempDir, 'config.json'), '[1,2,3]', 'utf-8')
        const manager = new ConfigManager(tempDir)
        const result = await manager.load()
        expect(result.ok).toBe(false)
        if (result.ok) throw new Error('Expected failure')
        expect(result.error).toContain('not a JSON object')
      })
    })
  })

  describe('GIVEN a ConfigManager with a custom config loaded', () => {
    const customConfig: AppConfig = {
      ...DEFAULT_APP_CONFIG,
      ui: { ...DEFAULT_APP_CONFIG.ui, rowHeight: 64, fontSize: 18 }
    }

    describe('WHEN reset() is called', () => {
      it('THEN getConfig() returns DEFAULT_APP_CONFIG', async () => {
        const manager = new ConfigManager(tempDir)
        await manager.save(customConfig)
        expect(manager.getConfig().ui.rowHeight).toBe(64)

        await manager.reset()
        expect(manager.getConfig()).toEqual(DEFAULT_APP_CONFIG)
      })

      it('THEN the config file on disk matches DEFAULT_APP_CONFIG', async () => {
        const manager = new ConfigManager(tempDir)
        await manager.save(customConfig)

        await manager.reset()
        const fileContent = await readConfigFile() as AppConfig
        expect(fileContent).toEqual(DEFAULT_APP_CONFIG)
      })

      it('THEN returns DEFAULT_APP_CONFIG', async () => {
        const manager = new ConfigManager(tempDir)
        await manager.save(customConfig)

        const result = await manager.reset()
        expect(result).toEqual(DEFAULT_APP_CONFIG)
      })
    })
  })

  describe('GIVEN config file with multiple validation errors', () => {
    describe('WHEN load() is called', () => {
      it('THEN error message contains all validation errors', async () => {
        await writeConfigFile({
          ui: { rowHeight: -1, fontSize: 'big' },
          colors: { levels: { info: 'bad' } }
        })
        const manager = new ConfigManager(tempDir)
        const result = await manager.load()
        expect(result.ok).toBe(false)
        if (result.ok) throw new Error('Expected failure')
        expect(result.error).toContain('rowHeight')
        expect(result.error).toContain('fontSize')
        expect(result.error).toContain('info')
      })
    })
  })
})
