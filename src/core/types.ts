// --- Result Types ---

interface ParseSuccess<T> {
  readonly ok: true
  readonly value: T
}

interface ParseFailure {
  readonly ok: false
  readonly error: string
}

type ParseResult<T> = ParseSuccess<T> | ParseFailure

// --- Timestamp Formats ---

const TIMESTAMP_FORMATS = ['iso8601', 'epochMillis'] as const
type TimestampFormat = (typeof TIMESTAMP_FORMATS)[number]

const VIEW_TIMESTAMP_FORMATS = ['iso', 'local', 'relative'] as const
type ViewTimestampFormat = (typeof VIEW_TIMESTAMP_FORMATS)[number]

// --- LogEntry ---

interface LogEntry {
  readonly rawJson: string
  readonly fields: Record<string, unknown>
  readonly timestamp: Date
  readonly level: string
  laneIndex: number // mutable -- changes on lane reorder and re-classification
}

// --- LaneDefinition ---

interface LaneDefinition {
  readonly pattern: string // original regex string from CLI/UI
  readonly regex: RegExp | null // null if pattern failed to compile
  readonly isError: boolean // true if regex compilation failed
  readonly caseSensitive: boolean // true = default (no flags), false = 'i' flag
}

interface CreateLaneDefinitionOptions {
  readonly caseSensitive?: boolean // default: true (backward compatible)
}

/**
 * Factory function to create a LaneDefinition.
 * Wraps `new RegExp(pattern, flags)` in a try/catch. If compilation fails,
 * returns `{ pattern, regex: null, isError: true, caseSensitive }`.
 *
 * When `caseSensitive` is false, the regex is compiled with the 'i' flag.
 */
function createLaneDefinition(pattern: string, options?: CreateLaneDefinitionOptions): LaneDefinition {
  const caseSensitive = options?.caseSensitive ?? true
  const flags = caseSensitive ? '' : 'i'
  try {
    const regex = new RegExp(pattern, flags)
    return { pattern, regex, isError: false, caseSensitive }
  } catch {
    return { pattern, regex: null, isError: true, caseSensitive }
  }
}

// --- Parsed Line (JSON parsing result) ---

interface JsonParseSuccess {
  readonly ok: true
  readonly fields: Record<string, unknown>
  readonly rawJson: string
}

interface JsonParseFailure {
  readonly ok: false
  readonly rawLine: string
  readonly error: string
}

type ParsedLine = JsonParseSuccess | JsonParseFailure

// --- IPC Log Line (structured data sent from main to renderer) ---

interface IpcLogLine {
  readonly rawJson: string
  readonly fields: Record<string, unknown>
  readonly timestamp: number // epoch millis; 0 = unparseable
  readonly level: string // extracted via --key-level; 'unknown' if missing
}

// --- IPC Channels (centralized channel name constants) ---

const IPC_CHANNELS = {
  LOG_LINE: 'log-line',
  STREAM_END: 'stream-end',
  STREAM_ERROR: 'stream-error',
  CONFIG_ERROR: 'config-error',
  GET_CONFIG: 'get-config',
  SAVE_CONFIG: 'save-config',
  GET_CLI_ARGS: 'get-cli-args',
  RESET_CONFIG: 'reset-config',
  // WHY: Renderer signals it has registered all IPC listeners. Main waits for this
  // before starting stdin ingestion, preventing the race where messages are sent
  // before the renderer is ready to receive them.
  RENDERER_READY: 'renderer-ready'
} as const

// --- ElectronApi (preload bridge contract) ---
// WHY: Defined in core so both preload and renderer can reference the same contract.

interface ElectronApi {
  // Push channels (main -> renderer): register callbacks, return unsubscribe function
  onLogLine: (callback: (line: IpcLogLine) => void) => () => void
  onStreamEnd: (callback: () => void) => () => void
  onStreamError: (callback: (error: string) => void) => () => void
  onConfigError: (callback: (error: string) => void) => () => void

  // Request channels (renderer -> main): invoke and await response
  getConfig: () => Promise<AppConfig>
  saveConfig: (config: AppConfig) => Promise<void>
  getCliArgs: () => Promise<CliArgsResult>
  resetConfig: () => Promise<AppConfig>

  // Handshake signal (renderer -> main): notify that all IPC listeners are registered
  signalReady: () => void
}

interface CliArgsResult {
  readonly keyLevel: string
  readonly keyTimestamp: string
  readonly lanePatterns: readonly string[]
}

// --- AppConfig ---

interface AppConfigColors {
  readonly levels: Readonly<Record<string, string>>
  readonly unrecognizedLevel: string
  readonly swimlaneHeaders: string
  readonly background: string
  readonly rowHover: string
  readonly expandedRow: string
}

interface AppConfigUI {
  readonly rowHeight: number
  readonly fontFamily: string
  readonly fontSize: number
  readonly viewTimestampFormat: ViewTimestampFormat
}

interface AppConfigPerformance {
  readonly flushIntervalMs: number
  readonly maxLogEntries: number
}

interface AppConfig {
  readonly colors: AppConfigColors
  readonly ui: AppConfigUI
  readonly performance: AppConfigPerformance
}

const DEFAULT_APP_CONFIG: AppConfig = {
  colors: {
    levels: {
      trace: '#6c757d',
      debug: '#0dcaf0',
      info: '#198754',
      warn: '#ffc107',
      error: '#dc3545',
      fatal: '#6f42c1'
    },
    unrecognizedLevel: '#adb5bd',
    swimlaneHeaders: '#495057',
    background: '#212529',
    rowHover: '#2c3034',
    expandedRow: '#343a40'
  },
  ui: {
    rowHeight: 28,
    fontFamily: 'monospace',
    fontSize: 13,
    viewTimestampFormat: 'iso'
  },
  performance: {
    flushIntervalMs: 200,
    maxLogEntries: 20000
  }
}

// --- Config Constraints (UI validation bounds) ---
// Single source of truth for min/max of numeric config fields.
// Used by SettingsPanel for inline validation. NOT used by ConfigValidator
// (file validation uses permissive > 0 checks to avoid breaking existing user configs).

const CONFIG_CONSTRAINTS = {
  rowHeight: { min: 16, max: 128 },
  fontSize: { min: 8, max: 32 },
  flushIntervalMs: { min: 50, max: 5000 },
  maxLogEntries: { min: 100, max: 1_000_000 }
} as const

// --- Known Log Levels ---
// Single source of truth for recognized log level names.
// Referenced by: log-row-utils (CSS class mapping), applyConfigToCSS (CSS variable mapping),
// and components.css (static CSS rules -- must be kept in sync manually).

const KNOWN_LOG_LEVELS = [
  'trace',
  'debug',
  'info',
  'notice',
  'warn',
  'warning',
  'error',
  'fatal',
  'critical'
] as const

type KnownLogLevel = (typeof KNOWN_LOG_LEVELS)[number]

// --- View Mode ---

const VIEW_MODES = ['live', 'scroll'] as const
type ViewMode = (typeof VIEW_MODES)[number]

// --- App Error Types ---

const APP_ERROR_TYPES = ['no-stdin', 'stream-error', 'config-error'] as const
type AppErrorType = (typeof APP_ERROR_TYPES)[number]

// --- Exports ---

export type {
  ParseSuccess,
  ParseFailure,
  ParseResult,
  TimestampFormat,
  ViewTimestampFormat,
  LogEntry,
  LaneDefinition,
  CreateLaneDefinitionOptions,
  JsonParseSuccess,
  JsonParseFailure,
  ParsedLine,
  IpcLogLine,
  ElectronApi,
  CliArgsResult,
  AppConfigColors,
  AppConfigUI,
  AppConfigPerformance,
  AppConfig,
  ViewMode,
  AppErrorType,
  KnownLogLevel
}

export {
  TIMESTAMP_FORMATS,
  VIEW_TIMESTAMP_FORMATS,
  VIEW_MODES,
  APP_ERROR_TYPES,
  IPC_CHANNELS,
  DEFAULT_APP_CONFIG,
  CONFIG_CONSTRAINTS,
  KNOWN_LOG_LEVELS,
  createLaneDefinition
}
