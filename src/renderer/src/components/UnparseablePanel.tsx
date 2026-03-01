interface UnparseablePanelProps {
  readonly entries: readonly string[]
}

/**
 * Bottom panel displaying log entries that failed timestamp parsing.
 * Shows a count badge and a scrollable list of raw JSON strings.
 * Only rendered when entries.length > 0 (conditional in parent).
 */
function UnparseablePanel({ entries }: UnparseablePanelProps) {
  return (
    <div className="unparseable-panel">
      <div className="unparseable-panel__header">
        Unparseable timestamps
        <span className="unparseable-panel__badge">{entries.length}</span>
      </div>
      {entries.map((raw, index) => (
        <div key={index} className="unparseable-panel__row">
          {raw}
        </div>
      ))}
    </div>
  )
}

export { UnparseablePanel }
export type { UnparseablePanelProps }
