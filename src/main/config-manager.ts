import { readFile, writeFile, mkdir, access } from 'node:fs/promises'
import { join } from 'node:path'
import type { AppConfig, AppConfigColors, AppConfigUI, AppConfigPerformance } from '../core/types'
import { DEFAULT_APP_CONFIG, VIEW_TIMESTAMP_FORMATS } from '../core/types'

// --- Config Load Result (discriminated union) ---

interface ConfigLoadSuccess {
  readonly ok: true
  readonly config: AppConfig
  readonly source: 'file' | 'defaults'
}

interface ConfigLoadFailure {
  readonly ok: false
  readonly error: string
  readonly config: AppConfig // always returns defaults so app can still run
}

type ConfigLoadResult = ConfigLoadSuccess | ConfigLoadFailure

// --- Validation ---

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/

class ConfigValidator {
  private readonly errors: string[] = []

  validate(loaded: Record<string, unknown>): string[] {
    this.errors.length = 0

    if ('colors' in loaded && typeof loaded['colors'] === 'object' && loaded['colors'] !== null) {
      this.validateColors(loaded['colors'] as Record<string, unknown>)
    }

    if ('ui' in loaded && typeof loaded['ui'] === 'object' && loaded['ui'] !== null) {
      this.validateUI(loaded['ui'] as Record<string, unknown>)
    }

    if ('performance' in loaded && typeof loaded['performance'] === 'object' && loaded['performance'] !== null) {
      this.validatePerformance(loaded['performance'] as Record<string, unknown>)
    }

    return [...this.errors]
  }

  private validateColors(colors: Record<string, unknown>): void {
    if ('levels' in colors && typeof colors['levels'] === 'object' && colors['levels'] !== null) {
      const levels = colors['levels'] as Record<string, unknown>
      for (const [key, value] of Object.entries(levels)) {
        if (typeof value !== 'string' || !HEX_COLOR_PATTERN.test(value)) {
          this.errors.push(`colors.levels.${key}: expected hex color (e.g. #FF0000), got "${String(value)}"`)
        }
      }
    } else if ('levels' in colors) {
      this.errors.push('colors.levels: expected an object')
    }

    const colorFields = ['unrecognizedLevel', 'swimlaneHeaders', 'background', 'rowHover', 'expandedRow'] as const
    for (const field of colorFields) {
      if (field in colors) {
        const value = colors[field]
        if (typeof value !== 'string' || !HEX_COLOR_PATTERN.test(value)) {
          this.errors.push(`colors.${field}: expected hex color (e.g. #FF0000), got "${String(value)}"`)
        }
      }
    }
  }

  private validateUI(ui: Record<string, unknown>): void {
    if ('rowHeight' in ui) {
      if (typeof ui['rowHeight'] !== 'number' || ui['rowHeight'] <= 0) {
        this.errors.push(`ui.rowHeight: expected positive number, got "${String(ui['rowHeight'])}"`)
      }
    }
    if ('fontSize' in ui) {
      if (typeof ui['fontSize'] !== 'number' || ui['fontSize'] <= 0) {
        this.errors.push(`ui.fontSize: expected positive number, got "${String(ui['fontSize'])}"`)
      }
    }
    if ('fontFamily' in ui) {
      if (typeof ui['fontFamily'] !== 'string' || ui['fontFamily'].trim() === '') {
        this.errors.push(`ui.fontFamily: expected non-empty string, got "${String(ui['fontFamily'])}"`)
      }
    }
    if ('viewTimestampFormat' in ui) {
      const valid = VIEW_TIMESTAMP_FORMATS as readonly string[]
      if (typeof ui['viewTimestampFormat'] !== 'string' || !valid.includes(ui['viewTimestampFormat'])) {
        this.errors.push(
          `ui.viewTimestampFormat: expected one of [${VIEW_TIMESTAMP_FORMATS.join(', ')}], got "${String(ui['viewTimestampFormat'])}"`
        )
      }
    }
  }

  private validatePerformance(perf: Record<string, unknown>): void {
    if ('flushIntervalMs' in perf) {
      if (typeof perf['flushIntervalMs'] !== 'number' || perf['flushIntervalMs'] <= 0) {
        this.errors.push(`performance.flushIntervalMs: expected positive number, got "${String(perf['flushIntervalMs'])}"`)
      }
    }
    if ('maxLogEntries' in perf) {
      if (typeof perf['maxLogEntries'] !== 'number' || perf['maxLogEntries'] <= 0) {
        this.errors.push(`performance.maxLogEntries: expected positive number, got "${String(perf['maxLogEntries'])}"`)
      }
    }
  }
}

// --- Deep Merge ---

/**
 * Deep merge loaded config with defaults.
 * For each key in defaults:
 * - If both default and loaded have an object value, recurse.
 * - If loaded has a leaf value of the correct type, use it.
 * - Otherwise fall back to the default.
 *
 * This ensures forward compatibility: new config fields added in future
 * versions automatically get their default values.
 */
function deepMerge(defaults: AppConfig, loaded: Record<string, unknown>): AppConfig {
  return {
    colors: mergeColors(defaults.colors, loaded['colors']),
    ui: mergeUI(defaults.ui, loaded['ui']),
    performance: mergePerformance(defaults.performance, loaded['performance'])
  }
}

function mergeColors(defaults: AppConfigColors, loaded: unknown): AppConfigColors {
  if (typeof loaded !== 'object' || loaded === null) return defaults
  const src = loaded as Record<string, unknown>

  return {
    levels: mergeLevels(defaults.levels, src['levels']),
    unrecognizedLevel: mergeHexColor(defaults.unrecognizedLevel, src['unrecognizedLevel']),
    swimlaneHeaders: mergeHexColor(defaults.swimlaneHeaders, src['swimlaneHeaders']),
    background: mergeHexColor(defaults.background, src['background']),
    rowHover: mergeHexColor(defaults.rowHover, src['rowHover']),
    expandedRow: mergeHexColor(defaults.expandedRow, src['expandedRow'])
  }
}

function mergeLevels(
  defaults: Readonly<Record<string, string>>,
  loaded: unknown
): Readonly<Record<string, string>> {
  if (typeof loaded !== 'object' || loaded === null) return defaults
  const src = loaded as Record<string, unknown>
  const result: Record<string, string> = { ...defaults }

  for (const [key, value] of Object.entries(src)) {
    if (typeof value === 'string' && HEX_COLOR_PATTERN.test(value)) {
      result[key] = value
    }
  }

  return result
}

function mergeHexColor(defaultValue: string, loaded: unknown): string {
  if (typeof loaded === 'string' && HEX_COLOR_PATTERN.test(loaded)) {
    return loaded
  }
  return defaultValue
}

function mergeUI(defaults: AppConfigUI, loaded: unknown): AppConfigUI {
  if (typeof loaded !== 'object' || loaded === null) return defaults
  const src = loaded as Record<string, unknown>
  const validFormats = VIEW_TIMESTAMP_FORMATS as readonly string[]

  return {
    rowHeight:
      typeof src['rowHeight'] === 'number' && src['rowHeight'] > 0
        ? src['rowHeight']
        : defaults.rowHeight,
    fontFamily:
      typeof src['fontFamily'] === 'string' && src['fontFamily'].trim() !== ''
        ? src['fontFamily']
        : defaults.fontFamily,
    fontSize:
      typeof src['fontSize'] === 'number' && src['fontSize'] > 0
        ? src['fontSize']
        : defaults.fontSize,
    viewTimestampFormat:
      typeof src['viewTimestampFormat'] === 'string' && validFormats.includes(src['viewTimestampFormat'])
        ? (src['viewTimestampFormat'] as AppConfigUI['viewTimestampFormat'])
        : defaults.viewTimestampFormat
  }
}

function mergePerformance(defaults: AppConfigPerformance, loaded: unknown): AppConfigPerformance {
  if (typeof loaded !== 'object' || loaded === null) return defaults
  const src = loaded as Record<string, unknown>

  return {
    flushIntervalMs:
      typeof src['flushIntervalMs'] === 'number' && src['flushIntervalMs'] > 0
        ? src['flushIntervalMs']
        : defaults.flushIntervalMs,
    maxLogEntries:
      typeof src['maxLogEntries'] === 'number' && src['maxLogEntries'] > 0
        ? src['maxLogEntries']
        : defaults.maxLogEntries
  }
}

// --- Config Manager ---

const CONFIG_FILENAME = 'config.json'
const JSON_INDENT = 2

/**
 * Manages loading, validating, and saving the application config file.
 *
 * The config directory path is injected via constructor for testability.
 * In Electron, pass app.getPath('userData'). In tests, pass a temp directory.
 */
class ConfigManager {
  private readonly configPath: string
  private currentConfig: AppConfig = DEFAULT_APP_CONFIG

  constructor(configDir: string) {
    this.configPath = join(configDir, CONFIG_FILENAME)
  }

  /**
   * Load and validate config from disk.
   *
   * - If file does not exist: creates directory + file with defaults, returns success with source 'defaults'.
   * - If file exists with valid JSON: merges with defaults, validates, returns merged config.
   * - If file has invalid JSON or validation fails: returns failure with defaults as fallback.
   */
  async load(): Promise<ConfigLoadResult> {
    const fileExists = await this.fileExists()

    if (!fileExists) {
      await mkdir(join(this.configPath, '..'), { recursive: true })
      await this.writeToDisk(DEFAULT_APP_CONFIG)
      this.currentConfig = DEFAULT_APP_CONFIG
      return { ok: true, config: DEFAULT_APP_CONFIG, source: 'defaults' }
    }

    let rawContent: string
    try {
      rawContent = await readFile(this.configPath, { encoding: 'utf-8' })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown read error'
      return { ok: false, error: `Failed to read config file: ${message}`, config: DEFAULT_APP_CONFIG }
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(rawContent)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown parse error'
      this.currentConfig = DEFAULT_APP_CONFIG
      return { ok: false, error: `Config file contains invalid JSON: ${message}`, config: DEFAULT_APP_CONFIG }
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      this.currentConfig = DEFAULT_APP_CONFIG
      return { ok: false, error: 'Config file root is not a JSON object', config: DEFAULT_APP_CONFIG }
    }

    const loadedRecord = parsed as Record<string, unknown>

    // Validate before merging
    const validator = new ConfigValidator()
    const errors = validator.validate(loadedRecord)
    if (errors.length > 0) {
      this.currentConfig = DEFAULT_APP_CONFIG
      return {
        ok: false,
        error: `Config validation failed: ${errors.join('; ')}`,
        config: DEFAULT_APP_CONFIG
      }
    }

    const mergedConfig = deepMerge(DEFAULT_APP_CONFIG, loadedRecord)
    this.currentConfig = mergedConfig
    return { ok: true, config: mergedConfig, source: 'file' }
  }

  /**
   * Write config to disk as formatted JSON. Updates currentConfig.
   */
  async save(config: AppConfig): Promise<void> {
    await mkdir(join(this.configPath, '..'), { recursive: true })
    this.currentConfig = config
    await this.writeToDisk(config)
  }

  /**
   * Returns current in-memory config (synchronous).
   */
  getConfig(): AppConfig {
    return this.currentConfig
  }

  private async fileExists(): Promise<boolean> {
    try {
      await access(this.configPath)
      return true
    } catch {
      return false
    }
  }

  private async writeToDisk(config: AppConfig): Promise<void> {
    await writeFile(this.configPath, JSON.stringify(config, null, JSON_INDENT) + '\n', {
      encoding: 'utf-8'
    })
  }
}

export { ConfigManager }
export type { ConfigLoadResult, ConfigLoadSuccess, ConfigLoadFailure }
