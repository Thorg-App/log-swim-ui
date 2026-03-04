import { describe, it, expect } from 'vitest'
import {
  getLevelCssClass,
  getLevelTextCssClass,
  getMessagePreview,
  getGridColumn,
  getTotalLaneCount
} from '@renderer/log-row-utils'
import type { LogEntry, LaneDefinition } from '@core/types'

// --- Helper ---

function makeEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    rawJson: '{"level":"info","message":"hello"}',
    fields: { level: 'info', message: 'hello' },
    timestamp: new Date('2024-01-15T10:30:00.000Z'),
    level: 'info',
    laneIndex: 0,
    ...overrides
  }
}

function makeLane(pattern: string): LaneDefinition {
  return { pattern, regex: new RegExp(pattern), isError: false }
}

// --- getLevelCssClass ---

describe('getLevelCssClass', () => {
  describe('GIVEN a known log level', () => {
    const knownLevels = [
      'trace',
      'debug',
      'info',
      'notice',
      'warn',
      'warning',
      'error',
      'fatal',
      'critical'
    ]

    for (const level of knownLevels) {
      describe(`WHEN level is "${level}"`, () => {
        it(`THEN returns "log-row--${level}"`, () => {
          expect(getLevelCssClass(level)).toBe(`log-row--${level}`)
        })
      })
    }
  })

  describe('GIVEN an uppercase known level', () => {
    describe('WHEN level is "WARN"', () => {
      it('THEN normalizes to lowercase and returns "log-row--warn"', () => {
        expect(getLevelCssClass('WARN')).toBe('log-row--warn')
      })
    })
  })

  describe('GIVEN a mixed-case known level', () => {
    describe('WHEN level is "Error"', () => {
      it('THEN normalizes to lowercase and returns "log-row--error"', () => {
        expect(getLevelCssClass('Error')).toBe('log-row--error')
      })
    })
  })

  describe('GIVEN an unknown log level', () => {
    describe('WHEN level is "custom"', () => {
      it('THEN returns "log-row--unrecognized"', () => {
        expect(getLevelCssClass('custom')).toBe('log-row--unrecognized')
      })
    })

    describe('WHEN level is empty string', () => {
      it('THEN returns "log-row--unrecognized"', () => {
        expect(getLevelCssClass('')).toBe('log-row--unrecognized')
      })
    })

    describe('WHEN level is "unknown"', () => {
      it('THEN returns "log-row--unrecognized"', () => {
        expect(getLevelCssClass('unknown')).toBe('log-row--unrecognized')
      })
    })
  })
})

// --- getLevelTextCssClass ---

describe('getLevelTextCssClass', () => {
  describe('GIVEN a known log level', () => {
    const knownLevels = [
      'trace',
      'debug',
      'info',
      'notice',
      'warn',
      'warning',
      'error',
      'fatal',
      'critical'
    ]

    for (const level of knownLevels) {
      describe(`WHEN level is "${level}"`, () => {
        it(`THEN returns "log-row__level--${level}"`, () => {
          expect(getLevelTextCssClass(level)).toBe(`log-row__level--${level}`)
        })
      })
    }
  })

  describe('GIVEN an uppercase known level', () => {
    describe('WHEN level is "ERROR"', () => {
      it('THEN normalizes to lowercase and returns "log-row__level--error"', () => {
        expect(getLevelTextCssClass('ERROR')).toBe('log-row__level--error')
      })
    })
  })

  describe('GIVEN a mixed-case known level', () => {
    describe('WHEN level is "Fatal"', () => {
      it('THEN normalizes to lowercase and returns "log-row__level--fatal"', () => {
        expect(getLevelTextCssClass('Fatal')).toBe('log-row__level--fatal')
      })
    })
  })

  describe('GIVEN an unknown log level', () => {
    describe('WHEN level is "custom"', () => {
      it('THEN returns "log-row__level--unrecognized"', () => {
        expect(getLevelTextCssClass('custom')).toBe('log-row__level--unrecognized')
      })
    })

    describe('WHEN level is empty string', () => {
      it('THEN returns "log-row__level--unrecognized"', () => {
        expect(getLevelTextCssClass('')).toBe('log-row__level--unrecognized')
      })
    })

    describe('WHEN level is "unknown"', () => {
      it('THEN returns "log-row__level--unrecognized"', () => {
        expect(getLevelTextCssClass('unknown')).toBe('log-row__level--unrecognized')
      })
    })
  })
})

// --- getMessagePreview ---

describe('getMessagePreview', () => {
  describe('GIVEN an entry with fields.message as a string', () => {
    describe('WHEN getMessagePreview is called', () => {
      it('THEN returns the message value', () => {
        const entry = makeEntry({
          fields: { message: 'User logged in successfully' }
        })
        expect(getMessagePreview(entry)).toBe('User logged in successfully')
      })
    })
  })

  describe('GIVEN an entry with fields.msg but not fields.message', () => {
    describe('WHEN getMessagePreview is called', () => {
      it('THEN returns the msg value', () => {
        const entry = makeEntry({
          fields: { msg: 'Request processed' }
        })
        expect(getMessagePreview(entry)).toBe('Request processed')
      })
    })
  })

  describe('GIVEN an entry with both fields.message and fields.msg', () => {
    describe('WHEN getMessagePreview is called', () => {
      it('THEN returns fields.message (higher priority)', () => {
        const entry = makeEntry({
          fields: { message: 'from message', msg: 'from msg' }
        })
        expect(getMessagePreview(entry)).toBe('from message')
      })
    })
  })

  describe('GIVEN an entry with neither fields.message nor fields.msg', () => {
    describe('WHEN getMessagePreview is called', () => {
      it('THEN returns the rawJson', () => {
        const entry = makeEntry({
          fields: { level: 'info', status: 200 },
          rawJson: '{"level":"info","status":200}'
        })
        expect(getMessagePreview(entry)).toBe('{"level":"info","status":200}')
      })
    })
  })

  describe('GIVEN an entry with fields.message that is not a string', () => {
    describe('WHEN getMessagePreview is called', () => {
      it('THEN falls through to rawJson', () => {
        const entry = makeEntry({
          fields: { message: 42 },
          rawJson: '{"message":42}'
        })
        expect(getMessagePreview(entry)).toBe('{"message":42}')
      })
    })
  })

  describe('GIVEN a long message exceeding maxLength', () => {
    describe('WHEN getMessagePreview is called with maxLength 10', () => {
      it('THEN truncates with ellipsis', () => {
        const entry = makeEntry({
          fields: { message: 'This is a very long message' }
        })
        const result = getMessagePreview(entry, 10)
        expect(result).toBe('This is a \u2026')
        expect(result.length).toBe(11) // 10 chars + ellipsis
      })
    })
  })

  describe('GIVEN a message exactly at maxLength', () => {
    describe('WHEN getMessagePreview is called', () => {
      it('THEN returns the message without truncation', () => {
        const entry = makeEntry({
          fields: { message: '1234567890' }
        })
        expect(getMessagePreview(entry, 10)).toBe('1234567890')
      })
    })
  })
})

// --- getGridColumn ---

describe('getGridColumn', () => {
  describe('GIVEN laneIndex 0', () => {
    describe('WHEN getGridColumn is called', () => {
      it('THEN returns 1 (CSS grid is 1-indexed)', () => {
        expect(getGridColumn(0)).toBe(1)
      })
    })
  })

  describe('GIVEN laneIndex 2', () => {
    describe('WHEN getGridColumn is called', () => {
      it('THEN returns 3', () => {
        expect(getGridColumn(2)).toBe(3)
      })
    })
  })

  describe('GIVEN laneIndex 5 (e.g. unmatched lane when 5 lanes defined)', () => {
    describe('WHEN getGridColumn is called', () => {
      it('THEN returns 6', () => {
        expect(getGridColumn(5)).toBe(6)
      })
    })
  })
})

// --- getTotalLaneCount ---

describe('getTotalLaneCount', () => {
  describe('GIVEN 3 lane definitions', () => {
    describe('WHEN getTotalLaneCount is called', () => {
      it('THEN returns 4 (3 lanes + 1 unmatched)', () => {
        const lanes = [makeLane('error'), makeLane('auth'), makeLane('api')]
        expect(getTotalLaneCount(lanes)).toBe(4)
      })
    })
  })

  describe('GIVEN 0 lane definitions', () => {
    describe('WHEN getTotalLaneCount is called', () => {
      it('THEN returns 1 (just the unmatched lane)', () => {
        expect(getTotalLaneCount([])).toBe(1)
      })
    })
  })

  describe('GIVEN 1 lane definition', () => {
    describe('WHEN getTotalLaneCount is called', () => {
      it('THEN returns 2', () => {
        const lanes = [makeLane('error')]
        expect(getTotalLaneCount(lanes)).toBe(2)
      })
    })
  })
})
