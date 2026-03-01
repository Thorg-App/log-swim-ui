import type { Filter } from '@core/filter'

interface FilterChipProps {
  readonly filter: Filter
  readonly onToggle: () => void
  readonly onRemove: () => void
}

/**
 * Individual filter display chip with toggle and remove controls.
 * Shows filter type label + pattern (and field name for field filters).
 * Visual states: enabled (default), disabled (strikethrough + faded), error (red border for invalid regex).
 */
function FilterChip({ filter, onToggle, onRemove }: FilterChipProps) {
  const classNames = ['filter-chip']
  if (!filter.enabled) classNames.push('filter-chip--disabled')
  if (filter.regex === null) classNames.push('filter-chip--error')

  const label =
    filter.type === 'field'
      ? `${filter.field}:${filter.pattern}`
      : filter.pattern

  return (
    <span className={classNames.join(' ')} onClick={onToggle}>
      <span className="filter-chip__label">{label}</span>
      <span
        className="filter-chip__remove"
        onClick={(e) => {
          // WHY: stopPropagation prevents the click from bubbling to the chip body (which toggles)
          e.stopPropagation()
          onRemove()
        }}
        role="button"
        aria-label="Remove filter"
      >
        &times;
      </span>
    </span>
  )
}

export { FilterChip }
export type { FilterChipProps }
