import { describe, it, expect } from 'vitest'
import { CliParser, CliValidationError } from '../../../src/main/cli-parser'

describe('CliParser.parse', () => {
  describe('GIVEN valid argv with all required args', () => {
    describe('WHEN --input_key.level and --input_key.timestamp are provided', () => {
      it('THEN returns inputKeyLevel from the argv', () => {
        const result = CliParser.parse(['--input_key.level', 'level', '--input_key.timestamp', 'ts'])
        expect(result.inputKeyLevel).toBe('level')
      })

      it('THEN returns inputKeyTimestamp from the argv', () => {
        const result = CliParser.parse(['--input_key.level', 'level', '--input_key.timestamp', 'ts'])
        expect(result.inputKeyTimestamp).toBe('ts')
      })

      it('THEN returns empty filterColumnPatterns when --regexes_for_filter_columns is not provided', () => {
        const result = CliParser.parse(['--input_key.level', 'level', '--input_key.timestamp', 'ts'])
        expect(result.filterColumnPatterns).toEqual([])
      })
    })

    describe('WHEN args are in reverse order', () => {
      it('THEN still parses correctly', () => {
        const result = CliParser.parse(['--input_key.timestamp', 'ts', '--input_key.level', 'level'])
        expect(result.inputKeyLevel).toBe('level')
        expect(result.inputKeyTimestamp).toBe('ts')
      })
    })

    describe('WHEN --regexes_for_filter_columns is provided with multiple values', () => {
      it('THEN filterColumnPatterns contains all values', () => {
        const result = CliParser.parse([
          '--input_key.level', 'level',
          '--input_key.timestamp', 'ts',
          '--regexes_for_filter_columns', 'err', 'auth'
        ])
        expect(result.filterColumnPatterns).toEqual(['err', 'auth'])
      })
    })
  })

  describe('GIVEN --regexes_for_filter_columns with values followed by another flag', () => {
    describe('WHEN --regexes_for_filter_columns values appear before --input_key.level', () => {
      it('THEN filterColumnPatterns captures values up to the next flag', () => {
        const result = CliParser.parse([
          '--regexes_for_filter_columns', 'a', 'b', 'c',
          '--input_key.level', 'level',
          '--input_key.timestamp', 'ts'
        ])
        expect(result.filterColumnPatterns).toEqual(['a', 'b', 'c'])
      })
    })
  })

  describe('GIVEN --regexes_for_filter_columns at end of argv with one value', () => {
    describe('WHEN parsed', () => {
      it('THEN filterColumnPatterns contains that value', () => {
        const result = CliParser.parse([
          '--input_key.level', 'level',
          '--input_key.timestamp', 'ts',
          '--regexes_for_filter_columns', 'a'
        ])
        expect(result.filterColumnPatterns).toEqual(['a'])
      })
    })
  })

  describe('GIVEN missing --input_key.level', () => {
    describe('WHEN parsed', () => {
      it('THEN throws CliValidationError', () => {
        expect(() => CliParser.parse(['--input_key.timestamp', 'ts']))
          .toThrow(CliValidationError)
      })

      it('THEN error message mentions --input_key.level', () => {
        expect(() => CliParser.parse(['--input_key.timestamp', 'ts']))
          .toThrow('--input_key.level')
      })
    })
  })

  describe('GIVEN missing --input_key.timestamp', () => {
    describe('WHEN parsed', () => {
      it('THEN throws CliValidationError', () => {
        expect(() => CliParser.parse(['--input_key.level', 'level']))
          .toThrow(CliValidationError)
      })

      it('THEN error message mentions --input_key.timestamp', () => {
        expect(() => CliParser.parse(['--input_key.level', 'level']))
          .toThrow('--input_key.timestamp')
      })
    })
  })

  describe('GIVEN --regexes_for_filter_columns immediately followed by another flag', () => {
    describe('WHEN parsed', () => {
      it('THEN throws CliValidationError', () => {
        expect(() => CliParser.parse([
          '--regexes_for_filter_columns', '--input_key.level', 'level', '--input_key.timestamp', 'ts'
        ])).toThrow(CliValidationError)
      })

      it('THEN error message mentions --regexes_for_filter_columns requires a pattern', () => {
        expect(() => CliParser.parse([
          '--regexes_for_filter_columns', '--input_key.level', 'level', '--input_key.timestamp', 'ts'
        ])).toThrow('--regexes_for_filter_columns requires at least one pattern')
      })
    })
  })

  describe('GIVEN --regexes_for_filter_columns at end of argv with no values after it', () => {
    describe('WHEN parsed', () => {
      it('THEN throws CliValidationError', () => {
        expect(() => CliParser.parse([
          '--input_key.level', 'level', '--input_key.timestamp', 'ts', '--regexes_for_filter_columns'
        ])).toThrow(CliValidationError)
      })

      it('THEN error message mentions --regexes_for_filter_columns requires a pattern', () => {
        expect(() => CliParser.parse([
          '--input_key.level', 'level', '--input_key.timestamp', 'ts', '--regexes_for_filter_columns'
        ])).toThrow('--regexes_for_filter_columns requires at least one pattern')
      })
    })
  })

  describe('GIVEN an unknown flag', () => {
    describe('WHEN parsed', () => {
      it('THEN throws CliValidationError', () => {
        expect(() => CliParser.parse([
          '--input_key.level', 'level', '--input_key.timestamp', 'ts', '--unknown-flag'
        ])).toThrow(CliValidationError)
      })

      it('THEN error message identifies the unknown flag', () => {
        expect(() => CliParser.parse([
          '--input_key.level', 'level', '--input_key.timestamp', 'ts', '--unknown-flag'
        ])).toThrow('Unknown flag: "--unknown-flag"')
      })
    })
  })

  describe('GIVEN empty argv', () => {
    describe('WHEN parsed', () => {
      it('THEN throws CliValidationError', () => {
        expect(() => CliParser.parse([])).toThrow(CliValidationError)
      })
    })
  })

  describe('GIVEN duplicate --input_key.level flags', () => {
    describe('WHEN parsed', () => {
      it('THEN throws CliValidationError', () => {
        expect(() => CliParser.parse([
          '--input_key.level', 'a', '--input_key.level', 'b', '--input_key.timestamp', 'ts'
        ])).toThrow(CliValidationError)
      })

      it('THEN error message mentions duplicate', () => {
        expect(() => CliParser.parse([
          '--input_key.level', 'a', '--input_key.level', 'b', '--input_key.timestamp', 'ts'
        ])).toThrow('Duplicate flag: --input_key.level')
      })
    })
  })

  describe('GIVEN duplicate --input_key.timestamp flags', () => {
    describe('WHEN parsed', () => {
      it('THEN throws CliValidationError', () => {
        expect(() => CliParser.parse([
          '--input_key.level', 'level', '--input_key.timestamp', 'a', '--input_key.timestamp', 'b'
        ])).toThrow(CliValidationError)
      })
    })
  })

  describe('GIVEN duplicate --regexes_for_filter_columns flags', () => {
    describe('WHEN parsed', () => {
      it('THEN throws CliValidationError', () => {
        expect(() => CliParser.parse([
          '--input_key.level', 'level', '--input_key.timestamp', 'ts',
          '--regexes_for_filter_columns', 'a', '--regexes_for_filter_columns', 'b'
        ])).toThrow(CliValidationError)
      })
    })
  })

  describe('GIVEN a positional argument not associated with a flag', () => {
    describe('WHEN parsed', () => {
      it('THEN throws CliValidationError', () => {
        expect(() => CliParser.parse([
          'foo', '--input_key.level', 'level', '--input_key.timestamp', 'ts'
        ])).toThrow(CliValidationError)
      })

      it('THEN error message identifies the positional argument', () => {
        expect(() => CliParser.parse([
          'foo', '--input_key.level', 'level', '--input_key.timestamp', 'ts'
        ])).toThrow('Unexpected positional argument: "foo"')
      })
    })
  })

  describe('GIVEN --input_key.level with no value (followed by another flag)', () => {
    describe('WHEN parsed', () => {
      it('THEN throws CliValidationError', () => {
        expect(() => CliParser.parse([
          '--input_key.level', '--input_key.timestamp', 'ts'
        ])).toThrow(CliValidationError)
      })

      it('THEN error message mentions --input_key.level requires a value', () => {
        expect(() => CliParser.parse([
          '--input_key.level', '--input_key.timestamp', 'ts'
        ])).toThrow('--input_key.level requires a value')
      })
    })
  })

  describe('GIVEN --input_key.timestamp with no value (at end of argv)', () => {
    describe('WHEN parsed', () => {
      it('THEN throws CliValidationError', () => {
        expect(() => CliParser.parse([
          '--input_key.level', 'level', '--input_key.timestamp'
        ])).toThrow(CliValidationError)
      })

      it('THEN error message mentions --input_key.timestamp requires a value', () => {
        expect(() => CliParser.parse([
          '--input_key.level', 'level', '--input_key.timestamp'
        ])).toThrow('--input_key.timestamp requires a value')
      })
    })
  })
})

describe('CliParser.formatUsage', () => {
  describe('WHEN called', () => {
    it('THEN contains "Usage:"', () => {
      expect(CliParser.formatUsage()).toContain('Usage:')
    })

    it('THEN contains --input_key.level', () => {
      expect(CliParser.formatUsage()).toContain('--input_key.level')
    })

    it('THEN contains --input_key.timestamp', () => {
      expect(CliParser.formatUsage()).toContain('--input_key.timestamp')
    })

    it('THEN contains --regexes_for_filter_columns', () => {
      expect(CliParser.formatUsage()).toContain('--regexes_for_filter_columns')
    })

    it('THEN contains an example', () => {
      expect(CliParser.formatUsage()).toContain('Example:')
    })
  })
})
