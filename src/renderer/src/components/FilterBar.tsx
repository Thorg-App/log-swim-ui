import { useState, useCallback } from 'react'
import type { Filter, FilterType } from '@core/filter'
import { FILTER_TYPES, FilterEngine } from '@core/filter'
import { FilterChip } from './FilterChip'

interface FilterBarProps {
  readonly filters: readonly Filter[]
  readonly onAddFilter: (filter: Filter) => void
  readonly onRemoveFilter: (id: string) => void
  readonly onToggleFilter: (id: string) => void
}

/**
 * Horizontal bar displaying active filter chips and an inline form to add new filters.
 * Supports two filter modes: "field" (match against a specific JSON field) and "raw" (match against full rawJson).
 * Always visible, even when no filters are active (shows the "+" button).
 */
function FilterBar({ filters, onAddFilter, onRemoveFilter, onToggleFilter }: FilterBarProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [filterType, setFilterType] = useState<FilterType>('raw')
  const [fieldName, setFieldName] = useState('')
  const [pattern, setPattern] = useState('')

  const resetForm = useCallback(() => {
    setIsAdding(false)
    setFilterType('raw')
    setFieldName('')
    setPattern('')
  }, [])

  const handleSubmit = useCallback(() => {
    if (pattern.trim() === '') return

    const filter: Filter =
      filterType === 'field'
        ? FilterEngine.createFieldFilter(fieldName.trim(), pattern.trim())
        : FilterEngine.createRawFilter(pattern.trim())

    onAddFilter(filter)
    resetForm()
  }, [filterType, fieldName, pattern, onAddFilter, resetForm])

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
      {filters.map((filter) => (
        <FilterChip
          key={filter.id}
          filter={filter}
          onToggle={() => onToggleFilter(filter.id)}
          onRemove={() => onRemoveFilter(filter.id)}
        />
      ))}

      {isAdding ? (
        <div className="filter-bar__form">
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
    </div>
  )
}

// --- Internal Helper Component ---

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

export { FilterBar }
export type { FilterBarProps }
