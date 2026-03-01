import type { LogEntry } from './types'

// --- Filter Types (Discriminated Union) ---

interface FieldFilter {
  readonly id: string
  readonly type: 'field'
  readonly field: string
  readonly pattern: string
  readonly regex: RegExp | null
  readonly enabled: boolean
}

interface RawFilter {
  readonly id: string
  readonly type: 'raw'
  readonly pattern: string
  readonly regex: RegExp | null
  readonly enabled: boolean
}

type Filter = FieldFilter | RawFilter

// --- Filter Type Constants ---

const FILTER_TYPES = ['field', 'raw'] as const
type FilterType = (typeof FILTER_TYPES)[number]

// --- FilterEngine ---

/**
 * Stateless utility for creating and evaluating log entry filters.
 * Follows AND logic: an entry must match ALL enabled filters to pass.
 * Filters with invalid regex (regex === null) are skipped (never block entries).
 */
class FilterEngine {
  private static nextId = 0

  /**
   * Create a field filter that matches against a specific JSON field value.
   * Wraps RegExp compilation in try/catch; invalid patterns produce regex: null.
   */
  static createFieldFilter(field: string, pattern: string): FieldFilter {
    const regex = FilterEngine.tryCompileRegex(pattern)
    return {
      id: `filter-${FilterEngine.nextId++}`,
      type: 'field',
      field,
      pattern,
      regex,
      enabled: true
    }
  }

  /**
   * Create a raw filter that matches against the full rawJson string.
   * Wraps RegExp compilation in try/catch; invalid patterns produce regex: null.
   */
  static createRawFilter(pattern: string): RawFilter {
    const regex = FilterEngine.tryCompileRegex(pattern)
    return {
      id: `filter-${FilterEngine.nextId++}`,
      type: 'raw',
      pattern,
      regex,
      enabled: true
    }
  }

  /**
   * Returns a new filter with the enabled flag toggled.
   */
  static toggleFilter(filter: Filter): Filter {
    return { ...filter, enabled: !filter.enabled }
  }

  /**
   * Test whether a single filter matches a log entry.
   * - Field filter: tests String(entry.fields[field] ?? '') against regex.
   * - Raw filter: tests entry.rawJson against regex.
   * - Filters with regex === null always return false (invalid regex never matches).
   */
  static matchesFilter(entry: LogEntry, filter: Filter): boolean {
    if (filter.regex === null) {
      return false
    }

    switch (filter.type) {
      case 'field': {
        const fieldValue = String(entry.fields[filter.field] ?? '')
        return filter.regex.test(fieldValue)
      }
      case 'raw':
        return filter.regex.test(entry.rawJson)
    }
  }

  /**
   * Test whether a log entry passes ALL enabled filters (AND logic).
   * - Disabled filters are skipped.
   * - Filters with regex === null (invalid) are skipped.
   * - Empty active filters = all entries pass (vacuous truth).
   */
  static matchesAllFilters(entry: LogEntry, filters: readonly Filter[]): boolean {
    for (const filter of filters) {
      if (!filter.enabled) {
        continue
      }
      if (filter.regex === null) {
        continue
      }
      if (!FilterEngine.matchesFilter(entry, filter)) {
        return false
      }
    }
    return true
  }

  /**
   * Reset the ID counter. Intended for test isolation only.
   */
  static resetIdCounter(): void {
    FilterEngine.nextId = 0
  }

  private static tryCompileRegex(pattern: string): RegExp | null {
    try {
      return new RegExp(pattern)
    } catch {
      return null
    }
  }
}

// --- Exports ---

export type { FieldFilter, RawFilter, Filter, FilterType }

export { FILTER_TYPES, FilterEngine }
