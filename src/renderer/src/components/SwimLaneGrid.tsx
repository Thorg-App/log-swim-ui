import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { LaneDefinition, ViewTimestampFormat, ViewMode } from '@core/types'
import type { Filter } from '@core/filter'
import { FilterEngine } from '@core/filter'
import { MasterList } from '@core/master-list'
import { LaneHeader } from './LaneHeader'
import { LogRow } from './LogRow'
import { getTotalLaneCount } from '../log-row-utils'
import { isScrollingUp } from '../scroll-utils'

const SCROLL_UP_THRESHOLD_PX = 5
const VIRTUALIZER_OVERSCAN = 20

interface SwimLaneGridProps {
  readonly masterList: MasterList
  readonly lanes: readonly LaneDefinition[]
  readonly filters: readonly Filter[]
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
 *
 * Filtering is a render-time operation: a filtered index mapping is computed
 * in useMemo. When no filters are active, `filteredIndices` is null (fast path).
 */
function SwimLaneGrid({
  masterList,
  lanes,
  filters,
  version,
  timestampFormat,
  rowHeight,
  mode,
  onScrollUp
}: SwimLaneGridProps) {
  const [expandedRowIndex, setExpandedRowIndex] = useState<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const lastScrollTopRef = useRef(0)

  // Reset expanded row when filters change (expanded row may be filtered out)
  useEffect(() => {
    setExpandedRowIndex(null)
  }, [filters])

  const totalLaneCount = getTotalLaneCount(lanes)

  // Compute first timestamp for relative formatting
  const firstTimestamp = masterList.length > 0 ? (masterList.get(0)?.timestamp ?? null) : null

  // Filtered index mapping: array of masterList indices that pass all active filters.
  // Returns null when no filters are active (fast path -- no filtering needed).
  const filteredIndices = useMemo(() => {
    const activeFilters = filters.filter((f) => f.enabled && f.regex !== null)
    if (activeFilters.length === 0) {
      return null
    }
    const indices: number[] = []
    for (let i = 0; i < masterList.length; i++) {
      const entry = masterList.get(i)
      if (entry !== undefined && FilterEngine.matchesAllFilters(entry, filters)) {
        indices.push(i)
      }
    }
    return indices
    // WHY: version triggers recomputation when new entries arrive
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, filters, masterList])

  const displayCount = filteredIndices !== null ? filteredIndices.length : masterList.length

  const virtualizer = useVirtualizer({
    count: displayCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => {
      const masterIndex = filteredIndices !== null ? filteredIndices[index] : index
      return masterIndex === expandedRowIndex ? rowHeight * 6 : rowHeight
    },
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

    if (mode === 'live' && isScrollingUp(lastScrollTopRef.current, currentScrollTop, SCROLL_UP_THRESHOLD_PX)) {
      onScrollUp()
    }

    lastScrollTopRef.current = currentScrollTop
  }, [mode, onScrollUp])

  const handleToggleExpand = useCallback(
    (masterIndex: number) => {
      setExpandedRowIndex((prev) => (prev === masterIndex ? null : masterIndex))
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
            // Map virtual row index through filteredIndices to get actual masterList index
            const masterIndex = filteredIndices !== null
              ? filteredIndices[virtualRow.index]
              : virtualRow.index
            const entry = masterList.get(masterIndex)
            if (entry === undefined) return null

            return (
              <div
                key={masterIndex}
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
                  isExpanded={expandedRowIndex === masterIndex}
                  timestampFormat={timestampFormat}
                  firstTimestamp={firstTimestamp}
                  onToggleExpand={() => handleToggleExpand(masterIndex)}
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
