import type { ViewMode } from '@core/types'

interface ModeToggleProps {
  readonly mode: ViewMode
  readonly onModeChange: (mode: ViewMode) => void
}

/**
 * Pill-shaped toggle for Live/Scroll view modes.
 * Active mode gets highlighted styling via `.mode-toggle__option--active`.
 */
function ModeToggle({ mode, onModeChange }: ModeToggleProps) {
  const liveClasses = ['mode-toggle__option']
  if (mode === 'live') liveClasses.push('mode-toggle__option--active')

  const scrollClasses = ['mode-toggle__option']
  if (mode === 'scroll') scrollClasses.push('mode-toggle__option--active')

  return (
    <div className="mode-toggle">
      <button
        className={liveClasses.join(' ')}
        onClick={() => onModeChange('live')}
        type="button"
      >
        Live
      </button>
      <button
        className={scrollClasses.join(' ')}
        onClick={() => onModeChange('scroll')}
        type="button"
      >
        Scroll
      </button>
    </div>
  )
}

export { ModeToggle }
export type { ModeToggleProps }
