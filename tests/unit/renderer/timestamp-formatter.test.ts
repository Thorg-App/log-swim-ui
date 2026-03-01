import { describe, it, expect } from 'vitest'
import { formatTimestamp } from '@renderer/timestamp-formatter'

describe('formatTimestamp', () => {
  describe('GIVEN a Date', () => {
    const date = new Date('2024-01-15T10:30:45.123Z')

    describe('WHEN format is "iso"', () => {
      it('THEN returns ISO-8601 string', () => {
        const result = formatTimestamp(date, 'iso', null)
        expect(result).toBe('2024-01-15T10:30:45.123Z')
      })
    })

    describe('WHEN format is "local"', () => {
      it('THEN returns 24h local time with seconds and milliseconds', () => {
        const result = formatTimestamp(date, 'local', null)
        // Format: HH:MM:SS.mmm -- we verify structure since local time varies by timezone
        expect(result).toMatch(/^\d{2}:\d{2}:\d{2}\.\d{3}$/)
      })
    })
  })

  describe('GIVEN format is "relative"', () => {
    const firstTimestamp = new Date('2024-01-15T10:00:00.000Z')

    describe('WHEN firstTimestamp is null', () => {
      it('THEN returns "+0:00.000"', () => {
        const date = new Date('2024-01-15T10:05:00.000Z')
        const result = formatTimestamp(date, 'relative', null)
        expect(result).toBe('+0:00.000')
      })
    })

    describe('WHEN timestamp equals firstTimestamp', () => {
      it('THEN returns "+0:00.000"', () => {
        const result = formatTimestamp(firstTimestamp, 'relative', firstTimestamp)
        expect(result).toBe('+0:00.000')
      })
    })

    describe('WHEN timestamp is 5 minutes and 3.456 seconds after firstTimestamp', () => {
      it('THEN returns "+5:03.456"', () => {
        const date = new Date(firstTimestamp.getTime() + 5 * 60_000 + 3_456)
        const result = formatTimestamp(date, 'relative', firstTimestamp)
        expect(result).toBe('+5:03.456')
      })
    })

    describe('WHEN timestamp is 1 hour 5 minutes after firstTimestamp', () => {
      it('THEN returns "+1:05:00.000"', () => {
        const date = new Date(firstTimestamp.getTime() + 3_600_000 + 5 * 60_000)
        const result = formatTimestamp(date, 'relative', firstTimestamp)
        expect(result).toBe('+1:05:00.000')
      })
    })

    describe('WHEN timestamp is 30 seconds and 500ms after firstTimestamp', () => {
      it('THEN returns "+0:30.500"', () => {
        const date = new Date(firstTimestamp.getTime() + 30_500)
        const result = formatTimestamp(date, 'relative', firstTimestamp)
        expect(result).toBe('+0:30.500')
      })
    })

    describe('WHEN timestamp is 2 hours 30 minutes 15.789 seconds after firstTimestamp', () => {
      it('THEN returns "+2:30:15.789"', () => {
        const date = new Date(
          firstTimestamp.getTime() + 2 * 3_600_000 + 30 * 60_000 + 15_789
        )
        const result = formatTimestamp(date, 'relative', firstTimestamp)
        expect(result).toBe('+2:30:15.789')
      })
    })
  })
})
