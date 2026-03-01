import type { LogEntry, ViewTimestampFormat } from '@core/types'
import { formatTimestamp } from '../timestamp-formatter'
import { getLevelCssClass, getMessagePreview, getGridColumn } from '../log-row-utils'

interface LogRowProps {
  readonly entry: LogEntry
  readonly isExpanded: boolean
  readonly timestampFormat: ViewTimestampFormat
  readonly firstTimestamp: Date | null
  readonly onToggleExpand: () => void
  readonly laneCount: number // total lanes including unmatched
}

/**
 * A single log row rendered within a CSS grid.
 * Content is placed in the correct lane column via `gridColumn`.
 * Supports collapsed (timestamp + message preview) and expanded (pretty-printed JSON) states.
 */
function LogRow({
  entry,
  isExpanded,
  timestampFormat,
  firstTimestamp,
  onToggleExpand,
  laneCount
}: LogRowProps) {
  const levelClass = getLevelCssClass(entry.level)
  const formattedTimestamp = formatTimestamp(entry.timestamp, timestampFormat, firstTimestamp)
  const messagePreview = getMessagePreview(entry)

  const rowClassNames = ['log-row', levelClass]
  if (isExpanded) {
    rowClassNames.push('log-row--expanded')
  }

  return (
    // WHY inline gridTemplateColumns: dynamic lane count requires runtime value
    <div
      className="log-row-grid"
      style={{ display: 'grid', gridTemplateColumns: `repeat(${laneCount}, 1fr)` }}
    >
      {/* WHY inline gridColumn: column index is data-driven from entry.laneIndex */}
      <div
        className={rowClassNames.join(' ')}
        style={{ gridColumn: getGridColumn(entry.laneIndex) }}
        onClick={onToggleExpand}
      >
        <span className="log-row__timestamp">{formattedTimestamp}</span>
        {isExpanded ? (
          <div className="log-row__expanded-content">
            {JSON.stringify(entry.fields, null, 2)}
          </div>
        ) : (
          <span className="log-row__message">{messagePreview}</span>
        )}
      </div>
    </div>
  )
}

export { LogRow }
export type { LogRowProps }
