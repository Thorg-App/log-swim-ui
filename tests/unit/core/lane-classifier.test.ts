import { describe, it, expect } from 'vitest'
import { LaneClassifier } from '@core/lane-classifier'
import { createLaneDefinition, addExtraPatternToLane } from '@core/types'
import type { LogEntry } from '@core/types'

/**
 * Helper to create a minimal LogEntry for testing.
 */
function makeEntry(rawJson: string, laneIndex: number = 0): LogEntry {
  return {
    rawJson,
    fields: {},
    timestamp: new Date(),
    level: '',
    laneIndex
  }
}

describe('LaneClassifier.classify', () => {
  describe('GIVEN lanes ["error", "auth"] and JSON containing "error"', () => {
    describe('WHEN classified', () => {
      it('THEN returns index 0', () => {
        const lanes = [createLaneDefinition('error'), createLaneDefinition('auth')]
        const result = LaneClassifier.classify('{"level":"error","msg":"fail"}', lanes)
        expect(result).toBe(0)
      })
    })
  })

  describe('GIVEN lanes ["error", "auth"] and JSON containing "auth"', () => {
    describe('WHEN classified', () => {
      it('THEN returns index 1', () => {
        const lanes = [createLaneDefinition('error'), createLaneDefinition('auth')]
        const result = LaneClassifier.classify('{"level":"info","msg":"auth login"}', lanes)
        expect(result).toBe(1)
      })
    })
  })

  describe('GIVEN lanes ["error", "auth"] and JSON containing "debug"', () => {
    describe('WHEN classified', () => {
      it('THEN returns lanes.length (unmatched)', () => {
        const lanes = [createLaneDefinition('error'), createLaneDefinition('auth')]
        const result = LaneClassifier.classify('{"level":"debug","msg":"trace"}', lanes)
        expect(result).toBe(lanes.length)
      })
    })
  })

  describe('GIVEN lanes ["error", "auth"] and JSON containing both "error" and "auth"', () => {
    describe('WHEN classified', () => {
      it('THEN returns index 0 (first match wins)', () => {
        const lanes = [createLaneDefinition('error'), createLaneDefinition('auth')]
        const result = LaneClassifier.classify('{"level":"error","msg":"auth error"}', lanes)
        expect(result).toBe(0)
      })
    })
  })

  describe('GIVEN a lane with invalid regex (isError: true)', () => {
    describe('WHEN classified', () => {
      it('THEN skips the error lane and matches the next valid one', () => {
        const lanes = [createLaneDefinition('[invalid'), createLaneDefinition('auth')]
        const result = LaneClassifier.classify('{"msg":"auth login"}', lanes)
        expect(result).toBe(1)
      })
    })
  })

  describe('GIVEN an empty lanes array', () => {
    describe('WHEN classified', () => {
      it('THEN returns 0 (unmatched index equals lanes.length which is 0)', () => {
        const result = LaneClassifier.classify('{"level":"info"}', [])
        expect(result).toBe(0)
      })
    })
  })

  describe('GIVEN a lane with regex pattern "error|ERROR"', () => {
    describe('WHEN classified with JSON containing only "ERROR"', () => {
      it('THEN matches via regex alternation', () => {
        const lanes = [createLaneDefinition('error|ERROR')]
        const result = LaneClassifier.classify('{"level":"ERROR","msg":"fail"}', lanes)
        expect(result).toBe(0)
      })
    })
  })
})

describe('LaneClassifier.classify with case-insensitive lanes', () => {
  describe('GIVEN a case-insensitive lane "error"', () => {
    describe('WHEN classified with JSON containing "ERROR"', () => {
      it('THEN matches the case-insensitive lane', () => {
        const lanes = [createLaneDefinition('error', { caseSensitive: false })]
        const result = LaneClassifier.classify('{"level":"ERROR","msg":"fail"}', lanes)
        expect(result).toBe(0)
      })
    })
  })

  describe('GIVEN a case-sensitive lane "error"', () => {
    describe('WHEN classified with JSON containing only "ERROR"', () => {
      it('THEN does not match (case mismatch)', () => {
        const lanes = [createLaneDefinition('error', { caseSensitive: true })]
        const result = LaneClassifier.classify('{"level":"ERROR","msg":"FAIL"}', lanes)
        expect(result).toBe(lanes.length)
      })
    })
  })
})

describe('LaneClassifier.classify with extra patterns (OR logic)', () => {
  describe('GIVEN a lane with primary pattern "error" and extra pattern "fatal"', () => {
    describe('WHEN classify is called with JSON containing only "fatal"', () => {
      it('THEN returns index 0 (matched via extra pattern)', () => {
        const lane = addExtraPatternToLane(createLaneDefinition('error'), 'fatal')
        const result = LaneClassifier.classify('{"level":"fatal","msg":"crash"}', [lane])
        expect(result).toBe(0)
      })
    })

    describe('WHEN classify is called with JSON containing "error"', () => {
      it('THEN returns index 0 (matched via primary pattern)', () => {
        const lane = addExtraPatternToLane(createLaneDefinition('error'), 'fatal')
        const result = LaneClassifier.classify('{"level":"error","msg":"fail"}', [lane])
        expect(result).toBe(0)
      })
    })

    describe('WHEN classify is called with JSON containing neither', () => {
      it('THEN returns lanes.length (unmatched)', () => {
        const lane = addExtraPatternToLane(createLaneDefinition('error'), 'fatal')
        const lanes = [lane]
        const result = LaneClassifier.classify('{"level":"info","msg":"ok"}', lanes)
        expect(result).toBe(lanes.length)
      })
    })
  })

  describe('GIVEN a lane with an invalid extra pattern (isError: true, regex: null)', () => {
    describe('WHEN classify is called', () => {
      it('THEN the invalid extra pattern is skipped without throwing', () => {
        const lane = addExtraPatternToLane(createLaneDefinition('error'), '[invalid')
        // The invalid extra pattern should not throw; primary pattern "error" still works
        expect(() => LaneClassifier.classify('{"level":"error"}', [lane])).not.toThrow()
      })

      it('THEN match still works via the valid primary pattern', () => {
        const lane = addExtraPatternToLane(createLaneDefinition('error'), '[invalid')
        const result = LaneClassifier.classify('{"level":"error"}', [lane])
        expect(result).toBe(0)
      })
    })
  })

  describe('GIVEN two lanes where lane 0 has extra pattern "auth" and lane 1 has primary pattern "auth"', () => {
    describe('WHEN classify is called with JSON containing "auth"', () => {
      it('THEN returns 0 (first-match-wins across lanes still holds)', () => {
        const lane0 = addExtraPatternToLane(createLaneDefinition('error'), 'auth')
        const lane1 = createLaneDefinition('auth')
        const result = LaneClassifier.classify('{"msg":"auth login"}', [lane0, lane1])
        expect(result).toBe(0)
      })
    })
  })
})

describe('LaneClassifier.reclassifyAll', () => {
  describe('GIVEN entries and new lane order', () => {
    describe('WHEN reclassifyAll is called', () => {
      it('THEN all entries have updated laneIndex', () => {
        const entry1 = makeEntry('{"level":"error","msg":"fail"}', 99)
        const entry2 = makeEntry('{"level":"info","msg":"auth login"}', 99)
        const entry3 = makeEntry('{"level":"debug","msg":"trace"}', 99)

        const newLanes = [createLaneDefinition('auth'), createLaneDefinition('error')]
        LaneClassifier.reclassifyAll([entry1, entry2, entry3], newLanes)

        expect(entry1.laneIndex).toBe(1) // "error" matches second lane
        expect(entry2.laneIndex).toBe(0) // "auth" matches first lane
        expect(entry3.laneIndex).toBe(newLanes.length) // unmatched
      })
    })
  })
})
