// --- CLI Argument Types ---

interface CliArgs {
  readonly keyLevel: string
  readonly keyTimestamp: string
  readonly lanePatterns: readonly string[]
}

// --- Custom Error ---

class CliValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CliValidationError'
  }
}

// --- Known Flags ---

const KNOWN_FLAGS = ['--key-level', '--key-timestamp', '--lanes'] as const

function isKnownFlag(value: string): boolean {
  return (KNOWN_FLAGS as readonly string[]).includes(value)
}

function isFlag(value: string): boolean {
  return value.startsWith('--')
}

// --- CLI Parser ---

/**
 * Hand-rolled CLI argument parser for log-swim-ui.
 * Parses --key-level, --key-timestamp, and --lanes from process.argv.
 *
 * Static class, consistent with JsonParser, LaneClassifier, StdinReader patterns.
 */
class CliParser {
  /**
   * Parse the argv array (expects process.argv.slice(2) -- no node/script path).
   *
   * Required: --key-level <field>, --key-timestamp <field>
   * Optional: --lanes <regex1> <regex2> ... (1+ values until next -- flag or end)
   *
   * Throws CliValidationError on:
   * - Missing required args
   * - Unknown flags
   * - Duplicate flags
   * - --lanes with zero values
   * - Positional args not associated with a flag
   */
  static parse(argv: readonly string[]): CliArgs {
    let keyLevel: string | null = null
    let keyTimestamp: string | null = null
    let lanePatterns: string[] | null = null

    let i = 0
    while (i < argv.length) {
      const arg = argv[i]

      if (!isFlag(arg)) {
        throw new CliValidationError(`Unexpected positional argument: "${arg}"`)
      }

      if (!isKnownFlag(arg)) {
        throw new CliValidationError(`Unknown flag: "${arg}"`)
      }

      if (arg === '--key-level') {
        if (keyLevel !== null) {
          throw new CliValidationError('Duplicate flag: --key-level')
        }
        i++
        if (i >= argv.length || isFlag(argv[i])) {
          throw new CliValidationError('--key-level requires a value')
        }
        keyLevel = argv[i]
        i++
        continue
      }

      if (arg === '--key-timestamp') {
        if (keyTimestamp !== null) {
          throw new CliValidationError('Duplicate flag: --key-timestamp')
        }
        i++
        if (i >= argv.length || isFlag(argv[i])) {
          throw new CliValidationError('--key-timestamp requires a value')
        }
        keyTimestamp = argv[i]
        i++
        continue
      }

      if (arg === '--lanes') {
        if (lanePatterns !== null) {
          throw new CliValidationError('Duplicate flag: --lanes')
        }
        lanePatterns = []
        i++
        while (i < argv.length && !isFlag(argv[i])) {
          lanePatterns.push(argv[i])
          i++
        }
        if (lanePatterns.length === 0) {
          throw new CliValidationError('--lanes requires at least one pattern')
        }
        continue
      }

      // Should not reach here due to isKnownFlag check above
      i++
    }

    if (keyLevel === null) {
      throw new CliValidationError('Missing required flag: --key-level')
    }
    if (keyTimestamp === null) {
      throw new CliValidationError('Missing required flag: --key-timestamp')
    }

    return {
      keyLevel,
      keyTimestamp,
      lanePatterns: lanePatterns ?? []
    }
  }

  /**
   * Returns the usage message string for display on error or help.
   */
  static formatUsage(): string {
    return [
      'Usage:',
      '  cat logs.json | log-swim-ui --key-level <field> --key-timestamp <field> [--lanes <regex> ...]',
      '',
      'Example:',
      '  kubectl logs my-pod | log-swim-ui --key-level level --key-timestamp timestamp --lanes "error|ERROR|fatal" "auth"'
    ].join('\n')
  }
}

export { CliParser, CliValidationError }
export type { CliArgs }
