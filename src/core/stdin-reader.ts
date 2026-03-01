import { Readable } from 'node:stream'
import { createInterface } from 'node:readline'

interface StdinReaderCallbacks {
  readonly onLine: (line: string) => void
  readonly onEnd: () => void
  readonly onError: (error: Error) => void
}

interface StdinReaderHandle {
  /** Close the readline interface, stopping further line processing. */
  readonly stop: () => void
}

/**
 * Line-by-line reader for a Readable stream.
 * Uses node:readline for line splitting.
 *
 * Accepts a Readable parameter instead of using process.stdin directly
 * for testability and dependency inversion.
 */
class StdinReader {
  /**
   * Start reading lines from the given readable stream.
   * Calls onLine for each line, onEnd when the stream closes,
   * and onError if the stream encounters an error.
   *
   * Returns a handle with a stop() method to close the readline interface
   * and halt further line processing.
   */
  static start(input: Readable, callbacks: StdinReaderCallbacks): StdinReaderHandle {
    const rl = createInterface({ input })

    rl.on('line', (line: string) => {
      callbacks.onLine(line)
    })

    rl.on('close', () => {
      callbacks.onEnd()
    })

    // WHY: readline's createInterface internally listens for 'error' on the input
    // stream and re-emits it on the Interface instance (see node:internal/readline/interface).
    // We must listen on the rl interface (not the raw input) to properly catch these
    // propagated errors and prevent them from becoming uncaught exceptions.
    rl.on('error', (error: Error) => {
      callbacks.onError(error)
    })

    return { stop: () => rl.close() }
  }
}

export { StdinReader }
export type { StdinReaderCallbacks, StdinReaderHandle }
