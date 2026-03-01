import { describe, it, expect } from 'vitest'
import { MasterList } from '@core/master-list'
import type { LogEntry } from '@core/types'

/**
 * Helper to create a minimal LogEntry with a given timestamp.
 */
function makeEntry(timestampMs: number, label: string = ''): LogEntry {
  return {
    rawJson: `{"label":"${label}"}`,
    fields: { label },
    timestamp: new Date(timestampMs),
    level: 'info',
    laneIndex: 0
  }
}

describe('MasterList', () => {
  describe('insert', () => {
    describe('GIVEN an empty list', () => {
      describe('WHEN an entry is inserted', () => {
        it('THEN the list has length 1', () => {
          const list = new MasterList(100)
          list.insert(makeEntry(1000))
          expect(list.length).toBe(1)
        })
      })
    })

    describe('GIVEN a list with entries', () => {
      describe('WHEN an entry with a middle timestamp is inserted', () => {
        it('THEN the list remains sorted', () => {
          const list = new MasterList(100)
          list.insert(makeEntry(1000, 'first'))
          list.insert(makeEntry(3000, 'third'))
          list.insert(makeEntry(2000, 'middle'))

          expect(list.get(0)?.fields['label']).toBe('first')
          expect(list.get(1)?.fields['label']).toBe('middle')
          expect(list.get(2)?.fields['label']).toBe('third')
        })
      })
    })

    describe('GIVEN a list with entries', () => {
      describe('WHEN an entry with the oldest timestamp is inserted', () => {
        it('THEN the entry is at index 0', () => {
          const list = new MasterList(100)
          list.insert(makeEntry(2000, 'second'))
          list.insert(makeEntry(3000, 'third'))
          list.insert(makeEntry(1000, 'oldest'))

          expect(list.get(0)?.fields['label']).toBe('oldest')
        })
      })
    })

    describe('GIVEN a list with entries', () => {
      describe('WHEN an entry with the newest timestamp is inserted', () => {
        it('THEN the entry is at the last index', () => {
          const list = new MasterList(100)
          list.insert(makeEntry(1000, 'first'))
          list.insert(makeEntry(2000, 'second'))
          list.insert(makeEntry(5000, 'newest'))

          expect(list.get(list.length - 1)?.fields['label']).toBe('newest')
        })
      })
    })

    describe('GIVEN a list with duplicate timestamps', () => {
      describe('WHEN a new entry with the same timestamp is inserted', () => {
        it('THEN preserves insertion order (stable sort)', () => {
          const list = new MasterList(100)
          list.insert(makeEntry(1000, 'first'))
          list.insert(makeEntry(1000, 'second'))
          list.insert(makeEntry(1000, 'third'))

          expect(list.get(0)?.fields['label']).toBe('first')
          expect(list.get(1)?.fields['label']).toBe('second')
          expect(list.get(2)?.fields['label']).toBe('third')
        })
      })
    })
  })

  describe('eviction', () => {
    describe('GIVEN a list at maxEntries', () => {
      describe('WHEN one more entry is inserted', () => {
        it('THEN the oldest is evicted and length stays at max', () => {
          const list = new MasterList(3)
          list.insert(makeEntry(1000, 'first'))
          list.insert(makeEntry(2000, 'second'))
          list.insert(makeEntry(3000, 'third'))
          list.insert(makeEntry(4000, 'fourth'))

          expect(list.length).toBe(3)
          expect(list.get(0)?.fields['label']).toBe('second')
          expect(list.get(2)?.fields['label']).toBe('fourth')
        })
      })
    })

    describe('GIVEN a list at maxEntries', () => {
      describe('WHEN a batch is inserted', () => {
        it('THEN eviction brings length back to max', () => {
          const list = new MasterList(3)
          list.insert(makeEntry(1000, 'first'))
          list.insert(makeEntry(2000, 'second'))
          list.insert(makeEntry(3000, 'third'))

          list.insertBatch([makeEntry(4000, 'fourth'), makeEntry(5000, 'fifth')])

          expect(list.length).toBe(3)
          expect(list.get(0)?.fields['label']).toBe('third')
          expect(list.get(1)?.fields['label']).toBe('fourth')
          expect(list.get(2)?.fields['label']).toBe('fifth')
        })
      })
    })
  })

  describe('get', () => {
    describe('GIVEN an empty list', () => {
      describe('WHEN get(0) is called', () => {
        it('THEN returns undefined', () => {
          const list = new MasterList(100)
          expect(list.get(0)).toBeUndefined()
        })
      })
    })

    describe('GIVEN a list with 3 entries', () => {
      describe('WHEN get(1) is called', () => {
        it('THEN returns the second entry', () => {
          const list = new MasterList(100)
          list.insert(makeEntry(1000, 'first'))
          list.insert(makeEntry(2000, 'second'))
          list.insert(makeEntry(3000, 'third'))

          expect(list.get(1)?.fields['label']).toBe('second')
        })
      })
    })
  })

  describe('setMaxEntries', () => {
    describe('GIVEN a list with 100 entries and maxEntries=100', () => {
      describe('WHEN setMaxEntries(50) is called', () => {
        it('THEN length is 50', () => {
          const list = new MasterList(100)
          for (let i = 0; i < 100; i++) {
            list.insert(makeEntry(i * 1000, `entry-${i}`))
          }
          expect(list.length).toBe(100)

          list.setMaxEntries(50)
          expect(list.length).toBe(50)
        })

        it('THEN the oldest 50 entries are removed', () => {
          const list = new MasterList(100)
          for (let i = 0; i < 100; i++) {
            list.insert(makeEntry(i * 1000, `entry-${i}`))
          }

          list.setMaxEntries(50)
          // entry-0 through entry-49 should be gone; entry-50 should be first
          expect(list.get(0)?.fields['label']).toBe('entry-50')
          expect(list.get(49)?.fields['label']).toBe('entry-99')
        })
      })
    })

    describe('GIVEN a list with 50 entries and maxEntries=100', () => {
      describe('WHEN setMaxEntries(200) is called', () => {
        it('THEN length remains 50 (no eviction needed)', () => {
          const list = new MasterList(100)
          for (let i = 0; i < 50; i++) {
            list.insert(makeEntry(i * 1000, `entry-${i}`))
          }

          list.setMaxEntries(200)
          expect(list.length).toBe(50)
        })
      })
    })

    describe('GIVEN a list with entries', () => {
      describe('WHEN setMaxEntries is called with a value equal to current length', () => {
        it('THEN no entries are evicted', () => {
          const list = new MasterList(100)
          for (let i = 0; i < 5; i++) {
            list.insert(makeEntry(i * 1000, `entry-${i}`))
          }

          list.setMaxEntries(5)
          expect(list.length).toBe(5)
          expect(list.get(0)?.fields['label']).toBe('entry-0')
          expect(list.get(4)?.fields['label']).toBe('entry-4')
        })
      })
    })

    describe('GIVEN setMaxEntries was called to lower the limit', () => {
      describe('WHEN new entries are inserted', () => {
        it('THEN eviction respects the new limit', () => {
          const list = new MasterList(100)
          for (let i = 0; i < 5; i++) {
            list.insert(makeEntry(i * 1000, `entry-${i}`))
          }

          list.setMaxEntries(3)
          expect(list.length).toBe(3)

          // Insert one more -- should still respect max of 3
          list.insert(makeEntry(5000, 'entry-5'))
          expect(list.length).toBe(3)
          expect(list.get(0)?.fields['label']).toBe('entry-3')
          expect(list.get(2)?.fields['label']).toBe('entry-5')
        })
      })
    })
  })

  describe('entries', () => {
    describe('GIVEN a list with entries', () => {
      it('THEN entries returns a readonly view of all entries', () => {
        const list = new MasterList(100)
        list.insert(makeEntry(1000))
        list.insert(makeEntry(2000))

        expect(list.entries).toHaveLength(2)
      })
    })
  })
})
