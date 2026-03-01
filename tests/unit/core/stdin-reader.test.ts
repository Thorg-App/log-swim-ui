import { describe, it, expect, vi } from 'vitest'
import { Readable } from 'node:stream'
import { StdinReader } from '@core/stdin-reader'

/**
 * Helper to wait for the onEnd callback to be invoked.
 * Returns a promise that resolves when the stream finishes.
 */
function readAll(
  lines: string[]
): Promise<{ receivedLines: string[]; endCalled: boolean; errors: Error[] }> {
  return new Promise((resolve) => {
    const receivedLines: string[] = []
    const errors: Error[] = []
    let endCalled = false

    const input = Readable.from(lines.map((line) => line + '\n'))

    StdinReader.start(input, {
      onLine: (line) => {
        receivedLines.push(line)
      },
      onEnd: () => {
        endCalled = true
        resolve({ receivedLines, endCalled, errors })
      },
      onError: (error) => {
        errors.push(error)
      }
    })
  })
}

describe('StdinReader', () => {
  describe('GIVEN a readable stream with 3 lines', () => {
    describe('WHEN started', () => {
      it('THEN onLine is called 3 times', async () => {
        const result = await readAll(['line1', 'line2', 'line3'])
        expect(result.receivedLines).toHaveLength(3)
      })

      it('THEN onEnd is called after all lines are processed', async () => {
        const result = await readAll(['line1', 'line2', 'line3'])
        expect(result.endCalled).toBe(true)
      })

      it('THEN lines are received in order', async () => {
        const result = await readAll(['first', 'second', 'third'])
        expect(result.receivedLines).toEqual(['first', 'second', 'third'])
      })
    })
  })

  describe('GIVEN a readable stream with empty lines', () => {
    describe('WHEN started', () => {
      it('THEN empty lines still trigger onLine', async () => {
        const result = await readAll(['line1', '', 'line3'])
        expect(result.receivedLines).toHaveLength(3)
        expect(result.receivedLines[1]).toBe('')
      })
    })
  })

  describe('GIVEN a stream that errors', () => {
    describe('WHEN started', () => {
      it('THEN onError is called with the error', async () => {
        const onError = vi.fn()

        // WHY: Create a plain Readable (not PassThrough/Duplex) to avoid
        // double error emission from writable side. The _read is a no-op
        // because we manually push data and errors.
        const input = new Readable({ read(): void {} })

        await new Promise<void>((resolve) => {
          StdinReader.start(input, {
            onLine: vi.fn(),
            onEnd: vi.fn(),
            onError: (error) => {
              onError(error)
              resolve()
            }
          })

          process.nextTick(() => {
            input.destroy(new Error('stream failure'))
          })
        })

        expect(onError).toHaveBeenCalledTimes(1)
        expect(onError.mock.calls[0][0].message).toBe('stream failure')
      })
    })
  })

  describe('GIVEN a stream with no lines (immediate close)', () => {
    describe('WHEN started', () => {
      it('THEN onEnd is called and onLine is never called', async () => {
        const result = await readAll([])
        expect(result.receivedLines).toHaveLength(0)
        expect(result.endCalled).toBe(true)
      })
    })
  })
})
