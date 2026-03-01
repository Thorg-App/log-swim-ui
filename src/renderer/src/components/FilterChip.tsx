import type { Filter } from '@core/filter'

interface FilterChipProps {
  readonly filter: Filter
  readonly onToggle: () => void
  readonly onRemove: () => void
  readonly onToggleMode: () => void
  readonly onToggleCaseSensitivity: () => void
}

/**
 * Individual filter display chip with toggle and remove controls.
 * Shows mode indicator (+/-), filter type label + pattern (and field name for field filters),
 * case-sensitivity indicator (Aa/aa), and remove button.
 * Visual states: enabled (default), disabled (strikethrough + faded), error (red border for invalid regex).
 */
function FilterChip({
  filter,
  onToggle,
  onRemove,
  onToggleMode,
  onToggleCaseSensitivity
}: FilterChipProps) {
  const classNames = ['filter-chip']
  if (!filter.enabled) classNames.push('filter-chip--disabled')
  if (filter.regex === null) classNames.push('filter-chip--error')
  if (filter.mode === 'exclude') classNames.push('filter-chip--exclude')

  const label =
    filter.type === 'field'
      ? `${filter.field}:${filter.pattern}`
      : filter.pattern

  const modeIndicator = filter.mode === 'include' ? '+' : '\u2212'
  const modeLabel = filter.mode === 'include' ? 'Include filter' : 'Exclude filter'

  return (
    <span className={classNames.join(' ')} onClick={onToggle}>
      <span
        className={`filter-chip__mode filter-chip__mode--${filter.mode}`}
        onClick={(e) => {
          // WHY: stopPropagation prevents the click from bubbling to the chip body (which toggles enabled)
          e.stopPropagation()
          onToggleMode()
        }}
        role="button"
        aria-label={modeLabel}
        title={modeLabel}
      >
        {modeIndicator}
      </span>
      <span className="filter-chip__label">{label}</span>
      <span
        className={`filter-chip__case${filter.caseSensitive ? ' filter-chip__case--active' : ''}`}
        onClick={(e) => {
          // WHY: stopPropagation prevents the click from bubbling to the chip body (which toggles enabled)
          e.stopPropagation()
          onToggleCaseSensitivity()
        }}
        role="button"
        aria-label={filter.caseSensitive ? 'Case sensitive (click to make insensitive)' : 'Case insensitive (click to make sensitive)'}
        title={filter.caseSensitive ? 'Case sensitive' : 'Case insensitive'}
      >
        {filter.caseSensitive ? 'Aa' : 'aa'}
      </span>
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
