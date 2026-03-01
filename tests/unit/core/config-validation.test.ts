import { describe, it, expect } from 'vitest'
import { isValidHexColor, isInRange } from '@core/config-validation'
import { CONFIG_CONSTRAINTS, VIEW_TIMESTAMP_FORMATS } from '@core/types'

describe('isValidHexColor', () => {
  describe('GIVEN a valid 6-digit hex color', () => {
    describe('WHEN isValidHexColor is called', () => {
      it('THEN returns true for lowercase', () => {
        expect(isValidHexColor('#ff00aa')).toBe(true)
      })

      it('THEN returns true for uppercase', () => {
        expect(isValidHexColor('#FF00AA')).toBe(true)
      })

      it('THEN returns true for mixed case', () => {
        expect(isValidHexColor('#aB12cD')).toBe(true)
      })

      it('THEN returns true for all zeros', () => {
        expect(isValidHexColor('#000000')).toBe(true)
      })

      it('THEN returns true for all F', () => {
        expect(isValidHexColor('#FFFFFF')).toBe(true)
      })
    })
  })

  describe('GIVEN an invalid hex color', () => {
    describe('WHEN isValidHexColor is called', () => {
      it('THEN returns false for missing hash', () => {
        expect(isValidHexColor('FF00AA')).toBe(false)
      })

      it('THEN returns false for 3-digit shorthand', () => {
        expect(isValidHexColor('#F0A')).toBe(false)
      })

      it('THEN returns false for 8-digit (with alpha)', () => {
        expect(isValidHexColor('#FF00AAFF')).toBe(false)
      })

      it('THEN returns false for non-hex characters', () => {
        expect(isValidHexColor('#GGGGGG')).toBe(false)
      })

      it('THEN returns false for empty string', () => {
        expect(isValidHexColor('')).toBe(false)
      })

      it('THEN returns false for a word', () => {
        expect(isValidHexColor('red')).toBe(false)
      })
    })
  })
})

describe('isInRange', () => {
  describe('GIVEN a value within range', () => {
    describe('WHEN isInRange is called', () => {
      it('THEN returns true for value at minimum', () => {
        expect(isInRange(16, 16, 128)).toBe(true)
      })

      it('THEN returns true for value at maximum', () => {
        expect(isInRange(128, 16, 128)).toBe(true)
      })

      it('THEN returns true for value in middle', () => {
        expect(isInRange(50, 16, 128)).toBe(true)
      })
    })
  })

  describe('GIVEN a value outside range', () => {
    describe('WHEN isInRange is called', () => {
      it('THEN returns false for value below minimum', () => {
        expect(isInRange(15, 16, 128)).toBe(false)
      })

      it('THEN returns false for value above maximum', () => {
        expect(isInRange(129, 16, 128)).toBe(false)
      })
    })
  })

  describe('GIVEN CONFIG_CONSTRAINTS boundary values', () => {
    describe('WHEN checking rowHeight constraints', () => {
      it('THEN min boundary is accepted', () => {
        const { min, max } = CONFIG_CONSTRAINTS.rowHeight
        expect(isInRange(min, min, max)).toBe(true)
      })

      it('THEN max boundary is accepted', () => {
        const { min, max } = CONFIG_CONSTRAINTS.rowHeight
        expect(isInRange(max, min, max)).toBe(true)
      })

      it('THEN below min is rejected', () => {
        const { min, max } = CONFIG_CONSTRAINTS.rowHeight
        expect(isInRange(min - 1, min, max)).toBe(false)
      })

      it('THEN above max is rejected', () => {
        const { min, max } = CONFIG_CONSTRAINTS.rowHeight
        expect(isInRange(max + 1, min, max)).toBe(false)
      })
    })

    describe('WHEN checking maxLogEntries constraints', () => {
      it('THEN min boundary is accepted', () => {
        const { min, max } = CONFIG_CONSTRAINTS.maxLogEntries
        expect(isInRange(min, min, max)).toBe(true)
      })

      it('THEN max boundary is accepted', () => {
        const { min, max } = CONFIG_CONSTRAINTS.maxLogEntries
        expect(isInRange(max, min, max)).toBe(true)
      })
    })
  })
})

describe('VIEW_TIMESTAMP_FORMATS', () => {
  it('contains exactly iso, local, and relative', () => {
    expect(VIEW_TIMESTAMP_FORMATS).toEqual(['iso', 'local', 'relative'])
  })
})
