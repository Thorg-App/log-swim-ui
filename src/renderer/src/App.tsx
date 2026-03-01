import { useState, useRef, useEffect, useCallback } from 'react'
import '../theme/tokens.css'
import '../theme/components.css'
import type { AppConfig, LaneDefinition } from '@core/types'
import { createLaneDefinition } from '@core/types'
import { MasterList } from '@core/master-list'
import { LaneClassifier } from '@core/lane-classifier'
import type { Filter } from '@core/filter'
import { FilterEngine } from '@core/filter'
import { applyConfigToCSS } from './applyConfigToCSS'
import { useAppInit } from './useAppInit'
import { useLogIngestion } from './useLogIngestion'
import { ErrorScreen } from './ErrorScreen'
import { SwimLaneGrid } from './components/SwimLaneGrid'
import { ModeToggle } from './components/ModeToggle'
import { StreamEndIndicator } from './components/StreamEndIndicator'
import { UnparseablePanel } from './components/UnparseablePanel'
import { FilterBar } from './components/FilterBar'
import { LaneAddInput } from './components/LaneAddInput'
import { SettingsPanel } from './components/SettingsPanel'

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

function AppShell({ config: initConfig, initialLanes, masterList }: AppShellProps) {
  // --- Config state (promoted from prop for runtime settings changes) ---
  const [config, setConfig] = useState<AppConfig>(initConfig)

  // --- Settings panel state ---
  const [settingsOpen, setSettingsOpen] = useState(false)

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

  // --- Lane mutation helper (DRY: set lanes + reclassify + bump in one place) ---

  const applyLaneChange = useCallback(
    (newLanes: LaneDefinition[]) => {
      setLanes(newLanes)
      LaneClassifier.reclassifyAll(masterList.entries, newLanes)
      bumpVersion()
    },
    [masterList, bumpVersion]
  )

  // --- Lane handlers (used by LaneAddInput and drag-and-drop) ---

  const handleAddLane = useCallback(
    (pattern: string) => {
      const newLane = createLaneDefinition(pattern)
      // Insert before "unmatched" position (i.e. append to lanes array,
      // since "unmatched" is implicit at lanes.length)
      applyLaneChange([...lanes, newLane])
    },
    [lanes, applyLaneChange]
  )

  const handleReorderLanes = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return

      const newLanes = [...lanes]
      const [moved] = newLanes.splice(fromIndex, 1)
      newLanes.splice(toIndex, 0, moved)

      applyLaneChange(newLanes)
    },
    [lanes, applyLaneChange]
  )

  const handleEditLane = useCallback(
    (index: number, newPattern: string) => {
      const existing = lanes[index]
      if (existing === undefined) return
      const newLane = createLaneDefinition(newPattern, { caseSensitive: existing.caseSensitive })
      const newLanes = [...lanes]
      newLanes[index] = newLane
      applyLaneChange(newLanes)
    },
    [lanes, applyLaneChange]
  )

  const handleRemoveLane = useCallback(
    (index: number) => {
      const newLanes = lanes.filter((_, i) => i !== index)
      applyLaneChange(newLanes)
    },
    [lanes, applyLaneChange]
  )

  const handleToggleLaneCaseSensitivity = useCallback(
    (index: number) => {
      const existing = lanes[index]
      if (existing === undefined) return
      const newLane = createLaneDefinition(existing.pattern, { caseSensitive: !existing.caseSensitive })
      const newLanes = [...lanes]
      newLanes[index] = newLane
      applyLaneChange(newLanes)
    },
    [lanes, applyLaneChange]
  )

  // --- Filter handlers (used by FilterBar) ---

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

  const handleToggleMode = useCallback(
    (id: string) => {
      setFilters((prev) =>
        prev.map((f) => (f.id === id ? FilterEngine.toggleMode(f) : f))
      )
    },
    []
  )

  const handleToggleCaseSensitivity = useCallback(
    (id: string) => {
      setFilters((prev) =>
        prev.map((f) => (f.id === id ? FilterEngine.toggleCaseSensitivity(f) : f))
      )
    },
    []
  )

  // --- Settings handlers ---

  /** DRY helper: apply a new config to state, CSS, eviction, and close the panel. */
  const applyConfigChange = useCallback(
    (newConfig: AppConfig) => {
      setConfig(newConfig)
      applyConfigToCSS(newConfig)

      // Handle maxLogEntries decrease -> immediate eviction
      if (newConfig.performance.maxLogEntries < masterList.length) {
        masterList.setMaxEntries(newConfig.performance.maxLogEntries)
        bumpVersion()
      }

      setSettingsOpen(false)
    },
    [masterList, bumpVersion]
  )

  const handleSettingsSave = useCallback(
    (newConfig: AppConfig) => {
      void window.api.saveConfig(newConfig)
      applyConfigChange(newConfig)
    },
    [applyConfigChange]
  )

  const handleSettingsReset = useCallback(() => {
    void window.api
      .resetConfig()
      .then((defaults) => {
        applyConfigChange(defaults)
      })
      .catch((e: unknown) => {
        console.error('Failed to reset config:', e)
      })
  }, [applyConfigChange])

  if (error !== null) {
    return <ErrorScreen errorType={error.type} message={error.message} />
  }

  return (
    <>
      <div className="app-layout">
        <FilterBar
          filters={filters}
          onAddFilter={handleAddFilter}
          onRemoveFilter={handleRemoveFilter}
          onToggleFilter={handleToggleFilter}
          onToggleMode={handleToggleMode}
          onToggleCaseSensitivity={handleToggleCaseSensitivity}
          rightSlot={<ModeToggle mode={mode} onModeChange={setMode} />}
        />
        <div className="app-toolbar">
          <LaneAddInput onAddLane={handleAddLane} />
          <StreamEndIndicator visible={streamEnded} />
          <button
            className="settings-trigger"
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
            type="button"
          >
            ⚙
          </button>
        </div>
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
            onReorderLanes={handleReorderLanes}
            onEditLane={handleEditLane}
            onRemoveLane={handleRemoveLane}
            onToggleLaneCaseSensitivity={handleToggleLaneCaseSensitivity}
          />
        </div>
        {unparseableEntries.length > 0 && (
          <UnparseablePanel entries={unparseableEntries} />
        )}
      </div>
      {settingsOpen && (
        <div
          className="settings-backdrop"
          onClick={() => setSettingsOpen(false)}
          data-testid="settings-backdrop"
        />
      )}
      <SettingsPanel
        isOpen={settingsOpen}
        config={config}
        onSave={handleSettingsSave}
        onReset={handleSettingsReset}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  )
}

export default App
