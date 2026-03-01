import { useState, useEffect, useRef, useCallback } from 'react'
import type { RefObject } from 'react'
import type { AppConfig, LaneDefinition, AppErrorType, ViewMode } from '@core/types'
import { MasterList } from '@core/master-list'
import { LogBuffer } from '@core/log-buffer'
import { convertIpcToLogEntry } from './ipc-converters'

const MAX_UNPARSEABLE_ENTRIES = 1_000

interface LogIngestionError {
  readonly type: AppErrorType
  readonly message: string
}

interface LogIngestionResult {
  readonly version: number
  readonly streamEnded: boolean
  readonly error: LogIngestionError | null
  readonly unparseableEntries: readonly string[]
  readonly mode: ViewMode
  readonly setMode: (mode: ViewMode) => void
  readonly bumpVersion: () => void
}

/**
 * Hook that wires IPC callbacks to the data pipeline:
 * IpcLogLine -> convert -> LogBuffer -> MasterList -> version increment -> re-render.
 *
 * Accepts a lanesRef so that lane changes (reorder, add) do NOT cause the IPC
 * effect to teardown/re-setup. The onLogLine callback reads lanesRef.current
 * at invocation time, ensuring new entries classify against the latest lane order.
 *
 * Handles cleanup of IPC listeners and LogBuffer timer on unmount.
 */
function useLogIngestion(
  masterList: MasterList,
  lanesRef: RefObject<readonly LaneDefinition[]>,
  config: AppConfig
): LogIngestionResult {
  const [version, setVersion] = useState(0)
  const [streamEnded, setStreamEnded] = useState(false)
  const [error, setError] = useState<LogIngestionError | null>(null)
  const [mode, setMode] = useState<ViewMode>('live')
  const unparseableRef = useRef<string[]>([])
  const [unparseableCount, setUnparseableCount] = useState(0)

  // WHY: configRef prevents IPC listener teardown when config changes (e.g. settings panel edits).
  // The LogBuffer reads flushIntervalMs only at creation time. Any config value needed inside
  // the IPC callback should be read from configRef.current at invocation time.
  const configRef = useRef(config)
  useEffect(() => {
    configRef.current = config
  }, [config])

  const bumpVersion = useCallback(() => {
    setVersion((v) => v + 1)
  }, [])

  useEffect(() => {
    const logBuffer = new LogBuffer(
      { flushIntervalMs: configRef.current.performance.flushIntervalMs },
      (entries) => {
        masterList.insertBatch(entries)
        setVersion((v) => v + 1)
      }
    )

    const unsubLogLine = window.api.onLogLine((ipcLine) => {
      if (ipcLine.timestamp === 0) {
        if (unparseableRef.current.length < MAX_UNPARSEABLE_ENTRIES) {
          unparseableRef.current.push(ipcLine.rawJson)
          setUnparseableCount(unparseableRef.current.length)
        }
        return
      }
      // WHY: Read lanesRef.current at invocation time (not from closure) so that
      // new entries are classified against the latest lane order after reorder/add.
      const entry = convertIpcToLogEntry(ipcLine, lanesRef.current)
      logBuffer.push(entry)
    })

    const unsubStreamEnd = window.api.onStreamEnd(() => {
      logBuffer.close()
      setStreamEnded(true)
    })

    const unsubStreamError = window.api.onStreamError((msg) => {
      setError({ type: 'stream-error', message: msg })
    })

    const unsubConfigError = window.api.onConfigError((msg) => {
      setError({ type: 'config-error', message: msg })
    })

    // WHY: Signal to main process that all IPC listeners are now registered.
    // Main waits for this before starting stdin ingestion (IpcBridge.start()),
    // preventing the race where LOG_LINE/STREAM_END messages are sent before
    // listeners exist and silently dropped by Electron IPC.
    window.api.signalReady()

    return () => {
      unsubLogLine()
      unsubStreamEnd()
      unsubStreamError()
      unsubConfigError()
      logBuffer.close() // idempotent -- safe even if onStreamEnd already called it
    }
    // WHY: lanesRef and configRef are stable ref objects -- their identities never change,
    // so including them does NOT cause re-runs. Lane changes and config changes are picked
    // up at invocation time via .current inside callbacks.
  }, [masterList, lanesRef, configRef])

  // WHY: unparseableCount triggers re-reads of unparseableRef.current
  // This avoids making the full array part of state (which would copy on every push)
  void unparseableCount

  return {
    version,
    streamEnded,
    error,
    unparseableEntries: unparseableRef.current,
    mode,
    setMode,
    bumpVersion
  }
}

export { useLogIngestion, MAX_UNPARSEABLE_ENTRIES }
export type { LogIngestionResult, LogIngestionError }
