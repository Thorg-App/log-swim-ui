/**
 * Applies config color/ui values to CSS custom properties on :root.
 * Stub for Phase 02 -- will be fully implemented when config system exists (Phase 04).
 *
 * Usage pattern:
 *   applyConfigToCSS(config)
 *
 * This function maps config.json values to CSS variable names and calls
 * document.documentElement.style.setProperty() for each.
 */

interface ConfigColors {
  readonly levels: Readonly<Record<string, string>>
  readonly unrecognizedLevel: string
  readonly swimlaneHeaders: string
  readonly background: string
  readonly rowHover: string
  readonly expandedRow: string
}

interface ConfigUI {
  readonly rowHeight: number
  readonly fontSize: number
}

interface PartialConfig {
  readonly colors?: Partial<ConfigColors>
  readonly ui?: Partial<ConfigUI>
}

const CSS_VAR_MAP_LEVELS: ReadonlyArray<readonly [string, string]> = [
  ['trace', '--color-level-trace'],
  ['debug', '--color-level-debug'],
  ['info', '--color-level-info'],
  ['notice', '--color-level-notice'],
  ['warn', '--color-level-warn'],
  ['warning', '--color-level-warning'],
  ['error', '--color-level-error'],
  ['fatal', '--color-level-fatal'],
  ['critical', '--color-level-critical'],
] as const

export function applyConfigToCSS(config: PartialConfig): void {
  const root = document.documentElement

  if (config.colors?.levels) {
    for (const [level, cssVar] of CSS_VAR_MAP_LEVELS) {
      const value = config.colors.levels[level]
      if (value) {
        root.style.setProperty(cssVar, value)
      }
    }
  }

  if (config.colors?.unrecognizedLevel) {
    root.style.setProperty('--color-level-unrecognized', config.colors.unrecognizedLevel)
  }
  if (config.colors?.swimlaneHeaders) {
    root.style.setProperty('--color-swimlane-header', config.colors.swimlaneHeaders)
  }
  if (config.colors?.background) {
    root.style.setProperty('--color-bg', config.colors.background)
  }
  if (config.colors?.rowHover) {
    root.style.setProperty('--color-row-hover', config.colors.rowHover)
  }
  if (config.colors?.expandedRow) {
    root.style.setProperty('--color-expanded-row', config.colors.expandedRow)
  }

  if (config.ui?.rowHeight) {
    root.style.setProperty('--row-height', config.ui.rowHeight + 'px')
  }
  if (config.ui?.fontSize) {
    root.style.setProperty('--text-sm', config.ui.fontSize + 'px')
  }
}
