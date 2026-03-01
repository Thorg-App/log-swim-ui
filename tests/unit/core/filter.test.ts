import { describe, it, expect, beforeEach } from 'vitest'
import { FilterEngine } from '@core/filter'
import type { Filter } from '@core/filter'
import type { LogEntry } from '@core/types'

/**
 * Helper to create a minimal LogEntry for testing.
 */
function makeEntry(
  rawJson: string,
  fields: Record<string, unknown> = {},
  level: string = ''
): LogEntry {
  return {
    rawJson,
    fields,
    timestamp: new Date(),
    level,
    laneIndex: 0
  }
}

beforeEach(() => {
  FilterEngine.resetIdCounter()
})

// --- createRawFilter ---

describe('FilterEngine.createRawFilter', () => {
  describe('GIVEN a valid regex pattern', () => {
    describe('WHEN createRawFilter is called', () => {
      it('THEN returns a filter with compiled regex', () => {
        const filter = FilterEngine.createRawFilter('error')

        expect(filter.type).toBe('raw')
        expect(filter.pattern).toBe('error')
        expect(filter.regex).toBeInstanceOf(RegExp)
        expect(filter.enabled).toBe(true)
      })

      it('THEN assigns a unique id', () => {
        const filter = FilterEngine.createRawFilter('error')

        expect(filter.id).toBe('filter-0')
      })
    })
  })

  describe('GIVEN an invalid regex pattern', () => {
    describe('WHEN createRawFilter is called', () => {
      it('THEN returns a filter with regex: null', () => {
        const filter = FilterEngine.createRawFilter('[invalid')

        expect(filter.type).toBe('raw')
        expect(filter.pattern).toBe('[invalid')
        expect(filter.regex).toBeNull()
        expect(filter.enabled).toBe(true)
      })
    })
  })

  describe('GIVEN multiple filters created in sequence', () => {
    describe('WHEN createRawFilter is called twice', () => {
      it('THEN each filter gets a unique incrementing id', () => {
        const filter1 = FilterEngine.createRawFilter('error')
        const filter2 = FilterEngine.createRawFilter('warn')

        expect(filter1.id).toBe('filter-0')
        expect(filter2.id).toBe('filter-1')
      })
    })
  })
})

// --- createFieldFilter ---

describe('FilterEngine.createFieldFilter', () => {
  describe('GIVEN a field name and valid regex pattern', () => {
    describe('WHEN createFieldFilter is called', () => {
      it('THEN returns a FieldFilter with correct properties', () => {
        const filter = FilterEngine.createFieldFilter('level', 'warn')

        expect(filter.type).toBe('field')
        expect(filter.field).toBe('level')
        expect(filter.pattern).toBe('warn')
        expect(filter.regex).toBeInstanceOf(RegExp)
        expect(filter.enabled).toBe(true)
      })
    })
  })

  describe('GIVEN a field name and invalid regex pattern', () => {
    describe('WHEN createFieldFilter is called', () => {
      it('THEN returns a FieldFilter with regex: null', () => {
        const filter = FilterEngine.createFieldFilter('level', '(unclosed')

        expect(filter.type).toBe('field')
        expect(filter.field).toBe('level')
        expect(filter.regex).toBeNull()
      })
    })
  })
})

// --- toggleFilter ---

describe('FilterEngine.toggleFilter', () => {
  describe('GIVEN an enabled filter', () => {
    describe('WHEN toggleFilter is called', () => {
      it('THEN returns a new filter with enabled: false', () => {
        const original = FilterEngine.createRawFilter('error')
        const toggled = FilterEngine.toggleFilter(original)

        expect(toggled.enabled).toBe(false)
        expect(original.enabled).toBe(true) // original is unchanged (immutable)
      })
    })
  })

  describe('GIVEN a disabled filter', () => {
    describe('WHEN toggleFilter is called', () => {
      it('THEN returns a new filter with enabled: true', () => {
        const original = FilterEngine.toggleFilter(FilterEngine.createRawFilter('error'))
        expect(original.enabled).toBe(false)

        const toggled = FilterEngine.toggleFilter(original)

        expect(toggled.enabled).toBe(true)
      })
    })
  })

  describe('GIVEN a FieldFilter', () => {
    describe('WHEN toggleFilter is called', () => {
      it('THEN preserves all properties except enabled', () => {
        const original = FilterEngine.createFieldFilter('level', 'warn')
        const toggled = FilterEngine.toggleFilter(original)

        expect(toggled.id).toBe(original.id)
        expect(toggled.type).toBe('field')
        if (toggled.type === 'field') {
          expect(toggled.field).toBe('level')
        }
        expect(toggled.pattern).toBe('warn')
        expect(toggled.regex).toEqual(original.regex)
        expect(toggled.enabled).toBe(false)
      })
    })
  })
})

// --- matchesFilter ---

describe('FilterEngine.matchesFilter', () => {
  describe('GIVEN a raw filter with pattern "error"', () => {
    const filter = FilterEngine.createRawFilter('error')

    describe('WHEN matched against entry containing "error" in rawJson', () => {
      it('THEN returns true', () => {
        const entry = makeEntry('{"level":"error","msg":"something failed"}')
        expect(FilterEngine.matchesFilter(entry, filter)).toBe(true)
      })
    })

    describe('WHEN matched against entry without "error" in rawJson', () => {
      it('THEN returns false', () => {
        const entry = makeEntry('{"level":"info","msg":"all good"}')
        expect(FilterEngine.matchesFilter(entry, filter)).toBe(false)
      })
    })
  })

  describe('GIVEN a field filter on "level" with pattern "warn"', () => {
    describe('WHEN matched against entry with level field "warning"', () => {
      it('THEN returns true (regex match on substring)', () => {
        const filter = FilterEngine.createFieldFilter('level', 'warn')
        const entry = makeEntry('{"level":"warning"}', { level: 'warning' }, 'warning')

        expect(FilterEngine.matchesFilter(entry, filter)).toBe(true)
      })
    })

    describe('WHEN matched against entry with level field "info"', () => {
      it('THEN returns false', () => {
        const filter = FilterEngine.createFieldFilter('level', 'warn')
        const entry = makeEntry('{"level":"info"}', { level: 'info' }, 'info')

        expect(FilterEngine.matchesFilter(entry, filter)).toBe(false)
      })
    })
  })

  describe('GIVEN a field filter on a non-existent field', () => {
    describe('WHEN matched against entry without that field', () => {
      it('THEN tests against empty string', () => {
        const filter = FilterEngine.createFieldFilter('missing_field', 'value')
        const entry = makeEntry('{"level":"info"}', { level: 'info' })

        expect(FilterEngine.matchesFilter(entry, filter)).toBe(false)
      })
    })
  })

  describe('GIVEN a field filter on a non-existent field with pattern matching empty string', () => {
    describe('WHEN matched', () => {
      it('THEN returns true (regex matches empty string)', () => {
        // Pattern ".*" matches empty string
        const filter = FilterEngine.createFieldFilter('missing_field', '.*')
        const entry = makeEntry('{"level":"info"}', { level: 'info' })

        expect(FilterEngine.matchesFilter(entry, filter)).toBe(true)
      })
    })
  })

  describe('GIVEN a filter with null regex (invalid pattern)', () => {
    describe('WHEN matchesFilter is called', () => {
      it('THEN returns false', () => {
        const filter = FilterEngine.createRawFilter('[invalid')
        const entry = makeEntry('{"level":"error"}')

        expect(filter.regex).toBeNull()
        expect(FilterEngine.matchesFilter(entry, filter)).toBe(false)
      })
    })
  })

  describe('GIVEN a raw filter with a complex regex pattern', () => {
    describe('WHEN matched against entry matching the pattern', () => {
      it('THEN returns true', () => {
        const filter = FilterEngine.createRawFilter('error|ERROR')
        const entry = makeEntry('{"level":"ERROR","msg":"fail"}')

        expect(FilterEngine.matchesFilter(entry, filter)).toBe(true)
      })
    })
  })

  describe('GIVEN a field filter with a numeric field value', () => {
    describe('WHEN matched', () => {
      it('THEN converts value to string before testing', () => {
        const filter = FilterEngine.createFieldFilter('status', '500')
        const entry = makeEntry('{"status":500}', { status: 500 })

        expect(FilterEngine.matchesFilter(entry, filter)).toBe(true)
      })
    })
  })
})

// --- matchesAllFilters ---

describe('FilterEngine.matchesAllFilters', () => {
  describe('GIVEN zero active filters', () => {
    describe('WHEN matchesAllFilters is called', () => {
      it('THEN returns true (vacuous truth)', () => {
        const entry = makeEntry('{"level":"info"}')
        const filters: readonly Filter[] = []

        expect(FilterEngine.matchesAllFilters(entry, filters)).toBe(true)
      })
    })
  })

  describe('GIVEN two enabled filters that both match', () => {
    describe('WHEN matchesAllFilters is called', () => {
      it('THEN returns true', () => {
        const entry = makeEntry('{"level":"error","msg":"auth failed"}', {
          level: 'error',
          msg: 'auth failed'
        })
        const filters: readonly Filter[] = [
          FilterEngine.createRawFilter('error'),
          FilterEngine.createRawFilter('auth')
        ]

        expect(FilterEngine.matchesAllFilters(entry, filters)).toBe(true)
      })
    })
  })

  describe('GIVEN two enabled filters where one does not match', () => {
    describe('WHEN matchesAllFilters is called', () => {
      it('THEN returns false (AND logic)', () => {
        const entry = makeEntry('{"level":"error","msg":"something"}', {
          level: 'error',
          msg: 'something'
        })
        const filters: readonly Filter[] = [
          FilterEngine.createRawFilter('error'),
          FilterEngine.createRawFilter('auth') // does not match
        ]

        expect(FilterEngine.matchesAllFilters(entry, filters)).toBe(false)
      })
    })
  })

  describe('GIVEN a disabled filter that would not match and an enabled filter that matches', () => {
    describe('WHEN matchesAllFilters is called', () => {
      it('THEN returns true (disabled filter is skipped)', () => {
        const entry = makeEntry('{"level":"error","msg":"something"}', {
          level: 'error'
        })
        const disabledFilter = FilterEngine.toggleFilter(
          FilterEngine.createRawFilter('auth')
        )
        const enabledFilter = FilterEngine.createRawFilter('error')
        const filters: readonly Filter[] = [disabledFilter, enabledFilter]

        expect(disabledFilter.enabled).toBe(false)
        expect(FilterEngine.matchesAllFilters(entry, filters)).toBe(true)
      })
    })
  })

  describe('GIVEN a filter with null regex (invalid pattern)', () => {
    describe('WHEN matchesAllFilters is called', () => {
      it('THEN the invalid filter is skipped (entry passes)', () => {
        const entry = makeEntry('{"level":"error"}')
        const invalidFilter = FilterEngine.createRawFilter('[invalid')
        const filters: readonly Filter[] = [invalidFilter]

        expect(invalidFilter.regex).toBeNull()
        expect(FilterEngine.matchesAllFilters(entry, filters)).toBe(true)
      })
    })
  })

  describe('GIVEN only disabled filters', () => {
    describe('WHEN matchesAllFilters is called', () => {
      it('THEN returns true (no active filters means vacuous truth)', () => {
        const entry = makeEntry('{"level":"info"}')
        const filters: readonly Filter[] = [
          FilterEngine.toggleFilter(FilterEngine.createRawFilter('error')),
          FilterEngine.toggleFilter(FilterEngine.createFieldFilter('level', 'fatal'))
        ]

        expect(FilterEngine.matchesAllFilters(entry, filters)).toBe(true)
      })
    })
  })

  describe('GIVEN a mix of field and raw filters that all match', () => {
    describe('WHEN matchesAllFilters is called', () => {
      it('THEN returns true', () => {
        const entry = makeEntry(
          '{"level":"error","service":"auth","msg":"login failed"}',
          { level: 'error', service: 'auth', msg: 'login failed' },
          'error'
        )
        const filters: readonly Filter[] = [
          FilterEngine.createRawFilter('login'),
          FilterEngine.createFieldFilter('level', 'error'),
          FilterEngine.createFieldFilter('service', 'auth')
        ]

        expect(FilterEngine.matchesAllFilters(entry, filters)).toBe(true)
      })
    })
  })

  describe('GIVEN a mix of field and raw filters where a field filter does not match', () => {
    describe('WHEN matchesAllFilters is called', () => {
      it('THEN returns false', () => {
        const entry = makeEntry(
          '{"level":"error","service":"payment","msg":"timeout"}',
          { level: 'error', service: 'payment', msg: 'timeout' },
          'error'
        )
        const filters: readonly Filter[] = [
          FilterEngine.createRawFilter('error'),
          FilterEngine.createFieldFilter('service', 'auth') // does not match "payment"
        ]

        expect(FilterEngine.matchesAllFilters(entry, filters)).toBe(false)
      })
    })
  })
})

// --- Default mode and caseSensitive ---

describe('FilterEngine default mode and caseSensitive', () => {
  describe('GIVEN createRawFilter is called without options', () => {
    it('THEN defaults to mode=include and caseSensitive=false', () => {
      const filter = FilterEngine.createRawFilter('error')

      expect(filter.mode).toBe('include')
      expect(filter.caseSensitive).toBe(false)
    })

    it('THEN compiles regex with case-insensitive flag', () => {
      const filter = FilterEngine.createRawFilter('error')

      expect(filter.regex).toBeInstanceOf(RegExp)
      expect(filter.regex!.flags).toContain('i')
    })
  })

  describe('GIVEN createFieldFilter is called without options', () => {
    it('THEN defaults to mode=include and caseSensitive=false', () => {
      const filter = FilterEngine.createFieldFilter('level', 'warn')

      expect(filter.mode).toBe('include')
      expect(filter.caseSensitive).toBe(false)
    })
  })

  describe('GIVEN createRawFilter is called with explicit options', () => {
    it('THEN uses provided mode and caseSensitive values', () => {
      const filter = FilterEngine.createRawFilter('error', {
        mode: 'exclude',
        caseSensitive: true
      })

      expect(filter.mode).toBe('exclude')
      expect(filter.caseSensitive).toBe(true)
      expect(filter.regex!.flags).not.toContain('i')
    })
  })

  describe('GIVEN createFieldFilter is called with explicit options', () => {
    it('THEN uses provided mode and caseSensitive values', () => {
      const filter = FilterEngine.createFieldFilter('level', 'warn', {
        mode: 'exclude',
        caseSensitive: true
      })

      expect(filter.mode).toBe('exclude')
      expect(filter.caseSensitive).toBe(true)
    })
  })
})

// --- Case-insensitive matching ---

describe('FilterEngine case-insensitive matching', () => {
  describe('GIVEN a raw filter with pattern "error" and caseSensitive=false (default)', () => {
    describe('WHEN matched against entry with "ERROR" in rawJson', () => {
      it('THEN returns true (case-insensitive match)', () => {
        const filter = FilterEngine.createRawFilter('error')
        const entry = makeEntry('{"level":"ERROR","msg":"FAIL"}')

        expect(FilterEngine.matchesFilter(entry, filter)).toBe(true)
      })
    })
  })

  describe('GIVEN a raw filter with pattern "error" and caseSensitive=true', () => {
    describe('WHEN matched against entry with "ERROR" in rawJson', () => {
      it('THEN returns false (case-sensitive match)', () => {
        const filter = FilterEngine.createRawFilter('error', { caseSensitive: true })
        const entry = makeEntry('{"level":"ERROR","msg":"FAIL"}')

        expect(FilterEngine.matchesFilter(entry, filter)).toBe(false)
      })
    })

    describe('WHEN matched against entry with "error" in rawJson', () => {
      it('THEN returns true', () => {
        const filter = FilterEngine.createRawFilter('error', { caseSensitive: true })
        const entry = makeEntry('{"level":"error","msg":"fail"}')

        expect(FilterEngine.matchesFilter(entry, filter)).toBe(true)
      })
    })
  })

  describe('GIVEN a field filter with caseSensitive=false (default)', () => {
    describe('WHEN matched against entry with different-case field value', () => {
      it('THEN returns true (case-insensitive match)', () => {
        const filter = FilterEngine.createFieldFilter('level', 'warn')
        const entry = makeEntry('{"level":"WARNING"}', { level: 'WARNING' }, 'WARNING')

        expect(FilterEngine.matchesFilter(entry, filter)).toBe(true)
      })
    })
  })

  describe('GIVEN a field filter with caseSensitive=true', () => {
    describe('WHEN matched against entry with different-case field value', () => {
      it('THEN returns false (case-sensitive match)', () => {
        const filter = FilterEngine.createFieldFilter('level', 'warn', { caseSensitive: true })
        const entry = makeEntry('{"level":"WARNING"}', { level: 'WARNING' }, 'WARNING')

        expect(FilterEngine.matchesFilter(entry, filter)).toBe(false)
      })
    })
  })
})

// --- Exclude mode ---

describe('FilterEngine exclude mode', () => {
  describe('GIVEN a raw exclude filter with pattern "error"', () => {
    const filter = FilterEngine.createRawFilter('error', { mode: 'exclude' })

    describe('WHEN matched against entry containing "error" in rawJson', () => {
      it('THEN returns false (exclude inverts the match)', () => {
        const entry = makeEntry('{"level":"error","msg":"something failed"}')

        expect(FilterEngine.matchesFilter(entry, filter)).toBe(false)
      })
    })

    describe('WHEN matched against entry without "error" in rawJson', () => {
      it('THEN returns true (exclude inverts the non-match)', () => {
        const entry = makeEntry('{"level":"info","msg":"all good"}')

        expect(FilterEngine.matchesFilter(entry, filter)).toBe(true)
      })
    })
  })

  describe('GIVEN a field exclude filter on "level" with pattern "debug"', () => {
    describe('WHEN matched against entry with level "debug"', () => {
      it('THEN returns false (exclude mode)', () => {
        const filter = FilterEngine.createFieldFilter('level', 'debug', { mode: 'exclude' })
        const entry = makeEntry('{"level":"debug"}', { level: 'debug' }, 'debug')

        expect(FilterEngine.matchesFilter(entry, filter)).toBe(false)
      })
    })

    describe('WHEN matched against entry with level "info"', () => {
      it('THEN returns true (exclude mode — no match means pass)', () => {
        const filter = FilterEngine.createFieldFilter('level', 'debug', { mode: 'exclude' })
        const entry = makeEntry('{"level":"info"}', { level: 'info' }, 'info')

        expect(FilterEngine.matchesFilter(entry, filter)).toBe(true)
      })
    })
  })

  describe('GIVEN an exclude filter with null regex (invalid pattern)', () => {
    describe('WHEN matchesFilter is called', () => {
      it('THEN returns false (invalid regex never matches, even for exclude)', () => {
        const filter = FilterEngine.createRawFilter('[invalid', { mode: 'exclude' })
        const entry = makeEntry('{"level":"error"}')

        expect(filter.regex).toBeNull()
        expect(FilterEngine.matchesFilter(entry, filter)).toBe(false)
      })
    })
  })
})

// --- matchesAllFilters with include + exclude mix ---

describe('FilterEngine.matchesAllFilters with include and exclude filters', () => {
  describe('GIVEN an include filter and an exclude filter that both pass', () => {
    describe('WHEN matchesAllFilters is called', () => {
      it('THEN returns true', () => {
        const entry = makeEntry('{"level":"error","msg":"auth failed"}', {
          level: 'error',
          msg: 'auth failed'
        })
        const filters: readonly Filter[] = [
          FilterEngine.createRawFilter('error'), // include: matches
          FilterEngine.createRawFilter('debug', { mode: 'exclude' }) // exclude: "debug" not in entry -> passes
        ]

        expect(FilterEngine.matchesAllFilters(entry, filters)).toBe(true)
      })
    })
  })

  describe('GIVEN an include filter that passes and an exclude filter that fails', () => {
    describe('WHEN matchesAllFilters is called', () => {
      it('THEN returns false (exclude filter matched the entry, which means exclude fails)', () => {
        const entry = makeEntry('{"level":"error","msg":"auth failed"}', {
          level: 'error',
          msg: 'auth failed'
        })
        const filters: readonly Filter[] = [
          FilterEngine.createRawFilter('error'), // include: matches
          FilterEngine.createRawFilter('error', { mode: 'exclude' }) // exclude: "error" matches -> inverted to false
        ]

        expect(FilterEngine.matchesAllFilters(entry, filters)).toBe(false)
      })
    })
  })

  describe('GIVEN only exclude filters where entry does not match any pattern', () => {
    describe('WHEN matchesAllFilters is called', () => {
      it('THEN returns true (all exclude filters pass because patterns not found)', () => {
        const entry = makeEntry('{"level":"info","msg":"healthy"}')
        const filters: readonly Filter[] = [
          FilterEngine.createRawFilter('error', { mode: 'exclude' }),
          FilterEngine.createRawFilter('fatal', { mode: 'exclude' })
        ]

        expect(FilterEngine.matchesAllFilters(entry, filters)).toBe(true)
      })
    })
  })
})

// --- toggleMode ---

describe('FilterEngine.toggleMode', () => {
  describe('GIVEN an include filter', () => {
    describe('WHEN toggleMode is called', () => {
      it('THEN returns a new filter with mode: exclude', () => {
        const original = FilterEngine.createRawFilter('error')
        const toggled = FilterEngine.toggleMode(original)

        expect(toggled.mode).toBe('exclude')
        expect(original.mode).toBe('include') // immutable
      })
    })
  })

  describe('GIVEN an exclude filter', () => {
    describe('WHEN toggleMode is called', () => {
      it('THEN returns a new filter with mode: include', () => {
        const original = FilterEngine.createRawFilter('error', { mode: 'exclude' })
        const toggled = FilterEngine.toggleMode(original)

        expect(toggled.mode).toBe('include')
      })
    })
  })

  describe('GIVEN any filter', () => {
    describe('WHEN toggleMode is called', () => {
      it('THEN preserves all other properties', () => {
        const original = FilterEngine.createFieldFilter('level', 'warn')
        const toggled = FilterEngine.toggleMode(original)

        expect(toggled.id).toBe(original.id)
        expect(toggled.type).toBe('field')
        expect(toggled.pattern).toBe('warn')
        expect(toggled.regex).toEqual(original.regex)
        expect(toggled.enabled).toBe(original.enabled)
        expect(toggled.caseSensitive).toBe(original.caseSensitive)
      })
    })
  })
})

// --- toggleCaseSensitivity ---

describe('FilterEngine.toggleCaseSensitivity', () => {
  describe('GIVEN a case-insensitive filter (default)', () => {
    describe('WHEN toggleCaseSensitivity is called', () => {
      it('THEN returns a new filter with caseSensitive: true', () => {
        const original = FilterEngine.createRawFilter('error')
        expect(original.caseSensitive).toBe(false)

        const toggled = FilterEngine.toggleCaseSensitivity(original)

        expect(toggled.caseSensitive).toBe(true)
      })

      it('THEN recompiles regex without the i flag', () => {
        const original = FilterEngine.createRawFilter('error')
        expect(original.regex!.flags).toContain('i')

        const toggled = FilterEngine.toggleCaseSensitivity(original)

        expect(toggled.regex!.flags).not.toContain('i')
      })
    })
  })

  describe('GIVEN a case-sensitive filter', () => {
    describe('WHEN toggleCaseSensitivity is called', () => {
      it('THEN returns a new filter with caseSensitive: false and i flag', () => {
        const original = FilterEngine.createRawFilter('error', { caseSensitive: true })
        expect(original.regex!.flags).not.toContain('i')

        const toggled = FilterEngine.toggleCaseSensitivity(original)

        expect(toggled.caseSensitive).toBe(false)
        expect(toggled.regex!.flags).toContain('i')
      })
    })
  })

  describe('GIVEN a filter with invalid regex', () => {
    describe('WHEN toggleCaseSensitivity is called', () => {
      it('THEN the regex remains null', () => {
        const original = FilterEngine.createRawFilter('[invalid')
        expect(original.regex).toBeNull()

        const toggled = FilterEngine.toggleCaseSensitivity(original)

        expect(toggled.regex).toBeNull()
        expect(toggled.caseSensitive).toBe(true)
      })
    })
  })

  describe('GIVEN any filter', () => {
    describe('WHEN toggleCaseSensitivity is called', () => {
      it('THEN preserves all other properties', () => {
        const original = FilterEngine.createFieldFilter('level', 'warn')
        const toggled = FilterEngine.toggleCaseSensitivity(original)

        expect(toggled.id).toBe(original.id)
        expect(toggled.type).toBe('field')
        expect(toggled.pattern).toBe('warn')
        expect(toggled.enabled).toBe(original.enabled)
        expect(toggled.mode).toBe(original.mode)
      })
    })
  })
})

// --- resetIdCounter ---

describe('FilterEngine.resetIdCounter', () => {
  describe('GIVEN filters have been created (counter advanced)', () => {
    describe('WHEN resetIdCounter is called', () => {
      it('THEN subsequent filters start from id filter-0', () => {
        FilterEngine.createRawFilter('first')
        FilterEngine.createRawFilter('second')
        // Counter is now at 2

        FilterEngine.resetIdCounter()

        const filter = FilterEngine.createRawFilter('after-reset')
        expect(filter.id).toBe('filter-0')
      })
    })
  })
})
