import { useState, useRef, useEffect, useCallback } from 'react'
import type { DragEvent, KeyboardEvent, ChangeEvent } from 'react'
import type { ExtraPatternEntry } from '@core/types'

interface LaneHeaderProps {
  readonly pattern: string
  readonly isError: boolean
  readonly isUnmatched: boolean
  readonly caseSensitive: boolean
  readonly laneIndex: number
  readonly extraPatterns?: readonly ExtraPatternEntry[]
  readonly onDragStart?: (index: number) => void
  readonly onDragOver?: (index: number) => void
  readonly onDrop?: (index: number) => void
  readonly onDragEnd?: () => void
  readonly isDragOver?: boolean
  readonly onEdit?: (newPattern: string) => void
  readonly onRemove?: () => void
  readonly onToggleCaseSensitivity?: () => void
  readonly onAddLanePattern?: (pattern: string) => void
  readonly onRemoveLaneExtraPattern?: (extraIndex: number) => void
}

// --- PatternChip (internal) ---
// Presentational chip for an extra classification pattern.
// Simpler than FilterChip: no toggle, no mode, no case sensitivity — purely a removable matcher.

interface PatternChipProps {
  readonly pattern: string
  readonly isError: boolean
  readonly onRemove: () => void
}

function PatternChip({ pattern, isError, onRemove }: PatternChipProps) {
  const chipClass = isError
    ? 'lane-header__extra-chip lane-header__extra-chip--error'
    : 'lane-header__extra-chip'

  return (
    <span className={chipClass} data-testid="lane-header-extra-chip">
      {pattern}
      <span
        className="lane-header__extra-chip__remove"
        role="button"
        aria-label={`Remove pattern ${pattern}`}
        onClick={onRemove}
        data-testid="lane-header-extra-chip-remove"
      >
        &times;
      </span>
    </span>
  )
}

// --- LaneHeader ---

/**
 * Header cell for a swimlane column.
 * Displays the regex pattern (truncated with tooltip), with visual states
 * for error (invalid regex) and unmatched (implicit catch-all lane).
 *
 * Interactive features (not available on "unmatched" lane):
 * - Click pattern text to edit inline (Enter to confirm, Escape to cancel)
 * - x remove button to delete the lane
 * - Aa/aa toggle to switch case sensitivity
 * - Extra pattern chips with × remove buttons
 * - "+ Pattern" button to add extra classification patterns (inline input, Enter confirms, Escape/blur cancels)
 *
 * Drag-and-drop: the entire header div is the drag initiator AND drop target.
 * The ⠿ icon is a visual affordance hint only (not the drag handle).
 * "Unmatched" lane is never draggable and never a drop target.
 */
function LaneHeader({
  pattern,
  isError,
  isUnmatched,
  caseSensitive,
  laneIndex,
  extraPatterns,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragOver,
  onEdit,
  onRemove,
  onToggleCaseSensitivity,
  onAddLanePattern,
  onRemoveLaneExtraPattern
}: LaneHeaderProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(pattern)
  const inputRef = useRef<HTMLInputElement>(null)

  const [isAddingPattern, setIsAddingPattern] = useState(false)
  const [addPatternValue, setAddPatternValue] = useState('')
  const addPatternInputRef = useRef<HTMLInputElement>(null)

  // Focus edit input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current !== null) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  // Focus add-pattern input when entering add-pattern mode
  useEffect(() => {
    if (isAddingPattern) {
      addPatternInputRef.current?.focus()
    }
  }, [isAddingPattern])

  const handleStartEdit = useCallback(() => {
    if (isUnmatched) return
    setEditValue(pattern)
    setIsEditing(true)
  }, [isUnmatched, pattern])

  const handleConfirmEdit = useCallback(() => {
    setIsEditing(false)
    const trimmed = editValue.trim()
    if (trimmed.length > 0 && trimmed !== pattern) {
      onEdit?.(trimmed)
    }
  }, [editValue, pattern, onEdit])

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false)
    setEditValue(pattern)
  }, [pattern])

  const handleEditKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleConfirmEdit()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        handleCancelEdit()
      }
    },
    [handleConfirmEdit, handleCancelEdit]
  )

  const handleEditChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setEditValue(e.target.value)
  }, [])

  const handleConfirmAddPattern = useCallback(() => {
    const trimmed = addPatternValue.trim()
    if (trimmed.length > 0) {
      onAddLanePattern?.(trimmed)
    }
    setAddPatternValue('')
    setIsAddingPattern(false)
  }, [addPatternValue, onAddLanePattern])

  const handleCancelAddPattern = useCallback(() => {
    setAddPatternValue('')
    setIsAddingPattern(false)
  }, [])

  const handleAddPatternKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleConfirmAddPattern()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        handleCancelAddPattern()
      }
    },
    [handleConfirmAddPattern, handleCancelAddPattern]
  )

  const handleAddPatternChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setAddPatternValue(e.target.value)
  }, [])

  const classNames = ['lane-header']
  if (isError) classNames.push('lane-header--error')
  if (isUnmatched) classNames.push('lane-header--unmatched')
  if (isDragOver === true) classNames.push('lane-header--drag-over')

  const displayText = isUnmatched ? 'unmatched' : pattern
  const isDraggable = !isUnmatched
  // WHY: suppress draggable while editing or adding a pattern to prevent accidental
  // lane drag when the user is focused on typing inside the lane header.
  const dragActive = isDraggable && !isEditing && !isAddingPattern

  function handleDragStart(e: DragEvent<HTMLDivElement>): void {
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
      draggable={dragActive ? true : undefined}
      onDragStart={dragActive ? handleDragStart : undefined}
      onDragEnd={dragActive ? handleDragEnd : undefined}
      onDragOver={isDraggable ? handleDragOver : undefined}
      onDrop={isDraggable ? handleDrop : undefined}
    >
      {/* Drag handle icon -- visual affordance hint only, not the drag initiator */}
      {isDraggable ? (
        <span
          className="lane-header__drag-handle"
          aria-hidden="true"
        >
          ⠿
        </span>
      ) : (
        <span className="lane-header__drag-handle lane-header__drag-handle--hidden" aria-hidden="true" />
      )}

      {/* Pattern display or edit input */}
      {isEditing ? (
        <input
          ref={inputRef}
          className="lane-header__edit-input"
          type="text"
          value={editValue}
          onChange={handleEditChange}
          onKeyDown={handleEditKeyDown}
          onBlur={handleConfirmEdit}
          data-testid="lane-header-edit-input"
        />
      ) : (
        <span
          className="lane-header__pattern"
          title={displayText}
          onClick={isDraggable ? handleStartEdit : undefined}
          data-testid="lane-header-pattern"
        >
          {displayText}
        </span>
      )}

      {/* Extra pattern chips (not on unmatched lane) */}
      {!isUnmatched && (
        <div className="lane-header__extra-patterns">
          {(extraPatterns ?? []).map((ep, i) => (
            <PatternChip
              key={i}
              pattern={ep.pattern}
              isError={ep.isError}
              onRemove={() => onRemoveLaneExtraPattern?.(i)}
            />
          ))}
        </div>
      )}

      {/* Add pattern inline form or + Pattern button (not on unmatched lane) */}
      {!isUnmatched && (
        isAddingPattern ? (
          <div className="lane-header__add-form">
            <input
              ref={addPatternInputRef}
              className="lane-header__add-input"
              type="text"
              value={addPatternValue}
              placeholder="regex pattern"
              onChange={handleAddPatternChange}
              onKeyDown={handleAddPatternKeyDown}
              // WHY: blur cancels (not confirms) to avoid unintended submission when the
              // user clicks the Aa toggle or chip remove while the input is focused.
              // onBlur fires before onClick in DOM event order, so blur-confirms would
              // silently submit partial text before the clicked button action runs.
              onBlur={handleCancelAddPattern}
              data-testid="lane-header-add-pattern-input"
            />
          </div>
        ) : (
          <button
            className="filter-add-btn"
            type="button"
            onClick={() => setIsAddingPattern(true)}
            data-testid="lane-header-add-pattern-btn"
          >
            + Pattern
          </button>
        )
      )}

      {/* Case sensitivity toggle (not on unmatched) */}
      {!isUnmatched && (
        <span
          className={`lane-header__case-toggle${caseSensitive ? ' lane-header__case-toggle--active' : ''}`}
          onClick={onToggleCaseSensitivity}
          role="button"
          aria-label={caseSensitive ? 'Case sensitive (click to make insensitive)' : 'Case insensitive (click to make sensitive)'}
          title={caseSensitive ? 'Case sensitive' : 'Case insensitive'}
          data-testid="lane-header-case-toggle"
        >
          {caseSensitive ? 'Aa' : 'aa'}
        </span>
      )}

      {/* Remove button (not on unmatched) */}
      {!isUnmatched && (
        <span
          className="lane-header__remove"
          onClick={onRemove}
          role="button"
          aria-label="Remove lane"
          data-testid="lane-header-remove"
        >
          &times;
        </span>
      )}
    </div>
  )
}

export { LaneHeader }
export type { LaneHeaderProps }
