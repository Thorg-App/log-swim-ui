import type { LogEntry, LaneDefinition } from '@core/types'
import { KNOWN_LOG_LEVELS } from '@core/types'

// --- Known Log Levels (derived Set for O(1) lookup) ---

const KNOWN_LOG_LEVELS_SET: ReadonlySet<string> = new Set(KNOWN_LOG_LEVELS)

const DEFAULT_MESSAGE_MAX_LENGTH = 200

// --- Internal Helpers ---

/**
 * Normalizes a log level string for CSS class matching.
 * Returns the lowercase level if known, otherwise 'unrecognized'.
 */
function normalizeLevel(level: string): string {
  const normalized = level.toLowerCase()
  return KNOWN_LOG_LEVELS_SET.has(normalized) ? normalized : 'unrecognized'
}

// --- Public Helpers ---

/**
 * Returns the CSS class for a log level's left-border color.
 * Known levels map to `.log-row--{level}`.
 * Unknown levels map to `.log-row--unrecognized`.
 */
function getLevelCssClass(level: string): string {
  return `log-row--${normalizeLevel(level)}`
}

/**
 * Returns the CSS class for a log level's text color.
 * Known levels map to `.log-row__level--{level}`.
 * Unknown levels map to `.log-row__level--unrecognized`.
 */
function getLevelTextCssClass(level: string): string {
  return `log-row__level--${normalizeLevel(level)}`
}

/**
 * Extract a message preview from a LogEntry for display in collapsed rows.
 *
 * Priority:
 * 1. `entry.fields.message` if it is a string
 * 2. `entry.fields.msg` if it is a string
 * 3. Truncated `entry.rawJson`
 */
function getMessagePreview(entry: LogEntry, maxLength: number = DEFAULT_MESSAGE_MAX_LENGTH): string {
  const message = entry.fields.message
  if (typeof message === 'string') {
    return truncate(message, maxLength)
  }

  const msg = entry.fields.msg
  if (typeof msg === 'string') {
    return truncate(msg, maxLength)
  }

  return truncate(entry.rawJson, maxLength)
}

/**
 * Convert a zero-based lane index to a 1-based CSS grid column number.
 * CSS grid columns are 1-indexed.
 */
function getGridColumn(laneIndex: number): number {
  return laneIndex + 1
}

/**
 * Calculate the total lane count including the implicit "unmatched" lane.
 */
function getTotalLaneCount(lanes: readonly LaneDefinition[]): number {
  return lanes.length + 1
}

// --- Internal Helpers ---

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text
  }
  return text.slice(0, maxLength) + '\u2026' // Unicode ellipsis
}

export { getLevelCssClass, getLevelTextCssClass, getMessagePreview, getGridColumn, getTotalLaneCount }
