import '../theme/tokens.css'
import '../theme/components.css'
import type { AppConfig, LaneDefinition } from '@core/types'
import { MasterList } from '@core/master-list'
import { useAppInit } from './useAppInit'
import { useLogIngestion } from './useLogIngestion'
import { ErrorScreen } from './ErrorScreen'
import { SwimLaneGrid } from './components/SwimLaneGrid'
import { ModeToggle } from './components/ModeToggle'
import { StreamEndIndicator } from './components/StreamEndIndicator'
import { UnparseablePanel } from './components/UnparseablePanel'

function App() {
  const init = useAppInit()

  if (init.status === 'loading') {
    return (
      <div className="app-layout">
        <div className="app-main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
      lanes={init.lanes}
      masterList={init.masterList}
    />
  )
}

// --- AppShell (active state after init) ---

interface AppShellProps {
  readonly config: AppConfig
  readonly lanes: LaneDefinition[]
  readonly masterList: MasterList
}

function AppShell({ config, lanes, masterList }: AppShellProps) {
  const {
    version,
    streamEnded,
    error,
    unparseableEntries,
    mode,
    setMode
  } = useLogIngestion(masterList, lanes, config)

  if (error !== null) {
    return <ErrorScreen errorType={error.type} message={error.message} />
  }

  return (
    <div className="app-layout">
      <div className="app-toolbar">
        <ModeToggle mode={mode} onModeChange={setMode} />
        <StreamEndIndicator visible={streamEnded} />
      </div>
      <div className="app-main">
        <SwimLaneGrid
          masterList={masterList}
          lanes={lanes}
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
