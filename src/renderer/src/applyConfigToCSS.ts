/**
 * Applies config color/ui values to CSS custom properties on :root.
 *
 * Maps config.json values to CSS variable names and calls
 * document.documentElement.style.setProperty() for each.
 */

import type { AppConfig } from '@core/types'
import { KNOWN_LOG_LEVELS } from '@core/types'

/**
 * Derived from KNOWN_LOG_LEVELS: maps each level name to its CSS custom property.
 * Convention: level "X" maps to "--color-level-X".
 */
const CSS_VAR_MAP_LEVELS: ReadonlyArray<readonly [string, string]> =
  KNOWN_LOG_LEVELS.map((level) => [level, `--color-level-${level}`] as const)

export function applyConfigToCSS(config: AppConfig): void {
  const root = document.documentElement

  // Level colors
  for (const [level, cssVar] of CSS_VAR_MAP_LEVELS) {
    const value = config.colors.levels[level]
    if (value) {
      root.style.setProperty(cssVar, value)
    }
  }

  // Other color properties
  root.style.setProperty('--color-level-unrecognized', config.colors.unrecognizedLevel)
  root.style.setProperty('--color-swimlane-header', config.colors.swimlaneHeaders)
  root.style.setProperty('--color-bg', config.colors.background)
  root.style.setProperty('--color-row-hover', config.colors.rowHover)
  root.style.setProperty('--color-expanded-row', config.colors.expandedRow)

  // UI properties
  root.style.setProperty('--row-height', config.ui.rowHeight + 'px')
  root.style.setProperty('--text-sm', config.ui.fontSize + 'px')
  root.style.setProperty('--font-mono', config.ui.fontFamily)
}
