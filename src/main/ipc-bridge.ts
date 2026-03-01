import type { Readable } from 'node:stream'
import type { IpcLogLine } from '../core/types'
import { IPC_CHANNELS } from '../core/types'
import { StdinReader } from '../core/stdin-reader'
import type { StdinReaderHandle } from '../core/stdin-reader'
import { JsonParser } from '../core/json-parser'
import { TimestampDetector } from '../core/timestamp-detector'

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
  readonly keyLevel: string
  readonly keyTimestamp: string
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

    const timestampValue = parsed.fields[this.deps.keyTimestamp]

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
    const level = String(parsed.fields[this.deps.keyLevel] ?? 'unknown')

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
