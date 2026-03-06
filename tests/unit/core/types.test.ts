import { describe, it, expect } from 'vitest'
import {
  createLaneDefinition,
  addExtraPatternToLane,
  removeExtraPatternFromLane,
  rebuildLaneDefinition,
  DEFAULT_APP_CONFIG
} from '@core/types'

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

describe('createLaneDefinition — extraPatterns initialization', () => {
  describe('GIVEN a valid pattern', () => {
    describe('WHEN createLaneDefinition is called', () => {
      it('THEN extraPatterns is initialized to an empty array', () => {
        const lane = createLaneDefinition('error')
        expect(lane.extraPatterns).toEqual([])
      })
    })
  })
})

describe('addExtraPatternToLane', () => {
  describe('GIVEN a lane with no extra patterns and a valid pattern', () => {
    describe('WHEN addExtraPatternToLane is called', () => {
      it('THEN extraPatterns has length 1', () => {
        const lane = createLaneDefinition('error')
        const updated = addExtraPatternToLane(lane, 'fatal')
        expect(updated.extraPatterns).toHaveLength(1)
      })

      it('THEN the new entry has isError false', () => {
        const lane = createLaneDefinition('error')
        const updated = addExtraPatternToLane(lane, 'fatal')
        expect(updated.extraPatterns[0]?.isError).toBe(false)
      })

      it('THEN the new entry preserves the pattern string', () => {
        const lane = createLaneDefinition('error')
        const updated = addExtraPatternToLane(lane, 'fatal')
        expect(updated.extraPatterns[0]?.pattern).toBe('fatal')
      })
    })
  })

  describe('GIVEN a lane with no extra patterns and an invalid regex', () => {
    describe('WHEN addExtraPatternToLane is called', () => {
      it('THEN the new entry has isError true', () => {
        const lane = createLaneDefinition('error')
        const updated = addExtraPatternToLane(lane, '[invalid')
        expect(updated.extraPatterns[0]?.isError).toBe(true)
      })

      it('THEN the new entry has regex null', () => {
        const lane = createLaneDefinition('error')
        const updated = addExtraPatternToLane(lane, '[invalid')
        expect(updated.extraPatterns[0]?.regex).toBeNull()
      })
    })
  })

  describe('GIVEN a lane with caseSensitive false', () => {
    describe('WHEN addExtraPatternToLane is called', () => {
      it('THEN the extra pattern regex has the "i" flag', () => {
        const lane = createLaneDefinition('error', { caseSensitive: false })
        const updated = addExtraPatternToLane(lane, 'fatal')
        expect(updated.extraPatterns[0]?.regex?.flags).toBe('i')
      })
    })
  })

  describe('GIVEN a lane with caseSensitive true', () => {
    describe('WHEN addExtraPatternToLane is called', () => {
      it('THEN the extra pattern regex has no flags', () => {
        const lane = createLaneDefinition('error', { caseSensitive: true })
        const updated = addExtraPatternToLane(lane, 'fatal')
        expect(updated.extraPatterns[0]?.regex?.flags).toBe('')
      })
    })
  })

  describe('GIVEN a lane with 1 extra pattern', () => {
    describe('WHEN addExtraPatternToLane is called again', () => {
      it('THEN extraPatterns has length 2 (immutable append)', () => {
        const lane = createLaneDefinition('error')
        const withOne = addExtraPatternToLane(lane, 'fatal')
        const withTwo = addExtraPatternToLane(withOne, 'warn')
        expect(withTwo.extraPatterns).toHaveLength(2)
      })
    })
  })

  describe('GIVEN the original lane', () => {
    describe('WHEN addExtraPatternToLane is called', () => {
      it('THEN the original lane extraPatterns is unchanged (pure function)', () => {
        const lane = createLaneDefinition('error')
        addExtraPatternToLane(lane, 'fatal')
        expect(lane.extraPatterns).toHaveLength(0)
      })
    })
  })
})

describe('removeExtraPatternFromLane', () => {
  describe('GIVEN a lane with 2 extra patterns', () => {
    describe('WHEN removeExtraPatternFromLane(lane, 0) is called', () => {
      it('THEN extraPatterns has length 1', () => {
        const lane = addExtraPatternToLane(
          addExtraPatternToLane(createLaneDefinition('error'), 'fatal'),
          'warn'
        )
        const updated = removeExtraPatternFromLane(lane, 0)
        expect(updated.extraPatterns).toHaveLength(1)
      })

      it('THEN the remaining entry is the second pattern', () => {
        const lane = addExtraPatternToLane(
          addExtraPatternToLane(createLaneDefinition('error'), 'fatal'),
          'warn'
        )
        const updated = removeExtraPatternFromLane(lane, 0)
        expect(updated.extraPatterns[0]?.pattern).toBe('warn')
      })
    })
  })

  describe('GIVEN a lane with 1 extra pattern', () => {
    describe('WHEN removeExtraPatternFromLane(lane, 0) is called', () => {
      it('THEN extraPatterns is empty', () => {
        const lane = addExtraPatternToLane(createLaneDefinition('error'), 'fatal')
        const updated = removeExtraPatternFromLane(lane, 0)
        expect(updated.extraPatterns).toHaveLength(0)
      })
    })
  })
})

describe('rebuildLaneDefinition', () => {
  describe('GIVEN a lane with caseSensitive false and 1 extra pattern compiled with "i" flag', () => {
    describe('WHEN rebuildLaneDefinition is called with caseSensitive true', () => {
      it('THEN caseSensitive is true on the rebuilt lane', () => {
        const lane = addExtraPatternToLane(createLaneDefinition('error', { caseSensitive: false }), 'fatal')
        const rebuilt = rebuildLaneDefinition(lane.pattern, lane, true)
        expect(rebuilt.caseSensitive).toBe(true)
      })

      it('THEN primary regex has no "i" flag', () => {
        const lane = addExtraPatternToLane(createLaneDefinition('error', { caseSensitive: false }), 'fatal')
        const rebuilt = rebuildLaneDefinition(lane.pattern, lane, true)
        expect(rebuilt.regex?.flags).toBe('')
      })

      it('THEN extra pattern regex has no "i" flag', () => {
        const lane = addExtraPatternToLane(createLaneDefinition('error', { caseSensitive: false }), 'fatal')
        const rebuilt = rebuildLaneDefinition(lane.pattern, lane, true)
        expect(rebuilt.extraPatterns[0]?.regex?.flags).toBe('')
      })
    })
  })

  describe('GIVEN a lane with caseSensitive true', () => {
    describe('WHEN rebuildLaneDefinition is called with caseSensitive false', () => {
      it('THEN all regexes get the "i" flag', () => {
        const lane = addExtraPatternToLane(createLaneDefinition('error', { caseSensitive: true }), 'fatal')
        const rebuilt = rebuildLaneDefinition(lane.pattern, lane, false)
        expect(rebuilt.regex?.flags).toBe('i')
        expect(rebuilt.extraPatterns[0]?.regex?.flags).toBe('i')
      })
    })
  })

  describe('GIVEN a lane with 2 extra patterns', () => {
    describe('WHEN rebuildLaneDefinition is called with a new primary pattern', () => {
      it('THEN extraPatterns length is still 2', () => {
        const lane = addExtraPatternToLane(
          addExtraPatternToLane(createLaneDefinition('error'), 'fatal'),
          'warn'
        )
        const rebuilt = rebuildLaneDefinition('critical', lane, lane.caseSensitive)
        expect(rebuilt.extraPatterns).toHaveLength(2)
      })

      it('THEN the primary pattern is updated', () => {
        const lane = addExtraPatternToLane(
          addExtraPatternToLane(createLaneDefinition('error'), 'fatal'),
          'warn'
        )
        const rebuilt = rebuildLaneDefinition('critical', lane, lane.caseSensitive)
        expect(rebuilt.pattern).toBe('critical')
      })
    })
  })

  describe('GIVEN a lane with 2 extra patterns', () => {
    describe('WHEN rebuildLaneDefinition is called', () => {
      it('THEN the original lane is unchanged (pure function)', () => {
        const lane = addExtraPatternToLane(
          addExtraPatternToLane(createLaneDefinition('error'), 'fatal'),
          'warn'
        )
        rebuildLaneDefinition('critical', lane, lane.caseSensitive)
        expect(lane.pattern).toBe('error')
        expect(lane.extraPatterns).toHaveLength(2)
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
