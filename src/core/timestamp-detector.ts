import type { TimestampFormat, ParseResult } from './types'

/** Upper bound for epoch millis validation: year 2100 in milliseconds. */
const EPOCH_MILLIS_UPPER_BOUND = 4102444800000

/**
 * Detects and locks the timestamp format from the first value seen,
 * then parses subsequent values using the locked format.
 *
 * Two-method design:
 * - `detectAndLock()` throws on failure (spec-compliant for first line).
 * - `parse()` returns ParseResult for subsequent lines (never throws).
 */
class TimestampDetector {
  private lockedFormat: TimestampFormat | null = null

  /**
   * Detect and lock the timestamp format from the first value.
   * Throws if the format cannot be determined.
   */
  detectAndLock(value: unknown): Date {
    if (typeof value === 'string') {
      const result = TimestampDetector.tryParseIso8601(value)
      if (result !== null) {
        this.lockedFormat = 'iso8601'
        return result
      }
      throw new Error(
        `Cannot detect timestamp format: string value "${value}" is not a valid ISO 8601 date`
      )
    }

    if (typeof value === 'number') {
      if (TimestampDetector.isValidEpochMillis(value)) {
        this.lockedFormat = 'epochMillis'
        return new Date(value)
      }
      throw new Error(
        `Cannot detect timestamp format: number value ${value} is outside valid epoch millis range (0, ${EPOCH_MILLIS_UPPER_BOUND})`
      )
    }

    const typeDescription = value === undefined ? 'undefined' : `${typeof value}`
    throw new Error(
      `Cannot detect timestamp format: expected string or number, got ${typeDescription}`
    )
  }

  /**
   * Parse a timestamp value using the locked format.
   * Returns ParseResult -- failures go to unparseable panel.
   * Throws if called before detectAndLock.
   */
  parse(value: unknown): ParseResult<Date> {
    if (this.lockedFormat === null) {
      throw new Error('TimestampDetector.parse() called before detectAndLock()')
    }

    if (this.lockedFormat === 'iso8601') {
      if (typeof value !== 'string') {
        return { ok: false, error: `Expected string for iso8601 format, got ${typeof value}` }
      }
      const date = TimestampDetector.tryParseIso8601(value)
      if (date === null) {
        return { ok: false, error: `Invalid ISO 8601 date string: "${value}"` }
      }
      return { ok: true, value: date }
    }

    // lockedFormat === 'epochMillis'
    if (typeof value !== 'number') {
      return { ok: false, error: `Expected number for epochMillis format, got ${typeof value}` }
    }
    if (!TimestampDetector.isValidEpochMillis(value)) {
      return {
        ok: false,
        error: `Epoch millis value ${value} is outside valid range (0, ${EPOCH_MILLIS_UPPER_BOUND})`
      }
    }
    return { ok: true, value: new Date(value) }
  }

  /**
   * Returns the currently locked timestamp format, or null if not yet locked.
   */
  getLockedFormat(): TimestampFormat | null {
    return this.lockedFormat
  }

  /**
   * Single source of truth: what constitutes a valid epoch millis value.
   * Valid range is exclusive: (0, EPOCH_MILLIS_UPPER_BOUND).
   */
  private static isValidEpochMillis(value: number): boolean {
    return value > 0 && value < EPOCH_MILLIS_UPPER_BOUND
  }

  /**
   * Single source of truth: how to parse an ISO 8601 string into a Date.
   * Returns the Date on success, or null if the string is not a valid ISO 8601 date.
   */
  private static tryParseIso8601(value: string): Date | null {
    const time = Date.parse(value)
    if (Number.isNaN(time)) {
      return null
    }
    return new Date(time)
  }
}

export { TimestampDetector }
