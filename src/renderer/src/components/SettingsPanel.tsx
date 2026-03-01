import { useState, useEffect, useRef, useCallback } from 'react'
import type { AppConfig, ViewTimestampFormat } from '@core/types'
import { KNOWN_LOG_LEVELS, CONFIG_CONSTRAINTS, DEFAULT_APP_CONFIG } from '@core/types'
import { isValidHexColor, isInRange, VIEW_TIMESTAMP_FORMAT_OPTIONS } from '@core/config-validation'
import { applyConfigToCSS } from '../applyConfigToCSS'

// --- Constants ---

const DEBOUNCE_MS = 150

/** Non-level color fields in config.colors (displayed after level colors) */
const NON_LEVEL_COLOR_FIELDS = [
  { key: 'unrecognizedLevel', label: 'Unrecognized Level' },
  { key: 'swimlaneHeaders', label: 'Swimlane Headers' },
  { key: 'background', label: 'Background' },
  { key: 'rowHover', label: 'Row Hover' },
  { key: 'expandedRow', label: 'Expanded Row' }
] as const

// --- Props ---

interface SettingsPanelProps {
  readonly isOpen: boolean
  readonly config: AppConfig
  readonly onSave: (config: AppConfig) => void
  readonly onReset: () => void
  readonly onClose: () => void
}

// --- Validation ---

interface ValidationErrors {
  readonly [fieldPath: string]: string
}

function validateConfig(draft: AppConfig): ValidationErrors {
  const errors: Record<string, string> = {}

  // Validate level colors
  for (const level of KNOWN_LOG_LEVELS) {
    const value = draft.colors.levels[level]
    if (value !== undefined && !isValidHexColor(value)) {
      errors[`colors.levels.${level}`] = 'Invalid hex color'
    }
  }

  // Validate non-level colors
  for (const field of NON_LEVEL_COLOR_FIELDS) {
    const value = draft.colors[field.key]
    if (!isValidHexColor(value)) {
      errors[`colors.${field.key}`] = 'Invalid hex color'
    }
  }

  // Validate numeric UI fields
  if (!isInRange(draft.ui.rowHeight, CONFIG_CONSTRAINTS.rowHeight.min, CONFIG_CONSTRAINTS.rowHeight.max)) {
    errors['ui.rowHeight'] = `Must be ${CONFIG_CONSTRAINTS.rowHeight.min}–${CONFIG_CONSTRAINTS.rowHeight.max}`
  }
  if (!isInRange(draft.ui.fontSize, CONFIG_CONSTRAINTS.fontSize.min, CONFIG_CONSTRAINTS.fontSize.max)) {
    errors['ui.fontSize'] = `Must be ${CONFIG_CONSTRAINTS.fontSize.min}–${CONFIG_CONSTRAINTS.fontSize.max}`
  }

  // Validate performance fields
  if (
    !isInRange(
      draft.performance.flushIntervalMs,
      CONFIG_CONSTRAINTS.flushIntervalMs.min,
      CONFIG_CONSTRAINTS.flushIntervalMs.max
    )
  ) {
    errors['performance.flushIntervalMs'] =
      `Must be ${CONFIG_CONSTRAINTS.flushIntervalMs.min}–${CONFIG_CONSTRAINTS.flushIntervalMs.max}`
  }
  if (
    !isInRange(
      draft.performance.maxLogEntries,
      CONFIG_CONSTRAINTS.maxLogEntries.min,
      CONFIG_CONSTRAINTS.maxLogEntries.max
    )
  ) {
    errors['performance.maxLogEntries'] =
      `Must be ${CONFIG_CONSTRAINTS.maxLogEntries.min}–${CONFIG_CONSTRAINTS.maxLogEntries.max}`
  }

  return errors
}

// --- Component ---

/**
 * Slide-out settings panel for editing AppConfig at runtime.
 *
 * Maintains a local draft config state. Applies live CSS preview (debounced)
 * on every draft change. Only propagates to parent on explicit Save or Reset.
 */
function SettingsPanel({ isOpen, config, onSave, onReset, onClose }: SettingsPanelProps) {
  const [draftConfig, setDraftConfig] = useState<AppConfig>(config)
  const [errors, setErrors] = useState<ValidationErrors>({})
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Re-initialize draft from authoritative config when panel opens
  useEffect(() => {
    if (isOpen) {
      setDraftConfig(config)
      setErrors(validateConfig(config))
    }
  }, [isOpen, config])

  // Debounced live CSS preview
  const applyPreview = useCallback((draft: AppConfig) => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = setTimeout(() => {
      applyConfigToCSS(draft)
      debounceTimerRef.current = null
    }, DEBOUNCE_MS)
  }, [])

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  // --- Draft Mutators ---

  const updateLevelColor = useCallback(
    (level: string, value: string) => {
      setDraftConfig((prev) => {
        const next: AppConfig = {
          ...prev,
          colors: {
            ...prev.colors,
            levels: { ...prev.colors.levels, [level]: value }
          }
        }
        setErrors(validateConfig(next))
        applyPreview(next)
        return next
      })
    },
    [applyPreview]
  )

  const updateNonLevelColor = useCallback(
    (key: string, value: string) => {
      setDraftConfig((prev) => {
        const next: AppConfig = {
          ...prev,
          colors: { ...prev.colors, [key]: value }
        }
        setErrors(validateConfig(next))
        applyPreview(next)
        return next
      })
    },
    [applyPreview]
  )

  const updateUiNumber = useCallback(
    (key: 'rowHeight' | 'fontSize', value: string) => {
      const num = parseInt(value, 10)
      if (value !== '' && isNaN(num)) return
      setDraftConfig((prev) => {
        const next: AppConfig = {
          ...prev,
          ui: { ...prev.ui, [key]: value === '' ? 0 : num }
        }
        setErrors(validateConfig(next))
        applyPreview(next)
        return next
      })
    },
    [applyPreview]
  )

  const updateFontFamily = useCallback(
    (value: string) => {
      setDraftConfig((prev) => {
        const next: AppConfig = {
          ...prev,
          ui: { ...prev.ui, fontFamily: value }
        }
        applyPreview(next)
        return next
      })
    },
    [applyPreview]
  )

  const updateTimestampFormat = useCallback(
    (format: ViewTimestampFormat) => {
      setDraftConfig((prev) => {
        const next: AppConfig = {
          ...prev,
          ui: { ...prev.ui, viewTimestampFormat: format }
        }
        applyPreview(next)
        return next
      })
    },
    [applyPreview]
  )

  const updatePerformanceNumber = useCallback(
    (key: 'flushIntervalMs' | 'maxLogEntries', value: string) => {
      const num = parseInt(value, 10)
      if (value !== '' && isNaN(num)) return
      setDraftConfig((prev) => {
        const next: AppConfig = {
          ...prev,
          performance: { ...prev.performance, [key]: value === '' ? 0 : num }
        }
        setErrors(validateConfig(next))
        applyPreview(next)
        return next
      })
    },
    [applyPreview]
  )

  // --- Actions ---

  const hasErrors = Object.keys(errors).length > 0

  const handleSave = useCallback(() => {
    if (hasErrors) return
    // Flush any pending debounce immediately
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    applyConfigToCSS(draftConfig)
    onSave(draftConfig)
  }, [hasErrors, draftConfig, onSave])

  const handleReset = useCallback(() => {
    setDraftConfig(DEFAULT_APP_CONFIG)
    setErrors({})
    applyConfigToCSS(DEFAULT_APP_CONFIG)
    onReset()
  }, [onReset])

  if (!isOpen) return null

  return (
    <div className="settings-panel" data-testid="settings-panel">
      {/* Header */}
      <div className="settings-panel__header">
        <span className="settings-panel__title">Settings</span>
        <button
          className="settings-panel__close-btn"
          onClick={onClose}
          aria-label="Close settings"
          type="button"
        >
          ×
        </button>
      </div>

      {/* Colors Section */}
      <div className="settings-panel__section">
        <div className="settings-panel__section-title">Colors</div>

        {/* Level colors */}
        {KNOWN_LOG_LEVELS.map((level) => {
          const value = draftConfig.colors.levels[level] ?? ''
          const fieldPath = `colors.levels.${level}`
          return (
            <div className="settings-panel__field" key={level}>
              <label className="settings-panel__label">{level}</label>
              <div className="settings-panel__color-field">
                <div
                  className="settings-panel__color-swatch"
                  style={{ backgroundColor: isValidHexColor(value) ? value : 'transparent' }}
                />
                <input
                  className={`settings-panel__input settings-panel__color-input${errors[fieldPath] ? ' is-error' : ''}`}
                  type="text"
                  value={value}
                  onChange={(e) => updateLevelColor(level, e.target.value)}
                  placeholder="#000000"
                  data-field={fieldPath}
                />
              </div>
              {errors[fieldPath] && <span className="settings-panel__error">{errors[fieldPath]}</span>}
            </div>
          )
        })}

        {/* Non-level colors */}
        {NON_LEVEL_COLOR_FIELDS.map(({ key, label }) => {
          const value = draftConfig.colors[key]
          const fieldPath = `colors.${key}`
          return (
            <div className="settings-panel__field" key={key}>
              <label className="settings-panel__label">{label}</label>
              <div className="settings-panel__color-field">
                <div
                  className="settings-panel__color-swatch"
                  style={{ backgroundColor: isValidHexColor(value) ? value : 'transparent' }}
                />
                <input
                  className={`settings-panel__input settings-panel__color-input${errors[fieldPath] ? ' is-error' : ''}`}
                  type="text"
                  value={value}
                  onChange={(e) => updateNonLevelColor(key, e.target.value)}
                  placeholder="#000000"
                  data-field={fieldPath}
                />
              </div>
              {errors[fieldPath] && <span className="settings-panel__error">{errors[fieldPath]}</span>}
            </div>
          )
        })}
      </div>

      {/* UI Section */}
      <div className="settings-panel__section">
        <div className="settings-panel__section-title">UI</div>

        <div className="settings-panel__field">
          <label className="settings-panel__label">
            Row Height ({CONFIG_CONSTRAINTS.rowHeight.min}–{CONFIG_CONSTRAINTS.rowHeight.max}px)
          </label>
          <input
            className={`settings-panel__input settings-panel__input--number${errors['ui.rowHeight'] ? ' is-error' : ''}`}
            type="number"
            min={CONFIG_CONSTRAINTS.rowHeight.min}
            max={CONFIG_CONSTRAINTS.rowHeight.max}
            value={draftConfig.ui.rowHeight}
            onChange={(e) => updateUiNumber('rowHeight', e.target.value)}
            data-field="ui.rowHeight"
          />
          {errors['ui.rowHeight'] && <span className="settings-panel__error">{errors['ui.rowHeight']}</span>}
        </div>

        <div className="settings-panel__field">
          <label className="settings-panel__label">Font Family</label>
          <input
            className="settings-panel__input"
            type="text"
            value={draftConfig.ui.fontFamily}
            onChange={(e) => updateFontFamily(e.target.value)}
            placeholder="monospace"
            data-field="ui.fontFamily"
          />
        </div>

        <div className="settings-panel__field">
          <label className="settings-panel__label">
            Font Size ({CONFIG_CONSTRAINTS.fontSize.min}–{CONFIG_CONSTRAINTS.fontSize.max}px)
          </label>
          <input
            className={`settings-panel__input settings-panel__input--number${errors['ui.fontSize'] ? ' is-error' : ''}`}
            type="number"
            min={CONFIG_CONSTRAINTS.fontSize.min}
            max={CONFIG_CONSTRAINTS.fontSize.max}
            value={draftConfig.ui.fontSize}
            onChange={(e) => updateUiNumber('fontSize', e.target.value)}
            data-field="ui.fontSize"
          />
          {errors['ui.fontSize'] && <span className="settings-panel__error">{errors['ui.fontSize']}</span>}
        </div>

        <div className="settings-panel__field">
          <label className="settings-panel__label">Timestamp Format</label>
          <div className="settings-panel__segmented">
            {VIEW_TIMESTAMP_FORMAT_OPTIONS.map((format) => (
              <button
                key={format}
                className={`settings-panel__segmented-option${format === draftConfig.ui.viewTimestampFormat ? ' settings-panel__segmented-option--active' : ''}`}
                onClick={() => updateTimestampFormat(format)}
                type="button"
              >
                {format}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Performance Section */}
      <div className="settings-panel__section">
        <div className="settings-panel__section-title">Performance</div>

        <div className="settings-panel__field">
          <label className="settings-panel__label">
            Flush Interval ({CONFIG_CONSTRAINTS.flushIntervalMs.min}–{CONFIG_CONSTRAINTS.flushIntervalMs.max}ms)
          </label>
          <input
            className={`settings-panel__input settings-panel__input--number${errors['performance.flushIntervalMs'] ? ' is-error' : ''}`}
            type="number"
            min={CONFIG_CONSTRAINTS.flushIntervalMs.min}
            max={CONFIG_CONSTRAINTS.flushIntervalMs.max}
            value={draftConfig.performance.flushIntervalMs}
            onChange={(e) => updatePerformanceNumber('flushIntervalMs', e.target.value)}
            data-field="performance.flushIntervalMs"
          />
          <span className="settings-panel__hint">Takes effect on restart</span>
          {errors['performance.flushIntervalMs'] && (
            <span className="settings-panel__error">{errors['performance.flushIntervalMs']}</span>
          )}
        </div>

        <div className="settings-panel__field">
          <label className="settings-panel__label">
            Max Log Entries ({CONFIG_CONSTRAINTS.maxLogEntries.min.toLocaleString()}–
            {CONFIG_CONSTRAINTS.maxLogEntries.max.toLocaleString()})
          </label>
          <input
            className={`settings-panel__input settings-panel__input--number${errors['performance.maxLogEntries'] ? ' is-error' : ''}`}
            type="number"
            min={CONFIG_CONSTRAINTS.maxLogEntries.min}
            max={CONFIG_CONSTRAINTS.maxLogEntries.max}
            value={draftConfig.performance.maxLogEntries}
            onChange={(e) => updatePerformanceNumber('maxLogEntries', e.target.value)}
            data-field="performance.maxLogEntries"
          />
          {errors['performance.maxLogEntries'] && (
            <span className="settings-panel__error">{errors['performance.maxLogEntries']}</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="settings-panel__actions">
        <button
          className="settings-panel__btn settings-panel__btn--primary"
          onClick={handleSave}
          disabled={hasErrors}
          type="button"
        >
          Save
        </button>
        <button
          className="settings-panel__btn settings-panel__btn--secondary"
          onClick={handleReset}
          type="button"
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  )
}

export { SettingsPanel }
export type { SettingsPanelProps }
