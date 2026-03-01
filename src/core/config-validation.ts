/**
 * Pure validation functions for config fields, usable in both main and renderer processes.
 *
 * These are UI-only validation helpers for the SettingsPanel.
 * They do NOT replace ConfigValidator in config-manager.ts, which uses permissive > 0 checks
 * for backward compatibility with existing user config files.
 */

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/

/**
 * Returns true if the value is a valid 6-digit hex color (e.g. #FF00AA).
 */
function isValidHexColor(value: string): boolean {
  return HEX_COLOR_PATTERN.test(value)
}

/**
 * Returns true if the value is within the inclusive range [min, max].
 */
function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max
}

/**
 * Valid options for the viewTimestampFormat config field.
 * Mirrors VIEW_TIMESTAMP_FORMATS from types.ts but exported from here
 * for validation convenience.
 */
const VIEW_TIMESTAMP_FORMAT_OPTIONS = ['iso', 'local', 'relative'] as const

export { isValidHexColor, isInRange, VIEW_TIMESTAMP_FORMAT_OPTIONS, HEX_COLOR_PATTERN }
