import { useState, useCallback } from 'react'

interface LaneAddInputProps {
  readonly onAddLane: (pattern: string) => void
}

/**
 * Simple inline input for adding ad-hoc lanes at runtime.
 * Renders a text field with placeholder + submit on Enter or button click.
 * Clears the input after submission.
 */
function LaneAddInput({ onAddLane }: LaneAddInputProps) {
  const [value, setValue] = useState('')

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim()
    if (trimmed === '') return

    onAddLane(trimmed)
    setValue('')
  }, [value, onAddLane])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  return (
    <div className="lane-add-input">
      <input
        className="lane-add-input__field"
        type="text"
        placeholder="Add lane regex\u2026"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button
        className="filter-add-btn"
        onClick={handleSubmit}
        type="button"
      >
        + Lane
      </button>
    </div>
  )
}

export { LaneAddInput }
export type { LaneAddInputProps }
