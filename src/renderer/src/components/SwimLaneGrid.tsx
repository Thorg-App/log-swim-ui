import { useState, useRef, useEffect, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { LaneDefinition, ViewTimestampFormat, ViewMode } from '@core/types'
import { MasterList } from '@core/master-list'
import { LaneHeader } from './LaneHeader'
import { LogRow } from './LogRow'
import { getTotalLaneCount } from '../log-row-utils'

const SCROLL_UP_THRESHOLD_PX = 5
const VIRTUALIZER_OVERSCAN = 20

interface SwimLaneGridProps {
  readonly masterList: MasterList
  readonly lanes: readonly LaneDefinition[]
  readonly version: number // render trigger (incremented on each buffer flush)
  readonly timestampFormat: ViewTimestampFormat
  readonly rowHeight: number
  readonly mode: ViewMode
  readonly onScrollUp: () => void // callback to switch to scroll mode
}

/**
 * Main swimlane grid component. Combines lane headers with virtualized log rows
 * in a CSS Grid layout. Uses @tanstack/react-virtual for efficient rendering
 * of large log data sets.
 */
function SwimLaneGrid({
  masterList,
  lanes,
  version,
  timestampFormat,
  rowHeight,
  mode,
  onScrollUp
}: SwimLaneGridProps) {
  const [expandedRowIndex, setExpandedRowIndex] = useState<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const lastScrollTopRef = useRef(0)

  const totalLaneCount = getTotalLaneCount(lanes)

  // Compute first timestamp for relative formatting
  const firstTimestamp = masterList.length > 0 ? (masterList.get(0)?.timestamp ?? null) : null

  const virtualizer = useVirtualizer({
    count: masterList.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => (index === expandedRowIndex ? rowHeight * 6 : rowHeight),
    overscan: VIRTUALIZER_OVERSCAN
  })

  // Auto-scroll to bottom in Live mode when new data arrives
  useEffect(() => {
    if (mode === 'live' && scrollRef.current !== null) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [version, mode])

  // Scroll-up detection to auto-switch from Live to Scroll mode
  const handleScroll = useCallback(() => {
    if (scrollRef.current === null) return

    const currentScrollTop = scrollRef.current.scrollTop
    const scrollDelta = lastScrollTopRef.current - currentScrollTop

    if (mode === 'live' && scrollDelta > SCROLL_UP_THRESHOLD_PX) {
      onScrollUp()
    }

    lastScrollTopRef.current = currentScrollTop
  }, [mode, onScrollUp])

  const handleToggleExpand = useCallback(
    (index: number) => {
      setExpandedRowIndex((prev) => (prev === index ? null : index))
    },
    []
  )

  const virtualItems = virtualizer.getVirtualItems()

  return (
    <div
      className="swimlane-grid"
      // WHY inline style: dynamic lane count requires runtime grid-template-columns
      style={{ gridTemplateColumns: `repeat(${totalLaneCount}, 1fr)` }}
    >
      {/* Lane headers row */}
      {lanes.map((lane, i) => (
        <LaneHeader
          key={`lane-${i}`}
          pattern={lane.pattern}
          isError={lane.isError}
          isUnmatched={false}
        />
      ))}
      {/* Unmatched lane header (always last) */}
      <LaneHeader key="lane-unmatched" pattern="unmatched" isError={false} isUnmatched={true} />

      {/* Virtualized scroll container */}
      <div ref={scrollRef} className="swimlane-scroll-container" onScroll={handleScroll}>
        {/* Total height spacer for virtual scrolling */}
        <div
          style={{
            height: virtualizer.getTotalSize(),
            width: '100%',
            position: 'relative'
          }}
        >
          {virtualItems.map((virtualRow) => {
            const entry = masterList.get(virtualRow.index)
            if (entry === undefined) return null

            return (
              <div
                key={virtualRow.index}
                // WHY inline style: @tanstack/virtual requires absolute positioning for virtual rows
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: virtualRow.size,
                  transform: `translateY(${virtualRow.start}px)`
                }}
                ref={virtualizer.measureElement}
                data-index={virtualRow.index}
              >
                <LogRow
                  entry={entry}
                  isExpanded={expandedRowIndex === virtualRow.index}
                  timestampFormat={timestampFormat}
                  firstTimestamp={firstTimestamp}
                  onToggleExpand={() => handleToggleExpand(virtualRow.index)}
                  laneCount={totalLaneCount}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export { SwimLaneGrid }
export type { SwimLaneGridProps }
