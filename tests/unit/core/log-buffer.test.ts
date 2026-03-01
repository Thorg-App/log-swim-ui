import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LogBuffer } from '@core/log-buffer'
import type { LogEntry } from '@core/types'

/**
 * Helper to create a minimal LogEntry.
 */
function makeEntry(label: string = 'test'): LogEntry {
  return {
    rawJson: `{"label":"${label}"}`,
    fields: { label },
    timestamp: new Date(),
    level: 'info',
    laneIndex: 0
  }
}

const FLUSH_INTERVAL_MS = 200

describe('LogBuffer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('GIVEN a buffer with 200ms interval', () => {
    describe('WHEN entries are pushed and 200ms elapses', () => {
      it('THEN onFlush is called with the entries', () => {
        const onFlush = vi.fn()
        const buffer = new LogBuffer({ flushIntervalMs: FLUSH_INTERVAL_MS }, onFlush)

        buffer.push(makeEntry('a'))
        buffer.push(makeEntry('b'))

        vi.advanceTimersByTime(FLUSH_INTERVAL_MS)

        expect(onFlush).toHaveBeenCalledTimes(1)
        expect(onFlush).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ rawJson: '{"label":"a"}' }),
            expect.objectContaining({ rawJson: '{"label":"b"}' })
          ])
        )

        buffer.close()
      })
    })
  })

  describe('GIVEN a buffer with entries', () => {
    describe('WHEN less than the interval elapses', () => {
      it('THEN onFlush is not called', () => {
        const onFlush = vi.fn()
        const buffer = new LogBuffer({ flushIntervalMs: FLUSH_INTERVAL_MS }, onFlush)

        buffer.push(makeEntry())
        vi.advanceTimersByTime(FLUSH_INTERVAL_MS - 1)

        expect(onFlush).not.toHaveBeenCalled()

        buffer.close()
      })
    })
  })

  describe('GIVEN a buffer with entries', () => {
    describe('WHEN close() is called', () => {
      it('THEN onFlush is called immediately with all entries', () => {
        const onFlush = vi.fn()
        const buffer = new LogBuffer({ flushIntervalMs: FLUSH_INTERVAL_MS }, onFlush)

        buffer.push(makeEntry('a'))
        buffer.push(makeEntry('b'))
        buffer.close()

        expect(onFlush).toHaveBeenCalledTimes(1)
        expect(onFlush.mock.calls[0][0]).toHaveLength(2)
      })
    })
  })

  describe('GIVEN an empty buffer', () => {
    describe('WHEN the interval elapses', () => {
      it('THEN onFlush is NOT called (no empty flushes)', () => {
        const onFlush = vi.fn()
        const buffer = new LogBuffer({ flushIntervalMs: FLUSH_INTERVAL_MS }, onFlush)

        vi.advanceTimersByTime(FLUSH_INTERVAL_MS)

        expect(onFlush).not.toHaveBeenCalled()

        buffer.close()
      })
    })
  })

  describe('GIVEN a closed buffer', () => {
    describe('WHEN push() is called', () => {
      it('THEN throws an error', () => {
        const onFlush = vi.fn()
        const buffer = new LogBuffer({ flushIntervalMs: FLUSH_INTERVAL_MS }, onFlush)
        buffer.close()

        expect(() => buffer.push(makeEntry())).toThrow('Cannot push to a closed LogBuffer')
      })
    })
  })

  describe('GIVEN a buffer', () => {
    describe('WHEN multiple intervals elapse', () => {
      it('THEN each flush only contains entries from that interval', () => {
        const onFlush = vi.fn()
        const buffer = new LogBuffer({ flushIntervalMs: FLUSH_INTERVAL_MS }, onFlush)

        buffer.push(makeEntry('batch1'))
        vi.advanceTimersByTime(FLUSH_INTERVAL_MS)

        buffer.push(makeEntry('batch2'))
        vi.advanceTimersByTime(FLUSH_INTERVAL_MS)

        expect(onFlush).toHaveBeenCalledTimes(2)
        expect(onFlush.mock.calls[0][0]).toHaveLength(1)
        expect(onFlush.mock.calls[1][0]).toHaveLength(1)
        expect(onFlush.mock.calls[0][0][0].rawJson).toBe('{"label":"batch1"}')
        expect(onFlush.mock.calls[1][0][0].rawJson).toBe('{"label":"batch2"}')

        buffer.close()
      })
    })
  })

  describe('GIVEN a buffer', () => {
    describe('WHEN close() is called twice', () => {
      it('THEN the second close is a no-op (idempotent)', () => {
        const onFlush = vi.fn()
        const buffer = new LogBuffer({ flushIntervalMs: FLUSH_INTERVAL_MS }, onFlush)

        buffer.push(makeEntry())
        buffer.close()

        const callCount = onFlush.mock.calls.length
        buffer.close()

        expect(onFlush.mock.calls.length).toBe(callCount)
      })
    })
  })

  describe('GIVEN a buffer', () => {
    describe('WHEN pendingCount is checked', () => {
      it('THEN it returns the number of buffered entries', () => {
        const onFlush = vi.fn()
        const buffer = new LogBuffer({ flushIntervalMs: FLUSH_INTERVAL_MS }, onFlush)

        expect(buffer.pendingCount).toBe(0)
        buffer.push(makeEntry())
        buffer.push(makeEntry())
        expect(buffer.pendingCount).toBe(2)

        buffer.close()
      })
    })
  })
})
