interface StreamEndIndicatorProps {
  readonly visible: boolean
}

/**
 * Subtle badge indicating that the stdin stream has closed.
 * Renders a dot indicator and "Stream ended" text.
 * Only shown when `visible` is true.
 */
function StreamEndIndicator({ visible }: StreamEndIndicatorProps) {
  if (!visible) return null

  return (
    <span className="stream-ended">
      <span className="stream-ended__dot" />
      Stream ended
    </span>
  )
}

export { StreamEndIndicator }
export type { StreamEndIndicatorProps }
