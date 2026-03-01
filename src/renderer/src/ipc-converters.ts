import type { IpcLogLine, LogEntry, LaneDefinition } from '@core/types'
import { LaneClassifier } from '@core/lane-classifier'

/**
 * Convert an IpcLogLine (main process format with epoch millis timestamp)
 * to a LogEntry (renderer format with Date timestamp and lane assignment).
 *
 * The caller (useLogIngestion) is responsible for filtering out entries
 * with timestamp === 0 before calling this function.
 */
function convertIpcToLogEntry(
  ipcLine: IpcLogLine,
  lanes: readonly LaneDefinition[]
): LogEntry {
  return {
    rawJson: ipcLine.rawJson,
    fields: ipcLine.fields,
    timestamp: new Date(ipcLine.timestamp),
    level: ipcLine.level,
    laneIndex: LaneClassifier.classify(ipcLine.rawJson, lanes)
  }
}

export { convertIpcToLogEntry }
