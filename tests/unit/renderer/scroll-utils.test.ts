import { describe, it, expect } from 'vitest'
import { isScrollingUp } from '@renderer/scroll-utils'

describe('isScrollingUp', () => {
  describe('GIVEN lastScrollTop=100 and currentScrollTop=80', () => {
    describe('WHEN threshold is 5', () => {
      it('THEN returns true (scrolled up by 20px, exceeds threshold)', () => {
        expect(isScrollingUp(100, 80, 5)).toBe(true)
      })
    })
  })

  describe('GIVEN lastScrollTop=100 and currentScrollTop=102', () => {
    describe('WHEN threshold is 5', () => {
      it('THEN returns false (scrolled down, not up)', () => {
        expect(isScrollingUp(100, 102, 5)).toBe(false)
      })
    })
  })

  describe('GIVEN lastScrollTop=100 and currentScrollTop=98', () => {
    describe('WHEN threshold is 5 and diff (2) is below threshold', () => {
      it('THEN returns false (delta too small to be intentional scroll-up)', () => {
        expect(isScrollingUp(100, 98, 5)).toBe(false)
      })
    })
  })

  describe('GIVEN lastScrollTop=100 and currentScrollTop=95', () => {
    describe('WHEN threshold is 5 and diff equals threshold exactly', () => {
      it('THEN returns false (threshold is exclusive, must exceed)', () => {
        expect(isScrollingUp(100, 95, 5)).toBe(false)
      })
    })
  })

  describe('GIVEN lastScrollTop=100 and currentScrollTop=94', () => {
    describe('WHEN threshold is 5 and diff (6) exceeds threshold', () => {
      it('THEN returns true', () => {
        expect(isScrollingUp(100, 94, 5)).toBe(true)
      })
    })
  })

  describe('GIVEN lastScrollTop=0 and currentScrollTop=0', () => {
    describe('WHEN threshold is 5', () => {
      it('THEN returns false (no movement)', () => {
        expect(isScrollingUp(0, 0, 5)).toBe(false)
      })
    })
  })

  describe('GIVEN threshold is 0', () => {
    describe('WHEN scrolled up by any amount', () => {
      it('THEN returns true for even 1px up-scroll', () => {
        expect(isScrollingUp(10, 9, 0)).toBe(true)
      })
    })

    describe('WHEN scroll position is unchanged', () => {
      it('THEN returns false', () => {
        expect(isScrollingUp(10, 10, 0)).toBe(false)
      })
    })
  })
})
