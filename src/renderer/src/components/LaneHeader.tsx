interface LaneHeaderProps {
  readonly pattern: string
  readonly isError: boolean
  readonly isUnmatched: boolean
}

/**
 * Header cell for a swimlane column.
 * Displays the regex pattern (truncated with tooltip), with visual states
 * for error (invalid regex) and unmatched (implicit catch-all lane).
 */
function LaneHeader({ pattern, isError, isUnmatched }: LaneHeaderProps) {
  const classNames = ['lane-header']
  if (isError) classNames.push('lane-header--error')
  if (isUnmatched) classNames.push('lane-header--unmatched')

  const displayText = isUnmatched ? 'unmatched' : pattern

  return (
    <div className={classNames.join(' ')}>
      {/* Drag handle -- non-functional in Phase 05, will be wired in Phase 06 */}
      <span className="lane-header__drag-handle" aria-hidden="true">
        ⠿
      </span>
      <span className="lane-header__pattern" title={displayText}>
        {displayText}
      </span>
    </div>
  )
}

export { LaneHeader }
export type { LaneHeaderProps }
