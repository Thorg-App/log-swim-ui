import type { LogEntry } from './types'

interface LogBufferConfig {
  readonly flushIntervalMs: number
}

type FlushCallback = (entries: readonly LogEntry[]) => void

/**
 * Timer-based buffer that accumulates LogEntry items and flushes them
 * to a callback at a configurable interval.
 *
 * Owns its flush timer internally. On `close()`, performs a final flush
 * and stops the timer.
 */
class LogBuffer {
  private buffer: LogEntry[] = []
  private timerId: ReturnType<typeof setInterval> | null = null
  private closed: boolean = false
  private readonly onFlush: FlushCallback

  constructor(config: LogBufferConfig, onFlush: FlushCallback) {
    this.onFlush = onFlush
    this.timerId = setInterval(() => this.flush(), config.flushIntervalMs)
  }

  /**
   * Add an entry to the buffer.
   * Throws if the buffer has been closed.
   */
  push(entry: LogEntry): void {
    if (this.closed) {
      throw new Error('Cannot push to a closed LogBuffer')
    }
    this.buffer.push(entry)
  }

  /**
   * Signal stdin close. Performs final flush and stops timer.
   * Idempotent -- calling close() multiple times is safe.
   */
  close(): void {
    if (this.closed) {
      return
    }
    this.closed = true
    this.flush()
    if (this.timerId !== null) {
      clearInterval(this.timerId)
      this.timerId = null
    }
  }

  /**
   * Number of entries currently buffered (not yet flushed).
   */
  get pendingCount(): number {
    return this.buffer.length
  }

  /**
   * Flush the buffer if non-empty. Calls onFlush with accumulated entries
   * and clears the internal buffer.
   */
  private flush(): void {
    if (this.buffer.length === 0) {
      return
    }
    const entries = this.buffer
    this.buffer = []
    this.onFlush(entries)
  }
}

export { LogBuffer }
export type { LogBufferConfig, FlushCallback }
