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
}

/**
 * Factory function to create a LaneDefinition.
 * Wraps `new RegExp(pattern)` in a try/catch. If compilation fails,
 * returns `{ pattern, regex: null, isError: true }`.
 */
function createLaneDefinition(pattern: string): LaneDefinition {
  try {
    const regex = new RegExp(pattern)
    return { pattern, regex, isError: false }
  } catch {
    return { pattern, regex: null, isError: true }
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

// --- StdinMessage (IPC message type for Phase 04) ---

const STDIN_MESSAGE_TYPES = ['line', 'end', 'error'] as const
type StdinMessageType = (typeof STDIN_MESSAGE_TYPES)[number]

interface StdinMessage {
  readonly type: StdinMessageType
  readonly data?: string // present for 'line' and 'error'
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

// --- Exports ---

export type {
  ParseSuccess,
  ParseFailure,
  ParseResult,
  TimestampFormat,
  ViewTimestampFormat,
  LogEntry,
  LaneDefinition,
  JsonParseSuccess,
  JsonParseFailure,
  ParsedLine,
  StdinMessageType,
  StdinMessage,
  AppConfigColors,
  AppConfigUI,
  AppConfigPerformance,
  AppConfig
}

export {
  TIMESTAMP_FORMATS,
  VIEW_TIMESTAMP_FORMATS,
  STDIN_MESSAGE_TYPES,
  DEFAULT_APP_CONFIG,
  createLaneDefinition
}
