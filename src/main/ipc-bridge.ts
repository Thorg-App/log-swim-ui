import type { Readable } from 'node:stream'
import type { IpcLogLine } from '../core/types'
import { IPC_CHANNELS } from '../core/types'
import { StdinReader } from '../core/stdin-reader'
import type { StdinReaderHandle } from '../core/stdin-reader'
import { JsonParser } from '../core/json-parser'
import { TimestampDetector } from '../core/timestamp-detector'

// --- Line Filtering Constants ---

/**
 * Regex pattern for tail -F separator lines.
 * Format: "==> filename <==" where filename is non-empty.
 * Example: "==> /var/log/app.log <=="
 */
const TAIL_SEPARATOR_PATTERN = /^==> .+ <==$/

// --- IPC Sender Abstraction ---

/**
 * Abstraction over Electron's webContents.send.
 * Enables unit testing without Electron dependency.
 */
interface IpcSender {
  send(channel: string, ...args: unknown[]): void
}

// --- IPC Bridge Dependencies ---

interface IpcBridgeDeps {
  readonly inputKeyLevel: string
  readonly inputKeyTimestamp: string
  readonly sender: IpcSender
}

// --- IPC Bridge ---

/**
 * Wires stdin reading -> JSON parsing -> timestamp detection -> IPC send.
 *
 * The bridge is the core data pipeline connector between Electron's main
 * process and the renderer process. It reads lines from stdin, parses JSON,
 * detects timestamps, extracts level, and sends structured IpcLogLine
 * objects to the renderer via IPC.
 *
 * Per spec: if the first line fails JSON parse or timestamp detection,
 * ingestion HALTS (stream-error sent, reading stops, app window stays open).
 */
class IpcBridge {
  private readonly timestampDetector = new TimestampDetector()
  private firstLine = true
  private readonly deps: IpcBridgeDeps
  private readerHandle: StdinReaderHandle | null = null

  constructor(deps: IpcBridgeDeps) {
    this.deps = deps
  }

  /**
   * Filter out non-JSON lines that should be ignored.
   * - tail -F separator lines: "==> filename <=="
   * - Empty lines (after trimming whitespace)
   */
  private static shouldIgnoreLine(line: string): boolean {
    // Empty line check (after trimming whitespace)
    if (line.trim().length === 0) {
      return true
    }

    // tail -F separator pattern: "==> filename <=="
    if (TAIL_SEPARATOR_PATTERN.test(line)) {
      return true
    }

    return false
  }

  /**
   * Start reading from the input stream.
   * Wires StdinReader callbacks to the processing pipeline.
   */
  start(input: Readable): void {
    this.readerHandle = StdinReader.start(input, {
      onLine: (line) => this.handleLine(line),
      onEnd: () => this.handleEnd(),
      onError: (error) => this.handleError(error)
    })
  }

  private handleLine(line: string): void {
    // Filter out tail -F separators and empty lines
    if (IpcBridge.shouldIgnoreLine(line)) {
      return
    }

    const parsed = JsonParser.parse(line)

    if (!parsed.ok) {
      if (this.firstLine) {
        this.deps.sender.send(
          IPC_CHANNELS.STREAM_ERROR,
          `First line is not valid JSON: ${parsed.error}`
        )
        this.haltIngestion()
      }
      // Non-first line invalid JSON: silently skip
      return
    }

    const timestampValue = parsed.fields[this.deps.inputKeyTimestamp]

    if (this.firstLine) {
      this.firstLine = false
      try {
        this.timestampDetector.detectAndLock(timestampValue)
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error'
        this.deps.sender.send(
          IPC_CHANNELS.STREAM_ERROR,
          `Failed to detect timestamp format: ${message}`
        )
        this.haltIngestion()
        return
      }
    }

    // Parse timestamp using locked format
    let timestampMillis = 0
    const tsResult = this.timestampDetector.parse(timestampValue)
    if (tsResult.ok) {
      timestampMillis = tsResult.value.getTime()
    }
    // If parse fails, timestamp stays 0 (unparseable)

    // Extract level
    const level = String(parsed.fields[this.deps.inputKeyLevel] ?? 'unknown')

    const ipcLine: IpcLogLine = {
      rawJson: parsed.rawJson,
      fields: parsed.fields,
      timestamp: timestampMillis,
      level
    }

    this.deps.sender.send(IPC_CHANNELS.LOG_LINE, ipcLine)
  }

  private handleEnd(): void {
    this.deps.sender.send(IPC_CHANNELS.STREAM_END)
  }

  private handleError(error: Error): void {
    this.deps.sender.send(IPC_CHANNELS.STREAM_ERROR, error.message)
  }

  /**
   * Stop reading from stdin. Per spec, ingestion halts on first-line errors.
   * The app window stays open showing the error state.
   */
  private haltIngestion(): void {
    if (this.readerHandle) {
      this.readerHandle.stop()
      this.readerHandle = null
    }
  }
}

export { IpcBridge }
export type { IpcSender, IpcBridgeDeps }
