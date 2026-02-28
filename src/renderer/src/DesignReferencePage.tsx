/**
 * DesignReferencePage — Visual showcase of all design tokens and component sketches.
 *
 * This is a development-only page for visual verification of the design system.
 * It will be replaced when real components are built in Phase 05+.
 *
 * - No state, no hooks, no interactivity
 * - Uses CSS classes from components.css only — no inline styles
 * - Sections: colors, spacing, typography, shadows, borders, component sketches
 */

const GREY_SCALE = [
  { token: '--color-grey-50', label: 'Grey 50' },
  { token: '--color-grey-100', label: 'Grey 100' },
  { token: '--color-grey-200', label: 'Grey 200' },
  { token: '--color-grey-300', label: 'Grey 300' },
  { token: '--color-grey-400', label: 'Grey 400' },
  { token: '--color-grey-500', label: 'Grey 500' },
  { token: '--color-grey-600', label: 'Grey 600' },
  { token: '--color-grey-700', label: 'Grey 700' },
  { token: '--color-grey-800', label: 'Grey 800' },
  { token: '--color-grey-900', label: 'Grey 900' },
  { token: '--color-grey-950', label: 'Grey 950' },
] as const

const LOG_LEVELS = [
  { token: '--color-level-trace', label: 'trace' },
  { token: '--color-level-debug', label: 'debug' },
  { token: '--color-level-info', label: 'info' },
  { token: '--color-level-notice', label: 'notice' },
  { token: '--color-level-warn', label: 'warn' },
  { token: '--color-level-warning', label: 'warning' },
  { token: '--color-level-error', label: 'error' },
  { token: '--color-level-fatal', label: 'fatal' },
  { token: '--color-level-critical', label: 'critical' },
  { token: '--color-level-unrecognized', label: 'unrecognized' },
] as const

const SEMANTIC_COLORS = [
  { token: '--color-bg', label: 'Background' },
  { token: '--color-surface', label: 'Surface' },
  { token: '--color-surface-hover', label: 'Surface Hover' },
  { token: '--color-surface-active', label: 'Surface Active' },
  { token: '--color-text-primary', label: 'Text Primary' },
  { token: '--color-text-secondary', label: 'Text Secondary' },
  { token: '--color-text-disabled', label: 'Text Disabled' },
  { token: '--color-border', label: 'Border' },
  { token: '--color-border-subtle', label: 'Border Subtle' },
  { token: '--color-border-focus', label: 'Border Focus' },
  { token: '--color-primary', label: 'Primary' },
  { token: '--color-primary-hover', label: 'Primary Hover' },
  { token: '--color-primary-active', label: 'Primary Active' },
  { token: '--color-error', label: 'Error' },
  { token: '--color-warning', label: 'Warning' },
  { token: '--color-success', label: 'Success' },
] as const

const SPACING_SCALE = [
  { token: '--space-1', label: '1 (4px)' },
  { token: '--space-2', label: '2 (8px)' },
  { token: '--space-3', label: '3 (12px)' },
  { token: '--space-4', label: '4 (16px)' },
  { token: '--space-6', label: '6 (24px)' },
  { token: '--space-8', label: '8 (32px)' },
  { token: '--space-12', label: '12 (48px)' },
  { token: '--space-16', label: '16 (64px)' },
  { token: '--space-24', label: '24 (96px)' },
  { token: '--space-32', label: '32 (128px)' },
] as const

const SHADOW_LEVELS = [
  { token: '--shadow-1', label: 'Shadow 1' },
  { token: '--shadow-2', label: 'Shadow 2' },
  { token: '--shadow-3', label: 'Shadow 3' },
  { token: '--shadow-4', label: 'Shadow 4' },
  { token: '--shadow-5', label: 'Shadow 5' },
] as const

function ColorSwatch({ token, label }: { readonly token: string; readonly label: string }) {
  return (
    <div className="ref-swatch">
      <div
        className="ref-swatch__color"
        style={{ backgroundColor: `var(${token})` }}
      />
      <span className="text-xs text-mono">{label}</span>
      <span className="text-xs text-muted">{token}</span>
    </div>
  )
}

function SpacingBar({ token, label }: { readonly token: string; readonly label: string }) {
  return (
    <div className="ref-spacing-row">
      <span className="text-xs text-mono ref-spacing-label">{label}</span>
      <div
        className="ref-spacing-bar"
        style={{ width: `var(${token})`, height: `var(${token})` }}
      />
    </div>
  )
}

function ShadowBox({ token, label }: { readonly token: string; readonly label: string }) {
  return (
    <div
      className="ref-shadow-box"
      style={{ boxShadow: `var(${token})` }}
    >
      <span className="text-xs">{label}</span>
    </div>
  )
}

function DesignReferencePage() {
  return (
    <div className="ref-page">
      <h1 className="ref-page__title">Design Reference — log-swim-ui</h1>
      <p className="text-muted ref-page__subtitle">
        Visual verification of all design tokens and component sketches.
        This page is development-only.
      </p>

      {/* ============================================================
       * Color Swatches
       * ============================================================ */}
      <section className="ref-section">
        <h2 className="ref-section__heading">Grey Scale</h2>
        <div className="ref-swatch-grid">
          {GREY_SCALE.map((c) => (
            <ColorSwatch key={c.token} token={c.token} label={c.label} />
          ))}
        </div>
      </section>

      <section className="ref-section">
        <h2 className="ref-section__heading">Log Level Colors</h2>
        <div className="ref-swatch-grid">
          {LOG_LEVELS.map((c) => (
            <ColorSwatch key={c.token} token={c.token} label={c.label} />
          ))}
        </div>
      </section>

      <section className="ref-section">
        <h2 className="ref-section__heading">Semantic Colors</h2>
        <div className="ref-swatch-grid">
          {SEMANTIC_COLORS.map((c) => (
            <ColorSwatch key={c.token} token={c.token} label={c.label} />
          ))}
        </div>
      </section>

      {/* ============================================================
       * Spacing Scale
       * ============================================================ */}
      <section className="ref-section">
        <h2 className="ref-section__heading">Spacing Scale</h2>
        <div className="ref-spacing-container">
          {SPACING_SCALE.map((s) => (
            <SpacingBar key={s.token} token={s.token} label={s.label} />
          ))}
        </div>
      </section>

      {/* ============================================================
       * Typography Samples
       * ============================================================ */}
      <section className="ref-section">
        <h2 className="ref-section__heading">Typography — Sans-serif</h2>
        <div className="ref-type-samples text-sans">
          <p className="text-xs">--text-xs (11px): The quick brown fox jumps over the lazy dog</p>
          <p className="text-sm">--text-sm (12px): The quick brown fox jumps over the lazy dog</p>
          <p className="text-base">--text-base (14px): The quick brown fox jumps over the lazy dog</p>
          <p className="text-lg">--text-lg (16px): The quick brown fox jumps over the lazy dog</p>
          <p className="ref-type-xl">--text-xl (20px): The quick brown fox jumps over the lazy dog</p>
          <p className="ref-type-2xl">--text-2xl (24px): The quick brown fox jumps</p>
        </div>
      </section>

      <section className="ref-section">
        <h2 className="ref-section__heading">Typography — Monospace</h2>
        <div className="ref-type-samples text-mono">
          <p className="text-xs">--text-xs (11px): {"{"}"level":"info","msg":"request completed","duration":42{"}"}</p>
          <p className="text-sm">--text-sm (12px): {"{"}"level":"info","msg":"request completed","duration":42{"}"}</p>
          <p className="text-base">--text-base (14px): {"{"}"level":"info","msg":"request completed"{"}"}</p>
          <p className="text-lg">--text-lg (16px): {"{"}"level":"info","msg":"request completed"{"}"}</p>
        </div>
      </section>

      <section className="ref-section">
        <h2 className="ref-section__heading">Typography — Weights</h2>
        <div className="ref-type-samples text-sans text-lg">
          <p className="ref-weight-normal">Normal (400): The quick brown fox</p>
          <p className="ref-weight-medium">Medium (500): The quick brown fox</p>
          <p className="ref-weight-semibold">Semibold (600): The quick brown fox</p>
          <p className="ref-weight-bold">Bold (700): The quick brown fox</p>
        </div>
      </section>

      {/* ============================================================
       * Shadows
       * ============================================================ */}
      <section className="ref-section">
        <h2 className="ref-section__heading">Shadows (5 Levels)</h2>
        <div className="ref-shadow-grid">
          {SHADOW_LEVELS.map((s) => (
            <ShadowBox key={s.token} token={s.token} label={s.label} />
          ))}
        </div>
      </section>

      {/* ============================================================
       * Borders
       * ============================================================ */}
      <section className="ref-section">
        <h2 className="ref-section__heading">Borders — Width</h2>
        <div className="ref-border-samples">
          <div className="ref-border-box ref-border--thin">
            <span className="text-xs">thin (1px)</span>
          </div>
          <div className="ref-border-box ref-border--default">
            <span className="text-xs">default (2px)</span>
          </div>
          <div className="ref-border-box ref-border--thick">
            <span className="text-xs">thick (3px)</span>
          </div>
        </div>
      </section>

      <section className="ref-section">
        <h2 className="ref-section__heading">Borders — Radius</h2>
        <div className="ref-border-samples">
          <div className="ref-border-box ref-radius--sm">
            <span className="text-xs">sm (4px)</span>
          </div>
          <div className="ref-border-box ref-radius--md">
            <span className="text-xs">md (6px)</span>
          </div>
          <div className="ref-border-box ref-radius--lg">
            <span className="text-xs">lg (8px)</span>
          </div>
          <div className="ref-border-box ref-radius--full">
            <span className="text-xs">full (pill)</span>
          </div>
        </div>
      </section>

      {/* ============================================================
       * Component Sketches — Log Rows
       * ============================================================ */}
      <section className="ref-section">
        <h2 className="ref-section__heading">Log Rows — By Level</h2>
        <div className="ref-component-container">
          {LOG_LEVELS.map((level) => (
            <div key={level.label} className={`log-row log-row--${level.label}`}>
              <span className="log-row__timestamp">2024-01-15T10:30:00.000Z</span>
              <span className="log-row__message">
                [{level.label}] Sample log message for {level.label} level
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="ref-section">
        <h2 className="ref-section__heading">Log Rows — States</h2>
        <div className="ref-component-container">
          <p className="text-xs text-muted ref-state-label">Default</p>
          <div className="log-row log-row--info">
            <span className="log-row__timestamp">2024-01-15T10:30:00.000Z</span>
            <span className="log-row__message">[info] Default state log row</span>
          </div>
          <p className="text-xs text-muted ref-state-label">Hover (preview)</p>
          <div className="log-row log-row--info preview-hover">
            <span className="log-row__timestamp">2024-01-15T10:30:00.000Z</span>
            <span className="log-row__message">[info] Hover state log row</span>
          </div>
          <p className="text-xs text-muted ref-state-label">Expanded</p>
          <div className="log-row log-row--info log-row--expanded">
            <span className="log-row__expanded-content">
{`{
  "level": "info",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "msg": "Expanded row showing full JSON",
  "caller": "server.go:142",
  "duration": 42
}`}
            </span>
          </div>
          <p className="text-xs text-muted ref-state-label">Disabled</p>
          <div className="log-row log-row--info is-disabled">
            <span className="log-row__timestamp">2024-01-15T10:30:00.000Z</span>
            <span className="log-row__message">[info] Disabled state log row</span>
          </div>
        </div>
      </section>

      {/* ============================================================
       * Component Sketches — Lane Headers
       * ============================================================ */}
      <section className="ref-section">
        <h2 className="ref-section__heading">Lane Headers</h2>
        <div className="ref-component-container">
          <p className="text-xs text-muted ref-state-label">Normal</p>
          <div className="lane-header">
            <span className="lane-header__drag-handle">&#x2630;</span>
            <span className="lane-header__pattern">^.*level.*error.*$</span>
          </div>
          <p className="text-xs text-muted ref-state-label">Error</p>
          <div className="lane-header lane-header--error">
            <span className="lane-header__drag-handle">&#x2630;</span>
            <span className="lane-header__pattern">^invalid-regex(($</span>
          </div>
          <p className="text-xs text-muted ref-state-label">Unmatched</p>
          <div className="lane-header lane-header--unmatched">
            <span className="lane-header__drag-handle">&#x2630;</span>
            <span className="lane-header__pattern">unmatched</span>
          </div>
        </div>
      </section>

      {/* ============================================================
       * Component Sketches — Filter Bar
       * ============================================================ */}
      <section className="ref-section">
        <h2 className="ref-section__heading">Filter Bar</h2>
        <div className="ref-component-container">
          <div className="filter-bar">
            <span className="filter-chip">
              <span>error</span>
              <span className="filter-chip__remove">&times;</span>
            </span>
            <span className="filter-chip">
              <span>auth</span>
              <span className="filter-chip__remove">&times;</span>
            </span>
            <span className="filter-chip preview-hover">
              <span>payment (hover)</span>
              <span className="filter-chip__remove">&times;</span>
            </span>
            <span className="filter-chip filter-chip--disabled">
              <span>disabled-filter</span>
              <span className="filter-chip__remove">&times;</span>
            </span>
            <button className="filter-add-btn" type="button">+ Add filter</button>
          </div>
        </div>
      </section>

      {/* ============================================================
       * Component Sketches — Mode Toggle
       * ============================================================ */}
      <section className="ref-section">
        <h2 className="ref-section__heading">Mode Toggle</h2>
        <div className="ref-component-row">
          <div>
            <p className="text-xs text-muted ref-state-label">Live Active</p>
            <div className="mode-toggle">
              <button className="mode-toggle__option mode-toggle__option--active" type="button">Live</button>
              <button className="mode-toggle__option" type="button">Scroll</button>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted ref-state-label">Scroll Active</p>
            <div className="mode-toggle">
              <button className="mode-toggle__option" type="button">Live</button>
              <button className="mode-toggle__option mode-toggle__option--active" type="button">Scroll</button>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
       * Component Sketches — Stream-Ended Indicator
       * ============================================================ */}
      <section className="ref-section">
        <h2 className="ref-section__heading">Stream-Ended Indicator</h2>
        <div className="ref-component-row">
          <div className="stream-ended">
            <span className="stream-ended__dot" />
            <span>Stream ended</span>
          </div>
        </div>
      </section>

      {/* ============================================================
       * Component Sketches — Unparseable Panel
       * ============================================================ */}
      <section className="ref-section">
        <h2 className="ref-section__heading">Unparseable Panel</h2>
        <div className="ref-component-container">
          <div className="unparseable-panel" style={{ position: 'static' }}>
            <div className="unparseable-panel__header">
              <span className="unparseable-panel__badge">3</span>
              <span>Unparseable Lines</span>
            </div>
            <div className="unparseable-panel__row">
              not a json line -- raw text that could not be parsed
            </div>
            <div className="unparseable-panel__row">
              another unparseable line &gt;&gt; missing braces
            </div>
            <div className="unparseable-panel__row">
              WARNING: startup check failed (plain text, no JSON structure)
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
       * Component Sketches — Settings Panel (Preview, not fixed)
       * ============================================================ */}
      <section className="ref-section">
        <h2 className="ref-section__heading">Settings Panel (Preview)</h2>
        <div className="ref-component-container">
          <div className="ref-settings-preview">
            <div className="settings-panel__section">
              <h3 className="settings-panel__section-title">Colors</h3>
              <div className="settings-panel__field">
                <label className="settings-panel__label">Background</label>
                <span className="text-mono text-sm">#0F172A</span>
              </div>
              <div className="settings-panel__field">
                <label className="settings-panel__label">Row Hover</label>
                <span className="text-mono text-sm">#1E293B</span>
              </div>
            </div>
            <div className="settings-panel__section">
              <h3 className="settings-panel__section-title">UI</h3>
              <div className="settings-panel__field">
                <label className="settings-panel__label">Row Height</label>
                <span className="text-mono text-sm">32px</span>
              </div>
              <div className="settings-panel__field">
                <label className="settings-panel__label">Font Size</label>
                <span className="text-mono text-sm">12px</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
       * Component Sketches — Ad-hoc Lane Input
       * ============================================================ */}
      <section className="ref-section">
        <h2 className="ref-section__heading">Ad-hoc Lane Input</h2>
        <div className="ref-component-container">
          <p className="text-xs text-muted ref-state-label">Default</p>
          <div className="lane-add-input">
            <input
              className="lane-add-input__field"
              type="text"
              placeholder="Enter regex pattern..."
              readOnly
            />
          </div>
          <p className="text-xs text-muted ref-state-label">Focused (preview)</p>
          <div className="lane-add-input">
            <input
              className="lane-add-input__field preview-focus"
              type="text"
              placeholder="Enter regex pattern..."
              readOnly
            />
          </div>
          <p className="text-xs text-muted ref-state-label">With Error</p>
          <div className="lane-add-input">
            <input
              className="lane-add-input__field is-error"
              type="text"
              defaultValue="^invalid-regex(($"
              readOnly
            />
          </div>
        </div>
      </section>
    </div>
  )
}

export default DesignReferencePage
