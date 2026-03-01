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

  const bumpVersion = useCallback(() => {
    setVersion((v) => v + 1)
  }, [])

  useEffect(() => {
    const logBuffer = new LogBuffer(
      { flushIntervalMs: config.performance.flushIntervalMs },
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

    return () => {
      unsubLogLine()
      unsubStreamEnd()
      unsubStreamError()
      unsubConfigError()
      logBuffer.close() // idempotent -- safe even if onStreamEnd already called it
    }
    // WHY: lanesRef is a stable ref object -- NOT included as dependency.
    // Lane changes are picked up at invocation time via lanesRef.current.
    // config stability is assumed (never changes after init; Phase 07 may need ref pattern too).
  }, [masterList, lanesRef, config])

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
