import type { ViewTimestampFormat } from '@core/types'

const MS_PER_SECOND = 1_000
const MS_PER_MINUTE = 60_000
const MS_PER_HOUR = 3_600_000

/**
 * Format a timestamp for display in the swimlane UI.
 *
 * - `iso`: Full ISO-8601 string (e.g. `2024-01-15T10:30:00.000Z`)
 * - `local`: 24h local time with seconds and milliseconds (e.g. `10:30:00.123`)
 * - `relative`: Offset from firstTimestamp (e.g. `+0:05.123` or `+1:05:00.000`)
 */
function formatTimestamp(
  timestamp: Date,
  format: ViewTimestampFormat,
  firstTimestamp: Date | null
): string {
  switch (format) {
    case 'iso':
      return timestamp.toISOString()

    case 'local':
      return formatLocal(timestamp)

    case 'relative':
      return formatRelative(timestamp, firstTimestamp)
  }
}

function formatLocal(timestamp: Date): string {
  const hours = String(timestamp.getHours()).padStart(2, '0')
  const minutes = String(timestamp.getMinutes()).padStart(2, '0')
  const seconds = String(timestamp.getSeconds()).padStart(2, '0')
  const millis = String(timestamp.getMilliseconds()).padStart(3, '0')
  return `${hours}:${minutes}:${seconds}.${millis}`
}

function formatRelative(timestamp: Date, firstTimestamp: Date | null): string {
  if (firstTimestamp === null) {
    return '+0:00.000'
  }

  const diffMs = timestamp.getTime() - firstTimestamp.getTime()
  const hours = Math.floor(diffMs / MS_PER_HOUR)
  const minutes = Math.floor((diffMs % MS_PER_HOUR) / MS_PER_MINUTE)
  const seconds = Math.floor((diffMs % MS_PER_MINUTE) / MS_PER_SECOND)
  const millis = diffMs % MS_PER_SECOND

  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  const ms = String(millis).padStart(3, '0')

  if (hours > 0) {
    return `+${hours}:${mm}:${ss}.${ms}`
  }
  return `+${minutes}:${ss}.${ms}`
}

export { formatTimestamp }
