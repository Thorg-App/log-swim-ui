import '../theme/tokens.css'
import '../theme/components.css'
import type { AppConfig, LaneDefinition } from '@core/types'
import { MasterList } from '@core/master-list'
import { useAppInit } from './useAppInit'
import { useLogIngestion } from './useLogIngestion'
import { ErrorScreen } from './ErrorScreen'

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
    mode
  } = useLogIngestion(masterList, lanes, config)

  if (error !== null) {
    return <ErrorScreen errorType={error.type} message={error.message} />
  }

  return (
    <div className="app-layout">
      <div className="app-toolbar">
        {/* ModeToggle placeholder -- will be implemented in Sub-phase 5C */}
        <span className="text-xs text-muted">Mode: {mode}</span>
        {streamEnded && (
          <span className="stream-ended">
            <span className="stream-ended__dot" />
            Stream ended
          </span>
        )}
      </div>
      <div className="app-main">
        {/* SwimLaneGrid placeholder -- will be implemented in Sub-phase 5B */}
        <div style={{ padding: 'var(--space-4)' }}>
          <p className="text-sm text-muted">
            Entries: {masterList.length} | Lanes: {lanes.length} | Version: {version}
          </p>
          {unparseableEntries.length > 0 && (
            <p className="text-xs text-muted">
              Unparseable: {unparseableEntries.length}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
