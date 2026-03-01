import type { DragEvent } from 'react'

interface LaneHeaderProps {
  readonly pattern: string
  readonly isError: boolean
  readonly isUnmatched: boolean
  readonly laneIndex: number
  readonly onDragStart?: (index: number) => void
  readonly onDragOver?: (index: number) => void
  readonly onDrop?: (index: number) => void
  readonly onDragEnd?: () => void
  readonly isDragOver?: boolean
}

/**
 * Header cell for a swimlane column.
 * Displays the regex pattern (truncated with tooltip), with visual states
 * for error (invalid regex) and unmatched (implicit catch-all lane).
 *
 * Drag-and-drop: the drag handle span is the drag initiator (draggable).
 * The container div is the drop target (onDragOver / onDrop).
 * "Unmatched" lane is never draggable and never a drop target.
 */
function LaneHeader({
  pattern,
  isError,
  isUnmatched,
  laneIndex,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragOver
}: LaneHeaderProps) {
  const classNames = ['lane-header']
  if (isError) classNames.push('lane-header--error')
  if (isUnmatched) classNames.push('lane-header--unmatched')
  if (isDragOver === true) classNames.push('lane-header--drag-over')

  const displayText = isUnmatched ? 'unmatched' : pattern
  const isDraggable = !isUnmatched

  function handleDragStart(e: DragEvent<HTMLSpanElement>): void {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(laneIndex))
    onDragStart?.(laneIndex)
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>): void {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    onDragOver?.(laneIndex)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>): void {
    e.preventDefault()
    onDrop?.(laneIndex)
  }

  function handleDragEnd(): void {
    onDragEnd?.()
  }

  return (
    <div
      className={classNames.join(' ')}
      onDragOver={isDraggable ? handleDragOver : undefined}
      onDrop={isDraggable ? handleDrop : undefined}
    >
      {/* Drag handle -- draggable on the handle span per plan review point #4 */}
      {isDraggable ? (
        <span
          className="lane-header__drag-handle"
          aria-hidden="true"
          draggable="true"
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          ⠿
        </span>
      ) : (
        <span className="lane-header__drag-handle lane-header__drag-handle--hidden" aria-hidden="true" />
      )}
      <span className="lane-header__pattern" title={displayText}>
        {displayText}
      </span>
    </div>
  )
}

export { LaneHeader }
export type { LaneHeaderProps }
