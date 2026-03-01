import { useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import type { Filter, FilterType, FilterMode } from '@core/filter'
import { FILTER_TYPES, FILTER_MODES, FilterEngine } from '@core/filter'
import { FilterChip } from './FilterChip'

interface FilterBarProps {
  readonly filters: readonly Filter[]
  readonly onAddFilter: (filter: Filter) => void
  readonly onRemoveFilter: (id: string) => void
  readonly onToggleFilter: (id: string) => void
  readonly onToggleMode: (id: string) => void
  readonly onToggleCaseSensitivity: (id: string) => void
  /** Right-aligned slot content (e.g. ModeToggle) */
  readonly rightSlot?: ReactNode
}

/**
 * Horizontal bar displaying a "Global Filter" label, active filter chips,
 * and an inline form to add new filters.
 * Supports two filter types: "field" (match against a specific JSON field) and "raw" (match against full rawJson).
 * Supports include/exclude mode and case-sensitivity toggles.
 * Always visible, even when no filters are active (shows the "+" button).
 * Accepts an optional rightSlot for rendering content (e.g. ModeToggle) on the right side.
 */
function FilterBar({
  filters,
  onAddFilter,
  onRemoveFilter,
  onToggleFilter,
  onToggleMode,
  onToggleCaseSensitivity,
  rightSlot
}: FilterBarProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [filterType, setFilterType] = useState<FilterType>('raw')
  const [filterMode, setFilterMode] = useState<FilterMode>('include')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [fieldName, setFieldName] = useState('')
  const [pattern, setPattern] = useState('')

  const resetForm = useCallback(() => {
    setIsAdding(false)
    setFilterType('raw')
    setFilterMode('include')
    setCaseSensitive(false)
    setFieldName('')
    setPattern('')
  }, [])

  const handleSubmit = useCallback(() => {
    if (pattern.trim() === '') return

    const options = { mode: filterMode, caseSensitive }
    const filter: Filter =
      filterType === 'field'
        ? FilterEngine.createFieldFilter(fieldName.trim(), pattern.trim(), options)
        : FilterEngine.createRawFilter(pattern.trim(), options)

    onAddFilter(filter)
    resetForm()
  }, [filterType, filterMode, caseSensitive, fieldName, pattern, onAddFilter, resetForm])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSubmit()
      }
      if (e.key === 'Escape') {
        resetForm()
      }
    },
    [handleSubmit, resetForm]
  )

  return (
    <div className="filter-bar">
      <span className="filter-bar__label">Global Filter</span>

      {filters.map((filter) => (
        <FilterChip
          key={filter.id}
          filter={filter}
          onToggle={() => onToggleFilter(filter.id)}
          onRemove={() => onRemoveFilter(filter.id)}
          onToggleMode={() => onToggleMode(filter.id)}
          onToggleCaseSensitivity={() => onToggleCaseSensitivity(filter.id)}
        />
      ))}

      {isAdding ? (
        <div className="filter-bar__form">
          <FilterModeToggle
            filterMode={filterMode}
            onModeChange={setFilterMode}
          />
          <FilterTypeToggle
            filterType={filterType}
            onTypeChange={setFilterType}
          />
          {filterType === 'field' && (
            <input
              className="filter-bar__input"
              type="text"
              placeholder="field name"
              value={fieldName}
              onChange={(e) => setFieldName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          )}
          <input
            className="filter-bar__input"
            type="text"
            placeholder="regex pattern"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus={filterType === 'raw'}
          />
          <CaseSensitivityToggle
            caseSensitive={caseSensitive}
            onToggle={() => setCaseSensitive((prev) => !prev)}
          />
          <button
            className="filter-add-btn"
            onClick={handleSubmit}
            type="button"
          >
            Add
          </button>
          <button
            className="filter-add-btn"
            onClick={resetForm}
            type="button"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          className="filter-add-btn"
          onClick={() => setIsAdding(true)}
          type="button"
        >
          + Filter
        </button>
      )}

      {rightSlot !== undefined && (
        <div className="filter-bar__right-slot">
          {rightSlot}
        </div>
      )}
    </div>
  )
}

// --- Internal Helper Components ---

interface FilterTypeToggleProps {
  readonly filterType: FilterType
  readonly onTypeChange: (type: FilterType) => void
}

/**
 * Toggle between "field" and "raw" filter types.
 */
function FilterTypeToggle({ filterType, onTypeChange }: FilterTypeToggleProps) {
  return (
    <span className="filter-bar__type-group">
      {FILTER_TYPES.map((type) => (
        <button
          key={type}
          className={`filter-bar__type-toggle${type === filterType ? ' filter-bar__type-toggle--active' : ''}`}
          onClick={() => onTypeChange(type)}
          type="button"
        >
          {type}
        </button>
      ))}
    </span>
  )
}

interface FilterModeToggleProps {
  readonly filterMode: FilterMode
  readonly onModeChange: (mode: FilterMode) => void
}

/**
 * Toggle between "include" and "exclude" filter modes in the add-filter form.
 */
function FilterModeToggle({ filterMode, onModeChange }: FilterModeToggleProps) {
  return (
    <span className="filter-bar__type-group">
      {FILTER_MODES.map((mode) => (
        <button
          key={mode}
          className={`filter-bar__type-toggle${mode === filterMode ? ' filter-bar__type-toggle--active' : ''}`}
          onClick={() => onModeChange(mode)}
          type="button"
        >
          {mode}
        </button>
      ))}
    </span>
  )
}

interface CaseSensitivityToggleProps {
  readonly caseSensitive: boolean
  readonly onToggle: () => void
}

/**
 * Small toggle button for case-sensitivity in the add-filter form.
 */
function CaseSensitivityToggle({ caseSensitive, onToggle }: CaseSensitivityToggleProps) {
  return (
    <button
      className={`filter-bar__case-toggle${caseSensitive ? ' filter-bar__case-toggle--active' : ''}`}
      onClick={onToggle}
      type="button"
      title={caseSensitive ? 'Case sensitive' : 'Case insensitive'}
      aria-label={caseSensitive ? 'Case sensitive' : 'Case insensitive'}
    >
      {caseSensitive ? 'Aa' : 'aa'}
    </button>
  )
}

export { FilterBar }
export type { FilterBarProps }
