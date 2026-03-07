import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Readable } from 'node:stream'
import { IpcBridge, type IpcSender } from '../../../src/main/ipc-bridge'
import type { IpcLogLine } from '@core/types'
import { IPC_CHANNELS } from '@core/types'

/**
 * Helper to create a mock IpcSender that tracks all sent messages.
 */
function createMockSender(): IpcSender & {
  getLogLines(): IpcLogLine[]
  getErrors(): string[]
  wasStreamEndSent(): boolean
  clear(): void
} {
  const logLines: IpcLogLine[] = []
  const errors: string[] = []
  let streamEndSent = false

  return {
    send(channel: string, ...args: unknown[]): void {
      if (channel === IPC_CHANNELS.LOG_LINE) {
        logLines.push(args[0] as IpcLogLine)
      } else if (channel === IPC_CHANNELS.STREAM_ERROR) {
        errors.push(args[0] as string)
      } else if (channel === IPC_CHANNELS.STREAM_END) {
        streamEndSent = true
      }
    },
    getLogLines(): IpcLogLine[] {
      return logLines
    },
    getErrors(): string[] {
      return errors
    },
    wasStreamEndSent(): boolean {
      return streamEndSent
    },
    clear(): void {
      logLines.length = 0
      errors.length = 0
      streamEndSent = false
    }
  }
}

/**
 * Helper to create a valid JSON log line for testing.
 */
function createValidJsonLine(level = 'info', message = 'test message'): string {
  return JSON.stringify({
    level,
    message,
    timestamp: '2024-01-01T00:00:00.000Z'
  })
}

/**
 * Helper to process lines through IpcBridge and wait for completion.
 */
async function processLines(
  lines: string[],
  inputKeyLevel = 'level',
  inputKeyTimestamp = 'timestamp'
): Promise<{
  logLines: IpcLogLine[]
  errors: string[]
  streamEndSent: boolean
}> {
  const sender = createMockSender()
  const bridge = new IpcBridge({
    inputKeyLevel,
    inputKeyTimestamp,
    sender
  })

  const input = Readable.from(lines.map((line) => line + '\n'))

  await new Promise<void>((resolve) => {
    bridge.start(input)
    input.on('end', () => {
      // Give a small delay for final processing
      setTimeout(resolve, 10)
    })
  })

  return {
    logLines: sender.getLogLines(),
    errors: sender.getErrors(),
    streamEndSent: sender.wasStreamEndSent()
  }
}

describe('IpcBridge', () => {
  describe('GIVEN a tail -F separator line', () => {
    describe('WHEN processed as the first line', () => {
      it('THEN it is silently ignored (no STREAM_ERROR)', async () => {
        const separator = '==> /var/log/app.log <=='
        const result = await processLines([separator])

        expect(result.errors).toHaveLength(0)
        expect(result.logLines).toHaveLength(0)
      })
    })

    describe('WHEN processed as a non-first line', () => {
      it('THEN it is silently ignored (no LOG_LINE)', async () => {
        const validJson = createValidJsonLine()
        const separator = '==> test.log <=='
        const result = await processLines([validJson, separator])

        expect(result.logLines).toHaveLength(1)
        expect(result.logLines[0].level).toBe('info')
      })
    })

    describe('WHEN the separator has various filenames', () => {
      it('THEN all variations are ignored', async () => {
        const separators = [
          '==> file.log <==',
          '==> /path/to/file.log <==',
          '==> /var/log/nested/path/app.2024_01_01.log <==',
          '==> file with spaces.log <==',
          '==> file-with-dashes_and_underscores.log <=='
        ]
        const result = await processLines(separators)

        expect(result.errors).toHaveLength(0)
        expect(result.logLines).toHaveLength(0)
      })
    })
  })

  describe('GIVEN an empty line', () => {
    describe('WHEN processed as the first line', () => {
      it('THEN it is silently ignored (no STREAM_ERROR)', async () => {
        const result = await processLines([''])

        expect(result.errors).toHaveLength(0)
        expect(result.logLines).toHaveLength(0)
      })
    })

    describe('WHEN the line has only whitespace', () => {
      it('THEN it is silently ignored', async () => {
        const whitespaceLines = ['   ', '\t', '  \n  ', '    ']
        const result = await processLines(whitespaceLines)

        expect(result.errors).toHaveLength(0)
        expect(result.logLines).toHaveLength(0)
      })
    })

    describe('WHEN empty lines appear between valid JSON lines', () => {
      it('THEN only valid JSON lines are processed', async () => {
        const lines = [
          createValidJsonLine('info', 'first'),
          '',
          createValidJsonLine('warn', 'second'),
          '   ',
          createValidJsonLine('error', 'third')
        ]
        const result = await processLines(lines)

        expect(result.logLines).toHaveLength(3)
        expect(result.logLines[0].level).toBe('info')
        expect(result.logLines[1].level).toBe('warn')
        expect(result.logLines[2].level).toBe('error')
      })
    })
  })

  describe('GIVEN a valid JSON line after ignored lines', () => {
    describe('WHEN processed', () => {
      it('THEN the valid JSON is processed correctly', async () => {
        const lines = [
          '==> /var/log/test.log <==',
          '',
          createValidJsonLine('info', 'test message'),
          '   ',
          '==> another.log <=='
        ]
        const result = await processLines(lines)

        expect(result.logLines).toHaveLength(1)
        expect(result.logLines[0].level).toBe('info')
        expect(result.errors).toHaveLength(0)
      })
    })
  })

  describe('GIVEN a line that partially matches separator pattern', () => {
    describe('WHEN the line is "==> test" (no trailing <==)', () => {
      it('THEN it is NOT ignored (goes to JSON parser)', async () => {
        // This is not a valid tail separator, so it should be passed to JSON parser
        // As a non-first line with invalid JSON, it will be silently skipped
        const validJson = createValidJsonLine()
        const partialSeparator = '==> test'
        const result = await processLines([validJson, partialSeparator])

        // First valid line should be processed
        expect(result.logLines).toHaveLength(1)
        expect(result.errors).toHaveLength(0)
      })
    })

    describe('WHEN the line is "test <==" (no leading ==>)', () => {
      it('THEN it is NOT ignored (goes to JSON parser)', async () => {
        const validJson = createValidJsonLine()
        const partialSeparator = 'test <=='
        const result = await processLines([validJson, partialSeparator])

        expect(result.logLines).toHaveLength(1)
        expect(result.errors).toHaveLength(0)
      })
    })
  })

  describe('GIVEN multiple consecutive separator and empty lines', () => {
    describe('WHEN followed by valid JSON', () => {
      it('THEN all are ignored and valid JSON is processed', async () => {
        const lines = [
          '==> first.log <==',
          '',
          '==> second.log <==',
          '   ',
          '',
          createValidJsonLine('error', 'critical error')
        ]
        const result = await processLines(lines)

        expect(result.logLines).toHaveLength(1)
        expect(result.logLines[0].level).toBe('error')
        expect(result.errors).toHaveLength(0)
      })
    })
  })

  describe('GIVEN a valid JSON stream with mixed ignored lines', () => {
    describe('WHEN processed', () => {
      it('THEN only valid JSON lines produce LOG_LINE events', async () => {
        const lines = [
          createValidJsonLine('debug', 'msg1'),
          '==> rotated.log <==',
          createValidJsonLine('info', 'msg2'),
          '',
          createValidJsonLine('warn', 'msg3'),
          '   ',
          createValidJsonLine('error', 'msg4')
        ]
        const result = await processLines(lines)

        expect(result.logLines).toHaveLength(4)
        expect(result.logLines.map((l) => l.level)).toEqual([
          'debug',
          'info',
          'warn',
          'error'
        ])
      })
    })
  })

  describe('GIVEN a first line that is invalid JSON (not a separator)', () => {
    describe('WHEN processed', () => {
      it('THEN STREAM_ERROR is sent', async () => {
        const result = await processLines(['not valid json at all'])

        expect(result.errors).toHaveLength(1)
        expect(result.errors[0]).toContain('First line is not valid JSON')
        expect(result.logLines).toHaveLength(0)
      })
    })
  })
})
