import { useState, useRef, useEffect, useCallback } from 'react'
import '../theme/tokens.css'
import '../theme/components.css'
import type { AppConfig, LaneDefinition } from '@core/types'
import { createLaneDefinition } from '@core/types'
import { MasterList } from '@core/master-list'
import { LaneClassifier } from '@core/lane-classifier'
import type { Filter } from '@core/filter'
import { FilterEngine } from '@core/filter'
import { useAppInit } from './useAppInit'
import { useLogIngestion } from './useLogIngestion'
import { ErrorScreen } from './ErrorScreen'
import { SwimLaneGrid } from './components/SwimLaneGrid'
import { ModeToggle } from './components/ModeToggle'
import { StreamEndIndicator } from './components/StreamEndIndicator'
import { UnparseablePanel } from './components/UnparseablePanel'
import { FilterBar } from './components/FilterBar'
import { LaneAddInput } from './components/LaneAddInput'

function App() {
  const init = useAppInit()

  if (init.status === 'loading') {
    return (
      <div className="app-layout">
        <div className="app-main app-loading">
          <span className="text-muted">Loading...</span>
        </div>
      </div>
    )
  }

  if (init.status === 'error') {
    return <ErrorScreen errorType={init.errorType} message={init.message} />
  }

  return (
    <AppShell
      config={init.config}
      initialLanes={init.lanes}
      masterList={init.masterList}
    />
  )
}

// --- AppShell (active state after init) ---

interface AppShellProps {
  readonly config: AppConfig
  readonly initialLanes: readonly LaneDefinition[]
  readonly masterList: MasterList
}

function AppShell({ config, initialLanes, masterList }: AppShellProps) {
  // --- Mutable lane state (lifted from useAppInit for runtime reorder/add) ---
  const [lanes, setLanes] = useState<readonly LaneDefinition[]>(initialLanes)
  const lanesRef = useRef<readonly LaneDefinition[]>(lanes)
  useEffect(() => {
    lanesRef.current = lanes
  }, [lanes])

  // --- Filter state ---
  const [filters, setFilters] = useState<readonly Filter[]>([])

  const {
    version,
    streamEnded,
    error,
    unparseableEntries,
    mode,
    setMode,
    bumpVersion
  } = useLogIngestion(masterList, lanesRef, config)

  // --- Lane handlers (used by LaneAddInput and drag-and-drop in 6C/6D) ---

  const handleAddLane = useCallback(
    (pattern: string) => {
      const newLane = createLaneDefinition(pattern)
      // Insert before "unmatched" position (i.e. append to lanes array,
      // since "unmatched" is implicit at lanes.length)
      const newLanes = [...lanes, newLane]
      setLanes(newLanes)
      LaneClassifier.reclassifyAll(masterList.entries, newLanes)
      bumpVersion()
    },
    [lanes, masterList, bumpVersion]
  )

  const handleReorderLanes = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return

      const newLanes = [...lanes]
      const [moved] = newLanes.splice(fromIndex, 1)
      newLanes.splice(toIndex, 0, moved)

      setLanes(newLanes)
      LaneClassifier.reclassifyAll(masterList.entries, newLanes)
      bumpVersion()
    },
    [lanes, masterList, bumpVersion]
  )

  // --- Filter handlers (used by FilterBar in 6C) ---

  const handleAddFilter = useCallback(
    (filter: Filter) => {
      setFilters((prev) => [...prev, filter])
    },
    []
  )

  const handleRemoveFilter = useCallback(
    (id: string) => {
      setFilters((prev) => prev.filter((f) => f.id !== id))
    },
    []
  )

  const handleToggleFilter = useCallback(
    (id: string) => {
      setFilters((prev) =>
        prev.map((f) => (f.id === id ? FilterEngine.toggleFilter(f) : f))
      )
    },
    []
  )

  if (error !== null) {
    return <ErrorScreen errorType={error.type} message={error.message} />
  }

  // WHY: Suppress unused-variable warning for handler wired to UI in Phase 6D (drag-and-drop).
  void handleReorderLanes

  return (
    <div className="app-layout">
      <div className="app-toolbar">
        <ModeToggle mode={mode} onModeChange={setMode} />
        <LaneAddInput onAddLane={handleAddLane} />
        <StreamEndIndicator visible={streamEnded} />
      </div>
      <FilterBar
        filters={filters}
        onAddFilter={handleAddFilter}
        onRemoveFilter={handleRemoveFilter}
        onToggleFilter={handleToggleFilter}
      />
      <div className="app-main">
        <SwimLaneGrid
          masterList={masterList}
          lanes={lanes}
          filters={filters}
          version={version}
          timestampFormat={config.ui.viewTimestampFormat}
          rowHeight={config.ui.rowHeight}
          mode={mode}
          onScrollUp={() => setMode('scroll')}
        />
      </div>
      {unparseableEntries.length > 0 && (
        <UnparseablePanel entries={unparseableEntries} />
      )}
    </div>
  )
}

export default App
