import { describe, it, expect } from 'vitest'
import { CliParser, CliValidationError } from '../../../src/main/cli-parser'

describe('CliParser.parse', () => {
  describe('GIVEN valid argv with all required args', () => {
    describe('WHEN --key-level and --key-timestamp are provided', () => {
      it('THEN returns keyLevel from the argv', () => {
        const result = CliParser.parse(['--key-level', 'level', '--key-timestamp', 'ts'])
        expect(result.keyLevel).toBe('level')
      })

      it('THEN returns keyTimestamp from the argv', () => {
        const result = CliParser.parse(['--key-level', 'level', '--key-timestamp', 'ts'])
        expect(result.keyTimestamp).toBe('ts')
      })

      it('THEN returns empty lanePatterns when --lanes is not provided', () => {
        const result = CliParser.parse(['--key-level', 'level', '--key-timestamp', 'ts'])
        expect(result.lanePatterns).toEqual([])
      })
    })

    describe('WHEN args are in reverse order', () => {
      it('THEN still parses correctly', () => {
        const result = CliParser.parse(['--key-timestamp', 'ts', '--key-level', 'level'])
        expect(result.keyLevel).toBe('level')
        expect(result.keyTimestamp).toBe('ts')
      })
    })

    describe('WHEN --lanes is provided with multiple values', () => {
      it('THEN lanePatterns contains all values', () => {
        const result = CliParser.parse([
          '--key-level', 'level',
          '--key-timestamp', 'ts',
          '--lanes', 'err', 'auth'
        ])
        expect(result.lanePatterns).toEqual(['err', 'auth'])
      })
    })
  })

  describe('GIVEN --lanes with values followed by another flag', () => {
    describe('WHEN --lanes values appear before --key-level', () => {
      it('THEN lanePatterns captures values up to the next flag', () => {
        const result = CliParser.parse([
          '--lanes', 'a', 'b', 'c',
          '--key-level', 'level',
          '--key-timestamp', 'ts'
        ])
        expect(result.lanePatterns).toEqual(['a', 'b', 'c'])
      })
    })
  })

  describe('GIVEN --lanes at end of argv with one value', () => {
    describe('WHEN parsed', () => {
      it('THEN lanePatterns contains that value', () => {
        const result = CliParser.parse([
          '--key-level', 'level',
          '--key-timestamp', 'ts',
          '--lanes', 'a'
        ])
        expect(result.lanePatterns).toEqual(['a'])
      })
    })
  })

  describe('GIVEN missing --key-level', () => {
    describe('WHEN parsed', () => {
      it('THEN throws CliValidationError', () => {
        expect(() => CliParser.parse(['--key-timestamp', 'ts']))
          .toThrow(CliValidationError)
      })

      it('THEN error message mentions --key-level', () => {
        expect(() => CliParser.parse(['--key-timestamp', 'ts']))
          .toThrow('--key-level')
      })
    })
  })

  describe('GIVEN missing --key-timestamp', () => {
    describe('WHEN parsed', () => {
      it('THEN throws CliValidationError', () => {
        expect(() => CliParser.parse(['--key-level', 'level']))
          .toThrow(CliValidationError)
      })

      it('THEN error message mentions --key-timestamp', () => {
        expect(() => CliParser.parse(['--key-level', 'level']))
          .toThrow('--key-timestamp')
      })
    })
  })

  describe('GIVEN --lanes immediately followed by another flag', () => {
    describe('WHEN parsed', () => {
      it('THEN throws CliValidationError', () => {
        expect(() => CliParser.parse([
          '--lanes', '--key-level', 'level', '--key-timestamp', 'ts'
        ])).toThrow(CliValidationError)
      })

      it('THEN error message mentions --lanes requires a pattern', () => {
        expect(() => CliParser.parse([
          '--lanes', '--key-level', 'level', '--key-timestamp', 'ts'
        ])).toThrow('--lanes requires at least one pattern')
      })
    })
  })

  describe('GIVEN --lanes at end of argv with no values after it', () => {
    describe('WHEN parsed', () => {
      it('THEN throws CliValidationError', () => {
        expect(() => CliParser.parse([
          '--key-level', 'level', '--key-timestamp', 'ts', '--lanes'
        ])).toThrow(CliValidationError)
      })

      it('THEN error message mentions --lanes requires a pattern', () => {
        expect(() => CliParser.parse([
          '--key-level', 'level', '--key-timestamp', 'ts', '--lanes'
        ])).toThrow('--lanes requires at least one pattern')
      })
    })
  })

  describe('GIVEN an unknown flag', () => {
    describe('WHEN parsed', () => {
      it('THEN throws CliValidationError', () => {
        expect(() => CliParser.parse([
          '--key-level', 'level', '--key-timestamp', 'ts', '--unknown-flag'
        ])).toThrow(CliValidationError)
      })

      it('THEN error message identifies the unknown flag', () => {
        expect(() => CliParser.parse([
          '--key-level', 'level', '--key-timestamp', 'ts', '--unknown-flag'
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

  describe('GIVEN duplicate --key-level flags', () => {
    describe('WHEN parsed', () => {
      it('THEN throws CliValidationError', () => {
        expect(() => CliParser.parse([
          '--key-level', 'a', '--key-level', 'b', '--key-timestamp', 'ts'
        ])).toThrow(CliValidationError)
      })

      it('THEN error message mentions duplicate', () => {
        expect(() => CliParser.parse([
          '--key-level', 'a', '--key-level', 'b', '--key-timestamp', 'ts'
        ])).toThrow('Duplicate flag: --key-level')
      })
    })
  })

  describe('GIVEN duplicate --key-timestamp flags', () => {
    describe('WHEN parsed', () => {
      it('THEN throws CliValidationError', () => {
        expect(() => CliParser.parse([
          '--key-level', 'level', '--key-timestamp', 'a', '--key-timestamp', 'b'
        ])).toThrow(CliValidationError)
      })
    })
  })

  describe('GIVEN duplicate --lanes flags', () => {
    describe('WHEN parsed', () => {
      it('THEN throws CliValidationError', () => {
        expect(() => CliParser.parse([
          '--key-level', 'level', '--key-timestamp', 'ts',
          '--lanes', 'a', '--lanes', 'b'
        ])).toThrow(CliValidationError)
      })
    })
  })

  describe('GIVEN a positional argument not associated with a flag', () => {
    describe('WHEN parsed', () => {
      it('THEN throws CliValidationError', () => {
        expect(() => CliParser.parse([
          'foo', '--key-level', 'level', '--key-timestamp', 'ts'
        ])).toThrow(CliValidationError)
      })

      it('THEN error message identifies the positional argument', () => {
        expect(() => CliParser.parse([
          'foo', '--key-level', 'level', '--key-timestamp', 'ts'
        ])).toThrow('Unexpected positional argument: "foo"')
      })
    })
  })

  describe('GIVEN --key-level with no value (followed by another flag)', () => {
    describe('WHEN parsed', () => {
      it('THEN throws CliValidationError', () => {
        expect(() => CliParser.parse([
          '--key-level', '--key-timestamp', 'ts'
        ])).toThrow(CliValidationError)
      })

      it('THEN error message mentions --key-level requires a value', () => {
        expect(() => CliParser.parse([
          '--key-level', '--key-timestamp', 'ts'
        ])).toThrow('--key-level requires a value')
      })
    })
  })

  describe('GIVEN --key-timestamp with no value (at end of argv)', () => {
    describe('WHEN parsed', () => {
      it('THEN throws CliValidationError', () => {
        expect(() => CliParser.parse([
          '--key-level', 'level', '--key-timestamp'
        ])).toThrow(CliValidationError)
      })

      it('THEN error message mentions --key-timestamp requires a value', () => {
        expect(() => CliParser.parse([
          '--key-level', 'level', '--key-timestamp'
        ])).toThrow('--key-timestamp requires a value')
      })
    })
  })
})

describe('CliParser.formatUsage', () => {
  describe('WHEN called', () => {
    it('THEN contains "Usage:"', () => {
      expect(CliParser.formatUsage()).toContain('Usage:')
    })

    it('THEN contains --key-level', () => {
      expect(CliParser.formatUsage()).toContain('--key-level')
    })

    it('THEN contains --key-timestamp', () => {
      expect(CliParser.formatUsage()).toContain('--key-timestamp')
    })

    it('THEN contains --lanes', () => {
      expect(CliParser.formatUsage()).toContain('--lanes')
    })

    it('THEN contains an example', () => {
      expect(CliParser.formatUsage()).toContain('Example:')
    })
  })
})
