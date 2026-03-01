import type { LogEntry } from './types'

// --- Filter Mode Constants ---

const FILTER_MODES = ['include', 'exclude'] as const
type FilterMode = (typeof FILTER_MODES)[number]

// --- Filter Types (Discriminated Union) ---

interface FieldFilter {
  readonly id: string
  readonly type: 'field'
  readonly field: string
  readonly pattern: string
  readonly regex: RegExp | null
  readonly enabled: boolean
  readonly mode: FilterMode
  readonly caseSensitive: boolean
}

interface RawFilter {
  readonly id: string
  readonly type: 'raw'
  readonly pattern: string
  readonly regex: RegExp | null
  readonly enabled: boolean
  readonly mode: FilterMode
  readonly caseSensitive: boolean
}

type Filter = FieldFilter | RawFilter

// --- Filter Type Constants ---

const FILTER_TYPES = ['field', 'raw'] as const
type FilterType = (typeof FILTER_TYPES)[number]

// --- Optional params for filter creation ---

interface FilterOptions {
  readonly mode?: FilterMode
  readonly caseSensitive?: boolean
}

// --- FilterEngine ---

/**
 * Stateless utility for creating and evaluating log entry filters.
 * Follows AND logic: an entry must match ALL enabled filters to pass.
 * - Include filters: entry must match the pattern.
 * - Exclude filters: entry must NOT match the pattern.
 * Filters with invalid regex (regex === null) are skipped (never block entries).
 */
class FilterEngine {
  private static nextId = 0

  /**
   * Create a field filter that matches against a specific JSON field value.
   * Wraps RegExp compilation in try/catch; invalid patterns produce regex: null.
   * Defaults: mode='include', caseSensitive=false (regex compiled with 'i' flag).
   */
  static createFieldFilter(
    field: string,
    pattern: string,
    options?: FilterOptions
  ): FieldFilter {
    const mode = options?.mode ?? 'include'
    const caseSensitive = options?.caseSensitive ?? false
    const regex = FilterEngine.tryCompileRegex(pattern, caseSensitive)
    return {
      id: `filter-${FilterEngine.nextId++}`,
      type: 'field',
      field,
      pattern,
      regex,
      enabled: true,
      mode,
      caseSensitive
    }
  }

  /**
   * Create a raw filter that matches against the full rawJson string.
   * Wraps RegExp compilation in try/catch; invalid patterns produce regex: null.
   * Defaults: mode='include', caseSensitive=false (regex compiled with 'i' flag).
   */
  static createRawFilter(pattern: string, options?: FilterOptions): RawFilter {
    const mode = options?.mode ?? 'include'
    const caseSensitive = options?.caseSensitive ?? false
    const regex = FilterEngine.tryCompileRegex(pattern, caseSensitive)
    return {
      id: `filter-${FilterEngine.nextId++}`,
      type: 'raw',
      pattern,
      regex,
      enabled: true,
      mode,
      caseSensitive
    }
  }

  /**
   * Returns a new filter with the enabled flag toggled.
   */
  static toggleFilter(filter: Filter): Filter {
    return { ...filter, enabled: !filter.enabled }
  }

  /**
   * Returns a new filter with the mode toggled (include <-> exclude).
   * Regex does not need recompilation since mode only affects match inversion.
   */
  static toggleMode(filter: Filter): Filter {
    const newMode: FilterMode = filter.mode === 'include' ? 'exclude' : 'include'
    return { ...filter, mode: newMode }
  }

  /**
   * Returns a new filter with caseSensitive toggled and regex recompiled.
   */
  static toggleCaseSensitivity(filter: Filter): Filter {
    const newCaseSensitive = !filter.caseSensitive
    const regex = FilterEngine.tryCompileRegex(filter.pattern, newCaseSensitive)
    return { ...filter, caseSensitive: newCaseSensitive, regex }
  }

  /**
   * Test whether a single filter matches a log entry.
   * - Field filter: tests String(entry.fields[field] ?? '') against regex.
   * - Raw filter: tests entry.rawJson against regex.
   * - Filters with regex === null always return false (invalid regex never matches).
   * - If mode === 'exclude', the match result is inverted.
   */
  static matchesFilter(entry: LogEntry, filter: Filter): boolean {
    if (filter.regex === null) {
      return false
    }

    let matches: boolean
    switch (filter.type) {
      case 'field': {
        const fieldValue = String(entry.fields[filter.field] ?? '')
        matches = filter.regex.test(fieldValue)
        break
      }
      case 'raw':
        matches = filter.regex.test(entry.rawJson)
        break
    }

    return filter.mode === 'exclude' ? !matches : matches
  }

  /**
   * Test whether a log entry passes ALL enabled filters (AND logic).
   * - Disabled filters are skipped.
   * - Filters with regex === null (invalid) are skipped.
   * - Empty active filters = all entries pass (vacuous truth).
   * - Include filters: entry must match pattern (AND — all must match).
   * - Exclude filters: entry must NOT match pattern (AND — all must NOT match).
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

  private static tryCompileRegex(pattern: string, caseSensitive: boolean): RegExp | null {
    try {
      const flags = caseSensitive ? '' : 'i'
      return new RegExp(pattern, flags)
    } catch {
      return null
    }
  }
}

// --- Exports ---

export type { FieldFilter, RawFilter, Filter, FilterType, FilterMode, FilterOptions }

export { FILTER_TYPES, FILTER_MODES, FilterEngine }
