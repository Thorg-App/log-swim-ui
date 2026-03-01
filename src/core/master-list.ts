import type { LogEntry } from './types'

/**
 * Sorted collection of LogEntry items, ordered by timestamp ascending.
 * Uses binary-search insert and eviction to maintain a bounded, sorted list
 * suitable for virtualized rendering.
 */
class MasterList {
  private readonly _entries: LogEntry[] = []
  private maxEntries: number

  constructor(maxEntries: number) {
    this.maxEntries = maxEntries
  }

  /**
   * Insert a single entry in sorted position (by timestamp ascending).
   * If the list exceeds maxEntries after insertion, the oldest entries are evicted.
   */
  insert(entry: LogEntry): void {
    const index = this.findInsertIndex(entry.timestamp)
    this._entries.splice(index, 0, entry)
    this.evict()
  }

  /**
   * Insert multiple entries (batch from buffer flush).
   * Each entry is inserted individually to maintain sort order.
   */
  insertBatch(entries: readonly LogEntry[]): void {
    for (const entry of entries) {
      const index = this.findInsertIndex(entry.timestamp)
      this._entries.splice(index, 0, entry)
    }
    this.evict()
  }

  /**
   * Get entry at index (for virtualization).
   */
  get(index: number): LogEntry | undefined {
    return this._entries[index]
  }

  /**
   * Current count of entries.
   */
  get length(): number {
    return this._entries.length
  }

  /**
   * Read-only access to all entries (for re-classification).
   */
  get entries(): readonly LogEntry[] {
    return this._entries
  }

  /**
   * Update the maximum number of entries.
   * If the current count exceeds the new limit, the oldest entries are evicted immediately.
   */
  setMaxEntries(n: number): void {
    this.maxEntries = n
    this.evict()
  }

  /**
   * Find the index where entry should be inserted to maintain sort order.
   * If timestamps are equal, insert AFTER existing entries with the same timestamp
   * (preserves arrival order for same-millisecond entries).
   */
  private findInsertIndex(timestamp: Date): number {
    const time = timestamp.getTime()
    let low = 0
    let high = this._entries.length

    while (low < high) {
      // WHY: bitwise shift for integer division -- standard binary search idiom
      const mid = (low + high) >>> 1
      if (this._entries[mid].timestamp.getTime() <= time) {
        low = mid + 1
      } else {
        high = mid
      }
    }

    return low
  }

  /**
   * Remove oldest entries if the list exceeds maxEntries.
   */
  private evict(): void {
    const excess = this._entries.length - this.maxEntries
    if (excess > 0) {
      this._entries.splice(0, excess)
    }
  }
}

export { MasterList }
