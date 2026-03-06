import type { LaneDefinition, LogEntry } from './types'

/**
 * Stateless utility for classifying log entries into swimlanes.
 * Uses first-match-wins semantics against an ordered list of lane definitions.
 */
class LaneClassifier {
  /**
   * Classify a raw JSON string against lanes. First match wins.
   * Returns the lane index, or `lanes.length` for "unmatched".
   * Lanes with compilation errors (regex is null) are skipped.
   */
  static classify(rawJson: string, lanes: readonly LaneDefinition[]): number {
    for (let i = 0; i < lanes.length; i++) {
      const lane = lanes[i]
      const primaryMatches = lane.regex !== null && lane.regex.test(rawJson)
      const extraMatches = lane.extraPatterns.some(
        (ep) => ep.regex !== null && ep.regex.test(rawJson)
      )
      if (primaryMatches || extraMatches) {
        return i
      }
    }
    return lanes.length
  }

  /**
   * Re-classify all entries against new lane definitions.
   * Mutates each entry's laneIndex in place.
   */
  static reclassifyAll(entries: readonly LogEntry[], lanes: readonly LaneDefinition[]): void {
    for (const entry of entries) {
      entry.laneIndex = LaneClassifier.classify(entry.rawJson, lanes)
    }
  }
}

export { LaneClassifier }
