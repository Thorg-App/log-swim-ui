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
