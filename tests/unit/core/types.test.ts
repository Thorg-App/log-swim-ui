import { describe, it, expect } from 'vitest'
import { createLaneDefinition, DEFAULT_APP_CONFIG } from '@core/types'

describe('createLaneDefinition', () => {
  describe('GIVEN a valid regex pattern', () => {
    describe('WHEN createLaneDefinition is called', () => {
      it('THEN returns a LaneDefinition with compiled regex and isError false', () => {
        const lane = createLaneDefinition('error|ERROR')
        expect(lane.regex).toBeInstanceOf(RegExp)
        expect(lane.isError).toBe(false)
      })

      it('THEN preserves the original pattern string', () => {
        const lane = createLaneDefinition('error|ERROR')
        expect(lane.pattern).toBe('error|ERROR')
      })
    })
  })

  describe('GIVEN an invalid regex pattern', () => {
    describe('WHEN createLaneDefinition is called', () => {
      it('THEN returns a LaneDefinition with null regex and isError true', () => {
        const lane = createLaneDefinition('[invalid')
        expect(lane.regex).toBeNull()
        expect(lane.isError).toBe(true)
      })

      it('THEN preserves the original pattern string', () => {
        const lane = createLaneDefinition('[invalid')
        expect(lane.pattern).toBe('[invalid')
      })
    })
  })

  describe('GIVEN no caseSensitive option', () => {
    describe('WHEN createLaneDefinition is called', () => {
      it('THEN defaults caseSensitive to false', () => {
        const lane = createLaneDefinition('error')
        expect(lane.caseSensitive).toBe(false)
      })

      it('THEN compiles regex with "i" flag', () => {
        const lane = createLaneDefinition('error')
        expect(lane.regex?.flags).toBe('i')
      })
    })
  })

  describe('GIVEN caseSensitive option set to false', () => {
    describe('WHEN createLaneDefinition is called', () => {
      it('THEN caseSensitive is false', () => {
        const lane = createLaneDefinition('error', { caseSensitive: false })
        expect(lane.caseSensitive).toBe(false)
      })

      it('THEN compiles regex with "i" flag', () => {
        const lane = createLaneDefinition('error', { caseSensitive: false })
        expect(lane.regex?.flags).toBe('i')
      })

      it('THEN the regex matches case-insensitively', () => {
        const lane = createLaneDefinition('error', { caseSensitive: false })
        expect(lane.regex?.test('ERROR')).toBe(true)
        expect(lane.regex?.test('Error')).toBe(true)
        expect(lane.regex?.test('error')).toBe(true)
      })
    })
  })

  describe('GIVEN caseSensitive option set to true', () => {
    describe('WHEN createLaneDefinition is called', () => {
      it('THEN caseSensitive is true', () => {
        const lane = createLaneDefinition('error', { caseSensitive: true })
        expect(lane.caseSensitive).toBe(true)
      })

      it('THEN the regex matches case-sensitively', () => {
        const lane = createLaneDefinition('error', { caseSensitive: true })
        expect(lane.regex?.test('error')).toBe(true)
        expect(lane.regex?.test('ERROR')).toBe(false)
      })
    })
  })

  describe('GIVEN an invalid regex pattern with caseSensitive false', () => {
    describe('WHEN createLaneDefinition is called', () => {
      it('THEN returns isError true and preserves caseSensitive', () => {
        const lane = createLaneDefinition('[invalid', { caseSensitive: false })
        expect(lane.isError).toBe(true)
        expect(lane.caseSensitive).toBe(false)
      })
    })
  })
})

describe('DEFAULT_APP_CONFIG', () => {
  describe('GIVEN the default application config', () => {
    it('THEN has flushIntervalMs of 200', () => {
      expect(DEFAULT_APP_CONFIG.performance.flushIntervalMs).toBe(200)
    })

    it('THEN has maxLogEntries of 20000', () => {
      expect(DEFAULT_APP_CONFIG.performance.maxLogEntries).toBe(20000)
    })

    it('THEN has rowHeight of 28', () => {
      expect(DEFAULT_APP_CONFIG.ui.rowHeight).toBe(28)
    })

    it('THEN has fontSize of 13', () => {
      expect(DEFAULT_APP_CONFIG.ui.fontSize).toBe(13)
    })

    it('THEN has viewTimestampFormat of iso', () => {
      expect(DEFAULT_APP_CONFIG.ui.viewTimestampFormat).toBe('iso')
    })

    it('THEN has a dark background color', () => {
      expect(DEFAULT_APP_CONFIG.colors.background).toBe('#0F172A')
    })

    it('THEN has level colors for standard log levels', () => {
      const levels = DEFAULT_APP_CONFIG.colors.levels
      expect(levels['trace']).toBeDefined()
      expect(levels['debug']).toBeDefined()
      expect(levels['info']).toBeDefined()
      expect(levels['warn']).toBeDefined()
      expect(levels['error']).toBeDefined()
      expect(levels['fatal']).toBeDefined()
    })
  })
})
