import { describe, it, expect } from 'vitest'
import { TimestampDetector } from '@core/timestamp-detector'

describe('TimestampDetector', () => {
  describe('detectAndLock', () => {
    describe('GIVEN an ISO 8601 string', () => {
      describe('WHEN detectAndLock is called', () => {
        it('THEN returns a Date object', () => {
          const detector = new TimestampDetector()
          const result = detector.detectAndLock('2024-01-15T10:30:00.000Z')
          expect(result).toBeInstanceOf(Date)
        })

        it('THEN locks the format as iso8601', () => {
          const detector = new TimestampDetector()
          detector.detectAndLock('2024-01-15T10:30:00.000Z')
          expect(detector.getLockedFormat()).toBe('iso8601')
        })

        it('THEN the returned Date has the correct time value', () => {
          const detector = new TimestampDetector()
          const result = detector.detectAndLock('2024-01-15T10:30:00.000Z')
          expect(result.toISOString()).toBe('2024-01-15T10:30:00.000Z')
        })
      })
    })

    describe('GIVEN an epoch millis number', () => {
      describe('WHEN detectAndLock is called', () => {
        it('THEN returns a Date object', () => {
          const detector = new TimestampDetector()
          const result = detector.detectAndLock(1705312200000)
          expect(result).toBeInstanceOf(Date)
        })

        it('THEN locks the format as epochMillis', () => {
          const detector = new TimestampDetector()
          detector.detectAndLock(1705312200000)
          expect(detector.getLockedFormat()).toBe('epochMillis')
        })
      })
    })

    describe('GIVEN an unparseable string value', () => {
      describe('WHEN detectAndLock is called', () => {
        it('THEN throws with a descriptive error', () => {
          const detector = new TimestampDetector()
          expect(() => detector.detectAndLock('not-a-date')).toThrow(
            'Cannot detect timestamp format'
          )
        })
      })
    })

    describe('GIVEN a negative number', () => {
      describe('WHEN detectAndLock is called', () => {
        it('THEN throws because it is out of range', () => {
          const detector = new TimestampDetector()
          expect(() => detector.detectAndLock(-100)).toThrow('outside valid epoch millis range')
        })
      })
    })

    describe('GIVEN a number greater than year 2100 in millis', () => {
      describe('WHEN detectAndLock is called', () => {
        it('THEN throws because it is out of range', () => {
          const detector = new TimestampDetector()
          expect(() => detector.detectAndLock(5000000000000)).toThrow(
            'outside valid epoch millis range'
          )
        })
      })
    })

    describe('GIVEN zero', () => {
      describe('WHEN detectAndLock is called', () => {
        it('THEN throws because zero is not in the valid range', () => {
          const detector = new TimestampDetector()
          expect(() => detector.detectAndLock(0)).toThrow('outside valid epoch millis range')
        })
      })
    })

    describe('GIVEN an undefined value', () => {
      describe('WHEN detectAndLock is called', () => {
        it('THEN throws with a descriptive error about the type', () => {
          const detector = new TimestampDetector()
          expect(() => detector.detectAndLock(undefined)).toThrow('got undefined')
        })
      })
    })

    describe('GIVEN a boolean value', () => {
      describe('WHEN detectAndLock is called', () => {
        it('THEN throws with a descriptive error about the type', () => {
          const detector = new TimestampDetector()
          expect(() => detector.detectAndLock(true)).toThrow('got boolean')
        })
      })
    })
  })

  describe('parse', () => {
    describe('GIVEN format not yet locked', () => {
      describe('WHEN parse is called', () => {
        it('THEN throws because detectAndLock must be called first', () => {
          const detector = new TimestampDetector()
          expect(() => detector.parse('2024-01-15T10:30:00.000Z')).toThrow(
            'called before detectAndLock'
          )
        })
      })
    })

    describe('GIVEN format locked as iso8601', () => {
      const createIsoDetector = (): TimestampDetector => {
        const detector = new TimestampDetector()
        detector.detectAndLock('2024-01-15T10:30:00.000Z')
        return detector
      }

      describe('WHEN parse is called with a valid ISO string', () => {
        it('THEN returns success with a Date', () => {
          const detector = createIsoDetector()
          const result = detector.parse('2024-06-01T12:00:00.000Z')
          expect(result.ok).toBe(true)
          if (!result.ok) throw new Error('Expected success')
          expect(result.value).toBeInstanceOf(Date)
        })
      })

      describe('WHEN parse is called with a number', () => {
        it('THEN returns failure', () => {
          const detector = createIsoDetector()
          const result = detector.parse(1705312200000)
          expect(result.ok).toBe(false)
          if (result.ok) throw new Error('Expected failure')
          expect(result.error).toContain('Expected string')
        })
      })

      describe('WHEN parse is called with an invalid ISO string', () => {
        it('THEN returns failure', () => {
          const detector = createIsoDetector()
          const result = detector.parse('not-a-date')
          expect(result.ok).toBe(false)
          if (result.ok) throw new Error('Expected failure')
          expect(result.error).toContain('Invalid ISO 8601')
        })
      })
    })

    describe('GIVEN format locked as epochMillis', () => {
      const createEpochDetector = (): TimestampDetector => {
        const detector = new TimestampDetector()
        detector.detectAndLock(1705312200000)
        return detector
      }

      describe('WHEN parse is called with a valid number', () => {
        it('THEN returns success with a Date', () => {
          const detector = createEpochDetector()
          const result = detector.parse(1705312300000)
          expect(result.ok).toBe(true)
          if (!result.ok) throw new Error('Expected success')
          expect(result.value).toBeInstanceOf(Date)
        })
      })

      describe('WHEN parse is called with a string', () => {
        it('THEN returns failure', () => {
          const detector = createEpochDetector()
          const result = detector.parse('2024-01-15T10:30:00.000Z')
          expect(result.ok).toBe(false)
          if (result.ok) throw new Error('Expected failure')
          expect(result.error).toContain('Expected number')
        })
      })

      describe('WHEN parse is called with an out-of-range number', () => {
        it('THEN returns failure', () => {
          const detector = createEpochDetector()
          const result = detector.parse(-1)
          expect(result.ok).toBe(false)
          if (result.ok) throw new Error('Expected failure')
          expect(result.error).toContain('outside valid range')
        })
      })
    })
  })

  describe('getLockedFormat', () => {
    describe('GIVEN a newly created detector', () => {
      it('THEN returns null', () => {
        const detector = new TimestampDetector()
        expect(detector.getLockedFormat()).toBeNull()
      })
    })
  })
})
