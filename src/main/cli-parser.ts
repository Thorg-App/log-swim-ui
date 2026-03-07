import type { CliArgsResult } from '../core/types'

// --- Custom Error ---

class CliValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CliValidationError'
  }
}

// --- Known Flags ---

const KNOWN_FLAGS = ['--input_key.level', '--input_key.timestamp', '--regexes_for_filter_columns'] as const

function isKnownFlag(value: string): boolean {
  return (KNOWN_FLAGS as readonly string[]).includes(value)
}

function isFlag(value: string): boolean {
  return value.startsWith('--')
}

// --- CLI Parser ---

/**
 * Hand-rolled CLI argument parser for log-swim-ui.
 * Parses --input_key.level, --input_key.timestamp, and --regexes_for_filter_columns from process.argv.
 *
 * Static class, consistent with JsonParser, LaneClassifier, StdinReader patterns.
 */
class CliParser {
  /**
   * Parse the argv array (expects process.argv.slice(2) -- no node/script path).
   *
   * Required: --input_key.level <field>, --input_key.timestamp <field>
   * Optional: --regexes_for_filter_columns <regex1> <regex2> ... (1+ values until next -- flag or end)
   *
   * Throws CliValidationError on:
   * - Missing required args
   * - Unknown flags
   * - Duplicate flags
   * - --regexes_for_filter_columns with zero values
   * - Positional args not associated with a flag
   */
  static parse(argv: readonly string[]): CliArgsResult {
    let inputKeyLevel: string | null = null
    let inputKeyTimestamp: string | null = null
    let filterColumnPatterns: string[] | null = null

    let i = 0
    while (i < argv.length) {
      const arg = argv[i]

      if (!isFlag(arg)) {
        throw new CliValidationError(`Unexpected positional argument: "${arg}"`)
      }

      if (!isKnownFlag(arg)) {
        throw new CliValidationError(`Unknown flag: "${arg}"`)
      }

      if (arg === '--input_key.level') {
        if (inputKeyLevel !== null) {
          throw new CliValidationError('Duplicate flag: --input_key.level')
        }
        i++
        if (i >= argv.length || isFlag(argv[i])) {
          throw new CliValidationError('--input_key.level requires a value')
        }
        inputKeyLevel = argv[i]
        i++
        continue
      }

      if (arg === '--input_key.timestamp') {
        if (inputKeyTimestamp !== null) {
          throw new CliValidationError('Duplicate flag: --input_key.timestamp')
        }
        i++
        if (i >= argv.length || isFlag(argv[i])) {
          throw new CliValidationError('--input_key.timestamp requires a value')
        }
        inputKeyTimestamp = argv[i]
        i++
        continue
      }

      if (arg === '--regexes_for_filter_columns') {
        if (filterColumnPatterns !== null) {
          throw new CliValidationError('Duplicate flag: --regexes_for_filter_columns')
        }
        filterColumnPatterns = []
        i++
        while (i < argv.length && !isFlag(argv[i])) {
          filterColumnPatterns.push(argv[i])
          i++
        }
        if (filterColumnPatterns.length === 0) {
          throw new CliValidationError('--regexes_for_filter_columns requires at least one pattern')
        }
        continue
      }

      // Should not reach here due to isKnownFlag check above
      i++
    }

    if (inputKeyLevel === null) {
      throw new CliValidationError('Missing required flag: --input_key.level')
    }
    if (inputKeyTimestamp === null) {
      throw new CliValidationError('Missing required flag: --input_key.timestamp')
    }

    return {
      inputKeyLevel,
      inputKeyTimestamp,
      filterColumnPatterns: filterColumnPatterns ?? []
    }
  }

  /**
   * Returns the usage message string for display on error or help.
   */
  static formatUsage(): string {
    return [
      'Usage:',
      '  cat logs.json | log-swim-ui --input_key.level <field> --input_key.timestamp <field> [--regexes_for_filter_columns <regex> ...]',
      '',
      'Example:',
      '  kubectl logs my-pod | log-swim-ui --input_key.level level --input_key.timestamp timestamp --regexes_for_filter_columns "error|ERROR|fatal" "auth"'
    ].join('\n')
  }
}

export { CliParser, CliValidationError }
