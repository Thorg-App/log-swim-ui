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
  static validate(loaded: Record<string, unknown>): readonly string[] {
    const errors: string[] = []

    if ('colors' in loaded && typeof loaded['colors'] === 'object' && loaded['colors'] !== null) {
      // WHY: narrowed from unknown to non-null object by typeof+null guard above
      ConfigValidator.validateColors(errors, loaded['colors'] as Record<string, unknown>)
    }

    if ('ui' in loaded && typeof loaded['ui'] === 'object' && loaded['ui'] !== null) {
      // WHY: narrowed from unknown to non-null object by typeof+null guard above
      ConfigValidator.validateUI(errors, loaded['ui'] as Record<string, unknown>)
    }

    if ('performance' in loaded && typeof loaded['performance'] === 'object' && loaded['performance'] !== null) {
      // WHY: narrowed from unknown to non-null object by typeof+null guard above
      ConfigValidator.validatePerformance(errors, loaded['performance'] as Record<string, unknown>)
    }

    return errors
  }

  private static validateColors(errors: string[], colors: Record<string, unknown>): void {
    if ('levels' in colors && typeof colors['levels'] === 'object' && colors['levels'] !== null) {
      // WHY: narrowed from unknown to non-null object by typeof+null guard above
      const levels = colors['levels'] as Record<string, unknown>
      for (const [key, value] of Object.entries(levels)) {
        if (typeof value !== 'string' || !HEX_COLOR_PATTERN.test(value)) {
          errors.push(`colors.levels.${key}: expected hex color (e.g. #FF0000), got "${String(value)}"`)
        }
      }
    } else if ('levels' in colors) {
      errors.push('colors.levels: expected an object')
    }

    const colorFields = ['unrecognizedLevel', 'swimlaneHeaders', 'background', 'rowHover', 'expandedRow'] as const
    for (const field of colorFields) {
      if (field in colors) {
        const value = colors[field]
        if (typeof value !== 'string' || !HEX_COLOR_PATTERN.test(value)) {
          errors.push(`colors.${field}: expected hex color (e.g. #FF0000), got "${String(value)}"`)
        }
      }
    }
  }

  private static validateUI(errors: string[], ui: Record<string, unknown>): void {
    ConfigValidator.validatePositiveNumber(errors, ui, 'ui', 'rowHeight')
    ConfigValidator.validatePositiveNumber(errors, ui, 'ui', 'fontSize')
    if ('fontFamily' in ui) {
      if (typeof ui['fontFamily'] !== 'string' || ui['fontFamily'].trim() === '') {
        errors.push(`ui.fontFamily: expected non-empty string, got "${String(ui['fontFamily'])}"`)
      }
    }
    if ('viewTimestampFormat' in ui) {
      // WHY: widen literal union tuple to string[] so .includes() accepts the unknown-narrowed string
      const valid = VIEW_TIMESTAMP_FORMATS as readonly string[]
      if (typeof ui['viewTimestampFormat'] !== 'string' || !valid.includes(ui['viewTimestampFormat'])) {
        errors.push(
          `ui.viewTimestampFormat: expected one of [${VIEW_TIMESTAMP_FORMATS.join(', ')}], got "${String(ui['viewTimestampFormat'])}"`
        )
      }
    }
  }

  private static validatePerformance(errors: string[], perf: Record<string, unknown>): void {
    ConfigValidator.validatePositiveNumber(errors, perf, 'performance', 'flushIntervalMs')
    ConfigValidator.validatePositiveNumber(errors, perf, 'performance', 'maxLogEntries')
  }

  /**
   * Validates that a field, if present, is a positive number.
   * The section and field parameters are used to build the error message path (e.g. "ui.rowHeight").
   */
  private static validatePositiveNumber(
    errors: string[],
    obj: Record<string, unknown>,
    section: string,
    field: string
  ): void {
    if (field in obj) {
      if (typeof obj[field] !== 'number' || obj[field] <= 0) {
        errors.push(`${section}.${field}: expected positive number, got "${String(obj[field])}"`)
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
  // WHY: narrowed from unknown to non-null object by early-return guard above
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
  // WHY: narrowed from unknown to non-null object by early-return guard above
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
  // WHY: narrowed from unknown to non-null object by early-return guard above
  const src = loaded as Record<string, unknown>
  // WHY: widen literal union tuple to string[] so .includes() accepts the unknown-narrowed string
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
        // WHY: validated as string member of VIEW_TIMESTAMP_FORMATS by includes() check above
        ? (src['viewTimestampFormat'] as AppConfigUI['viewTimestampFormat'])
        : defaults.viewTimestampFormat
  }
}

function mergePerformance(defaults: AppConfigPerformance, loaded: unknown): AppConfigPerformance {
  if (typeof loaded !== 'object' || loaded === null) return defaults
  // WHY: narrowed from unknown to non-null object by early-return guard above
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

    // WHY: narrowed from unknown to non-null, non-array object by typeof+null+Array.isArray guards above
    const loadedRecord = parsed as Record<string, unknown>

    // Validate before merging
    const errors = ConfigValidator.validate(loadedRecord)
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
   * Reset config to defaults: save DEFAULT_APP_CONFIG to disk and return it.
   */
  async reset(): Promise<AppConfig> {
    this.currentConfig = DEFAULT_APP_CONFIG
    await this.writeToDisk(DEFAULT_APP_CONFIG)
    return DEFAULT_APP_CONFIG
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
