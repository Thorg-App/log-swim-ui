import type { ParsedLine } from './types'

/**
 * Stateless utility for parsing raw JSON strings into structured results.
 * Returns a discriminated union -- never throws.
 */
class JsonParser {
  /**
   * Parse a raw line as JSON. Returns success with fields if the line is a valid
   * JSON object, or failure with error details otherwise.
   */
  static parse(rawLine: string): ParsedLine {
    let parsed: unknown
    try {
      parsed = JSON.parse(rawLine)
    } catch (e: unknown) {
      const message = e instanceof SyntaxError ? e.message : 'Unknown parse error'
      return { ok: false, rawLine, error: message }
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { ok: false, rawLine, error: 'Parsed value is not a JSON object' }
    }

    // WHY: After eliminating null, arrays, and non-objects above, the remaining
    // type from JSON.parse is a plain object, which is Record<string, unknown>.
    return { ok: true, fields: parsed as Record<string, unknown>, rawJson: rawLine }
  }
}

export { JsonParser }
