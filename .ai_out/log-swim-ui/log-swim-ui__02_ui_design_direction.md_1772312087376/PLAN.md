# Implementation Plan: Phase 02 - UI Design Direction

## Problem Understanding

Establish the complete CSS design system for log-swim-ui. This is a **design-only** phase -- no React components, no business logic. The output is CSS files containing design tokens and structural component styles, a design reference page that visually showcases every token, and the pattern for runtime CSS variable injection from config.

**Key constraint**: This is CSS architecture, not a component library. Keep it simple. Two CSS files, one reference page, update App.tsx to use CSS instead of inline styles.

### What "done" looks like
- `src/renderer/theme/tokens.css` exists with complete CSS custom property definitions (colors, spacing, typography, shadows, borders)
- `src/renderer/theme/components.css` exists with structural styles referencing only CSS variables
- A design reference page (`src/renderer/src/DesignReferencePage.tsx`) renders all tokens and component state previews
- `App.tsx` uses CSS classes instead of inline styles
- CSS variable injection pattern is documented and stubbed
- `npm run dev` shows the design reference page with dark theme cohesion
- `npm run typecheck` passes

---

## High-Level Architecture

```
src/renderer/
├── theme/
│   ├── tokens.css           # CSS custom properties (all visual values)
│   └── components.css       # Structural styles referencing only CSS variables
├── src/
│   ├── App.tsx              # Updated to use CSS classes, renders DesignReferencePage
│   ├── DesignReferencePage.tsx  # Visual showcase of all tokens and component sketches
│   └── main.tsx             # Unchanged (entry point)
└── index.html               # Unchanged
```

### Data flow
None -- this is pure CSS and a static reference page. The only runtime flow is React rendering static markup styled by CSS custom properties.

### CSS Import Chain
```
main.tsx
  └── imports App.tsx
        └── App.tsx imports '../../theme/tokens.css'
        └── App.tsx imports '../../theme/components.css'
        └── App.tsx renders <DesignReferencePage />
```

**Note on CSS import location**: CSS is imported in `App.tsx` (not `main.tsx`) because the theme files are renderer-specific concerns. When the design reference page is replaced by the real app layout in Phase 05, the CSS imports remain in `App.tsx`.

---

## Implementation Phases

### Phase A: Create `tokens.css` -- CSS Custom Properties

**Goal**: Define every visual value as a CSS custom property on `:root`. This is the single source of truth for the design system.

**File**: `src/renderer/theme/tokens.css`

**Steps**:

1. Create the directory `src/renderer/theme/`
2. Create `tokens.css` with the following sections:

#### A.1: Color Palette -- Greys (HSL-based, 10 shades)

The app background is `#0F172A` which is `hsl(222, 47%, 11%)`. Build a grey scale in the same hue family (222) with varying lightness and subtle saturation (desaturated blues, not pure greys -- this gives a cohesive "slate" feel).

```css
:root {
  /* --- Grey Scale (Slate family, hue ~222) --- */
  --color-grey-50:  hsl(210, 40%, 98%);   /* Near-white, for maximum contrast text */
  --color-grey-100: hsl(210, 40%, 96%);
  --color-grey-200: hsl(214, 32%, 91%);
  --color-grey-300: hsl(213, 27%, 84%);
  --color-grey-400: hsl(215, 20%, 65%);
  --color-grey-500: hsl(215, 16%, 47%);
  --color-grey-600: hsl(215, 19%, 35%);
  --color-grey-700: hsl(215, 25%, 27%);
  --color-grey-800: hsl(217, 33%, 17%);
  --color-grey-900: hsl(222, 47%, 11%);   /* App background: #0F172A */
  --color-grey-950: hsl(229, 84%, 5%);    /* Deepest dark */
}
```

These align with the Tailwind Slate palette that the hex colors in the spec already follow (`#0F172A` = slate-900, `#1E293B` = slate-800, `#334155` = slate-700, `#E2E8F0` = slate-200).

**Design note**: The task calls for "boost saturation at lightness extremes." The scale above achieves this -- the darkest (950) and lightest (50-100) shades have higher saturation than the mid-range values.

#### A.2: Semantic Colors -- App Surface & UI

Map the config.json color values to semantic CSS variables:

```css
:root {
  /* --- Semantic: Surfaces --- */
  --color-bg:              var(--color-grey-900);  /* #0F172A */
  --color-surface:         hsl(217, 33%, 17%);     /* Elevated panels */
  --color-surface-hover:   hsl(215, 25%, 22%);     /* #1E293B approx */
  --color-surface-active:  hsl(215, 25%, 27%);     /* #334155 approx */

  /* --- Semantic: Text --- */
  --color-text-primary:    var(--color-grey-200);   /* #E2E8F0 */
  --color-text-secondary:  var(--color-grey-400);   /* Muted/secondary text */
  --color-text-disabled:   var(--color-grey-600);   /* Disabled state */

  /* --- Semantic: Borders --- */
  --color-border:          var(--color-grey-700);   /* Default border */
  --color-border-subtle:   var(--color-grey-800);   /* Subtle separator */
  --color-border-focus:    hsl(217, 91%, 60%);      /* Focus ring (blue) */

  /* --- Semantic: Interactive --- */
  --color-primary:         hsl(217, 91%, 60%);      /* Primary action blue */
  --color-primary-hover:   hsl(217, 91%, 55%);
  --color-primary-active:  hsl(217, 91%, 50%);

  /* --- Semantic: States --- */
  --color-error:           #EF4444;
  --color-warning:         #F59E0B;
  --color-success:         #22C55E;
}
```

#### A.3: Log Level Colors

Directly from the config.json spec:

```css
:root {
  /* --- Log Level Colors --- */
  --color-level-trace:     #6B7280;
  --color-level-debug:     #94A3B8;
  --color-level-info:      #3B82F6;
  --color-level-notice:    #06B6D4;
  --color-level-warn:      #F59E0B;
  --color-level-warning:   #F59E0B;
  --color-level-error:     #EF4444;
  --color-level-fatal:     #991B1B;
  --color-level-critical:  #991B1B;
  --color-level-unrecognized: #F97316;
}
```

#### A.4: Component-Specific Colors

```css
:root {
  /* --- Component: Swimlane --- */
  --color-swimlane-header: #1E293B;
  --color-row-hover:       #1E293B;
  --color-expanded-row:    #334155;

  /* --- Component: Mode Toggle --- */
  --color-toggle-active:   var(--color-primary);
  --color-toggle-inactive: var(--color-grey-700);

  /* --- Component: Settings Panel --- */
  --color-backdrop:        hsla(222, 47%, 11%, 0.75);
  --color-panel-bg:        var(--color-surface);

  /* --- Component: Unparseable Panel --- */
  --color-unparseable-bg:  hsl(0, 30%, 15%);
  --color-unparseable-border: hsl(0, 50%, 30%);

  /* --- Component: Error State (Lane) --- */
  --color-lane-error-bg:   hsl(15, 30%, 15%);
  --color-lane-error-border: hsl(15, 60%, 40%);
}
```

#### A.5: Spacing Scale

```css
:root {
  /* --- Spacing Scale --- */
  --space-1:   4px;
  --space-2:   8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-6:  24px;
  --space-8:  32px;
  --space-12: 48px;
  --space-16: 64px;
  --space-24: 96px;
  --space-32: 128px;
}
```

Naming convention: `--space-N` where N is the value / 4. This keeps names short and memorable (e.g., `--space-4` = 16px).

#### A.6: Typography

```css
:root {
  /* --- Font Families --- */
  --font-mono: 'JetBrains Mono', 'Fira Code', 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;

  /* --- Font Sizes (hand-picked, not ratio-based) --- */
  --text-xs:   11px;
  --text-sm:   12px;   /* Default log text size (matches config default) */
  --text-base: 14px;   /* UI chrome default */
  --text-lg:   16px;
  --text-xl:   20px;
  --text-2xl:  24px;

  /* --- Font Weights --- */
  --weight-normal:   400;
  --weight-medium:   500;
  --weight-semibold: 600;
  --weight-bold:     700;

  /* --- Line Heights --- */
  --leading-tight:  1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.75;

  /* --- Letter Spacing --- */
  --tracking-tight:  -0.01em;
  --tracking-normal:  0;
  --tracking-wide:    0.02em;
}
```

#### A.7: Shadows (5 Levels)

Two-part shadows (ambient + direct light from above) on a dark background. Dark-UI shadows need to be more pronounced than light-UI shadows.

```css
:root {
  /* --- Shadows (5 levels, two-part: ambient + key light from above) --- */
  --shadow-1: 0 1px 2px hsla(0, 0%, 0%, 0.3),
              0 1px 3px hsla(0, 0%, 0%, 0.15);
  --shadow-2: 0 2px 4px hsla(0, 0%, 0%, 0.3),
              0 3px 8px hsla(0, 0%, 0%, 0.2);
  --shadow-3: 0 4px 8px hsla(0, 0%, 0%, 0.35),
              0 6px 16px hsla(0, 0%, 0%, 0.25);
  --shadow-4: 0 8px 16px hsla(0, 0%, 0%, 0.4),
              0 12px 32px hsla(0, 0%, 0%, 0.3);
  --shadow-5: 0 16px 32px hsla(0, 0%, 0%, 0.5),
              0 24px 64px hsla(0, 0%, 0%, 0.4);
}
```

#### A.8: Borders

```css
:root {
  /* --- Borders --- */
  --border-width:       2px;
  --border-width-thin:  1px;
  --border-width-thick: 3px;   /* Log row level indicator */
  --border-radius-sm:   4px;
  --border-radius-md:   6px;
  --border-radius-lg:   8px;
  --border-radius-full: 9999px; /* Pill shape for mode toggle */
}
```

#### A.9: Layout & Component Dimensions

```css
:root {
  /* --- Layout --- */
  --row-height:           32px;   /* Matches config default */
  --lane-header-height:   40px;
  --filter-bar-height:    48px;
  --settings-panel-width: 360px;
  --unparseable-panel-max-height: 200px;

  /* --- Transitions --- */
  --transition-fast:   150ms ease;
  --transition-normal: 250ms ease;
  --transition-slow:   350ms ease;
}
```

**Verification**: File parses correctly (no CSS syntax errors). All values used in `components.css` reference these tokens.

---

### Phase B: Create `components.css` -- Structural Styles

**Goal**: Define CSS classes for all UI components using only CSS variable references. No hardcoded colors, sizes, or spacing.

**File**: `src/renderer/theme/components.css`

**Steps**:

1. Create `components.css` with the following component sections.

**Critical rule**: Every visual value (color, size, spacing, font, shadow, border) MUST reference a `var(--token)`. Zero hardcoded values.

#### B.1: Base / Reset

```css
/* --- Base Reset --- */
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body, #root {
  height: 100%;
  overflow: hidden; /* App manages its own scrolling */
}

body {
  background-color: var(--color-bg);
  color: var(--color-text-primary);
  font-family: var(--font-sans);
  font-size: var(--text-base);
  line-height: var(--leading-normal);
  -webkit-font-smoothing: antialiased;
}
```

#### B.2: App Layout

```css
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.app-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-2) var(--space-4);
  border-bottom: var(--border-width) solid var(--color-border-subtle);
  flex-shrink: 0;
}

.app-main {
  flex: 1;
  overflow: hidden;
  position: relative;
}
```

#### B.3: Log Row

```css
.log-row {
  display: flex;
  align-items: center;
  height: var(--row-height);
  padding: 0 var(--space-3);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  line-height: var(--leading-tight);
  border-left: var(--border-width-thick) solid transparent;
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

.log-row:hover {
  background-color: var(--color-row-hover);
}

.log-row--expanded {
  height: auto;
  min-height: var(--row-height);
  background-color: var(--color-expanded-row);
  align-items: flex-start;
  padding-top: var(--space-2);
  padding-bottom: var(--space-2);
}

/* Level-based left border colors */
.log-row--trace    { border-left-color: var(--color-level-trace); }
.log-row--debug    { border-left-color: var(--color-level-debug); }
.log-row--info     { border-left-color: var(--color-level-info); }
.log-row--notice   { border-left-color: var(--color-level-notice); }
.log-row--warn     { border-left-color: var(--color-level-warn); }
.log-row--warning  { border-left-color: var(--color-level-warning); }
.log-row--error    { border-left-color: var(--color-level-error); }
.log-row--fatal    { border-left-color: var(--color-level-fatal); }
.log-row--critical { border-left-color: var(--color-level-critical); }
.log-row--unrecognized { border-left-color: var(--color-level-unrecognized); }

.log-row__timestamp {
  flex-shrink: 0;
  color: var(--color-text-secondary);
  margin-right: var(--space-3);
  font-variant-numeric: tabular-nums;
}

.log-row__message {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.log-row__expanded-content {
  white-space: pre-wrap;
  word-break: break-all;
  padding: var(--space-2) 0;
  color: var(--color-text-primary);
}
```

#### B.4: Lane Header

```css
.lane-header {
  display: flex;
  align-items: center;
  height: var(--lane-header-height);
  padding: 0 var(--space-3);
  background-color: var(--color-swimlane-header);
  border-bottom: var(--border-width) solid var(--color-border);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  gap: var(--space-2);
}

.lane-header__drag-handle {
  cursor: grab;
  color: var(--color-text-disabled);
  flex-shrink: 0;
}

.lane-header__drag-handle:active {
  cursor: grabbing;
}

.lane-header__pattern {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lane-header--error {
  background-color: var(--color-lane-error-bg);
  border-bottom-color: var(--color-lane-error-border);
}

.lane-header--unmatched {
  font-style: italic;
  color: var(--color-text-disabled);
}
```

#### B.5: Swimlane Grid

```css
.swimlane-grid {
  display: grid;
  height: 100%;
  overflow: hidden;
  /* grid-template-columns set dynamically based on lane count */
}

.swimlane-column {
  border-right: var(--border-width) solid var(--color-border-subtle);
  overflow-y: auto;
  overflow-x: hidden;
}

.swimlane-column:last-child {
  border-right: none;
}
```

#### B.6: Filter Bar

```css
.filter-bar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  height: var(--filter-bar-height);
  padding: 0 var(--space-4);
  border-bottom: var(--border-width) solid var(--color-border-subtle);
  flex-shrink: 0;
  overflow-x: auto;
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  background-color: var(--color-surface);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--border-radius-full);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-text-primary);
  cursor: pointer;
  transition: background-color var(--transition-fast),
              border-color var(--transition-fast);
}

.filter-chip:hover {
  background-color: var(--color-surface-hover);
  border-color: var(--color-border-focus);
}

.filter-chip--disabled {
  opacity: 0.5;
  text-decoration: line-through;
}

.filter-chip__remove {
  color: var(--color-text-disabled);
  cursor: pointer;
  font-size: var(--text-xs);
}

.filter-chip__remove:hover {
  color: var(--color-error);
}

.filter-add-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  background: none;
  border: var(--border-width) dashed var(--color-border);
  border-radius: var(--border-radius-full);
  color: var(--color-text-disabled);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: border-color var(--transition-fast),
              color var(--transition-fast);
}

.filter-add-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-text-primary);
}
```

#### B.7: Mode Toggle (Pill-shaped Switch)

```css
.mode-toggle {
  display: inline-flex;
  align-items: center;
  background-color: var(--color-grey-800);
  border-radius: var(--border-radius-full);
  padding: var(--space-1);
  gap: 0;
}

.mode-toggle__option {
  padding: var(--space-1) var(--space-3);
  border-radius: var(--border-radius-full);
  border: none;
  background: none;
  color: var(--color-text-secondary);
  font-family: var(--font-sans);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  cursor: pointer;
  transition: background-color var(--transition-fast),
              color var(--transition-fast);
}

.mode-toggle__option:hover {
  color: var(--color-text-primary);
}

.mode-toggle__option--active {
  background-color: var(--color-toggle-active);
  color: var(--color-grey-50);
}
```

#### B.8: Stream-Ended Indicator

```css
.stream-ended {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  background-color: var(--color-surface);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--border-radius-md);
  color: var(--color-text-secondary);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
}

.stream-ended__dot {
  width: 8px;
  height: 8px;
  border-radius: var(--border-radius-full);
  background-color: var(--color-text-disabled);
}
```

#### B.9: Unparseable Timestamp Panel

```css
.unparseable-panel {
  position: relative;
  max-height: var(--unparseable-panel-max-height);
  overflow-y: auto;
  background-color: var(--color-unparseable-bg);
  border-top: var(--border-width) solid var(--color-unparseable-border);
  flex-shrink: 0;
}

.unparseable-panel__header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--color-error);
}

.unparseable-panel__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 var(--space-1);
  background-color: var(--color-error);
  color: var(--color-grey-50);
  border-radius: var(--border-radius-full);
  font-size: var(--text-xs);
  font-weight: var(--weight-bold);
}

.unparseable-panel__row {
  padding: var(--space-1) var(--space-4);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  border-top: var(--border-width-thin) solid var(--color-unparseable-border);
}
```

#### B.10: Settings Panel (Slide-out)

```css
.settings-backdrop {
  position: fixed;
  inset: 0;
  background-color: var(--color-backdrop);
  z-index: 100;
}

.settings-panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: var(--settings-panel-width);
  background-color: var(--color-panel-bg);
  box-shadow: var(--shadow-5);
  z-index: 101;
  overflow-y: auto;
  padding: var(--space-6);
  transform: translateX(0);
  transition: transform var(--transition-normal);
}

.settings-panel--closed {
  transform: translateX(100%);
}

.settings-panel__section {
  margin-bottom: var(--space-6);
}

.settings-panel__section-title {
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  color: var(--color-text-primary);
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-2);
  border-bottom: var(--border-width) solid var(--color-border-subtle);
}

.settings-panel__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin-bottom: var(--space-4);
}

.settings-panel__label {
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--color-text-secondary);
}
```

#### B.11: Ad-hoc Lane Input

```css
.lane-add-input {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.lane-add-input__field {
  padding: var(--space-1) var(--space-3);
  background-color: var(--color-surface);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--border-radius-md);
  color: var(--color-text-primary);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  outline: none;
  transition: border-color var(--transition-fast);
}

.lane-add-input__field:focus {
  border-color: var(--color-border-focus);
}

.lane-add-input__field::placeholder {
  color: var(--color-text-disabled);
}
```

#### B.12: Generic Component States

```css
/* --- Focus ring (for keyboard navigation) --- */
.focus-ring:focus-visible {
  outline: var(--border-width) solid var(--color-border-focus);
  outline-offset: var(--border-width);
}

/* --- Disabled state --- */
.is-disabled {
  opacity: 0.4;
  pointer-events: none;
  cursor: not-allowed;
}

/* --- Error state --- */
.is-error {
  border-color: var(--color-error);
  color: var(--color-error);
}
```

#### B.13: Utility Classes (minimal set)

```css
/* --- Text utilities --- */
.text-mono  { font-family: var(--font-mono); }
.text-sans  { font-family: var(--font-sans); }
.text-xs    { font-size: var(--text-xs); }
.text-sm    { font-size: var(--text-sm); }
.text-base  { font-size: var(--text-base); }
.text-lg    { font-size: var(--text-lg); }
.text-muted { color: var(--color-text-secondary); }
```

**Verification**: `components.css` contains zero hardcoded values. Every visual property references a `var(--token)`.

---

### Phase C: Create `DesignReferencePage.tsx` -- Visual Showcase

**Goal**: A React component that renders every token and component sketch so they can be visually verified in the browser.

**File**: `src/renderer/src/DesignReferencePage.tsx`

**Steps**:

1. Create `DesignReferencePage.tsx` as a single functional component that renders sections:
   - **Color Swatches**: Render every color token as a small square with the token name and hex value. Group by: greys, log levels, semantic colors.
   - **Spacing Scale**: Render bars at each spacing value with labels.
   - **Typography Samples**: Render text at each font size, in both mono and sans-serif, with weight variations.
   - **Shadow Showcase**: 5 boxes showing each shadow level.
   - **Border Samples**: Show border-width and border-radius variations.
   - **Component Sketches**: Render static HTML+CSS previews of each component:
     - Log rows (one per log level, plus expanded state)
     - Lane header (normal, error, unmatched)
     - Filter bar with sample chips
     - Mode toggle (Live active, Scroll active)
     - Stream-ended indicator
     - Unparseable panel with sample entries
     - Settings panel preview
     - Ad-hoc lane input
   - **State Variations**: For key components (log row, filter chip, lane header), show default, hover (using a class like `preview-hover`), active, focus, disabled, error.

**Implementation notes**:
- This is a throwaway/development page. It exists only for visual verification during design work. It will be replaced when real components are built in Phase 05+.
- Use CSS classes from `components.css`. No inline styles.
- For hover/active states, create them using forced-state CSS classes (e.g., `.preview-hover` that mirrors the `:hover` styles) so they can be seen without mouse interaction. Add a small block at the end of `components.css` under a `/* --- Design Reference Preview States --- */` comment.
- The page should be scrollable with clear section headings.
- Use `<section>` elements with `<h2>` headings for each section.

**Key concern**: This component is **presentation only**. No state, no hooks, no interactivity. Pure JSX returning styled markup.

**Verification**: `npm run dev` shows the design reference page. All sections render. No console errors.

---

### Phase D: Update `App.tsx` -- Remove Inline Styles

**Goal**: Replace inline styles with CSS classes. Import theme CSS files.

**File**: `src/renderer/src/App.tsx`

**Steps**:

1. Add CSS imports at the top of `App.tsx`:
   ```typescript
   import '../theme/tokens.css'
   import '../theme/components.css'
   ```

2. Replace the current inline-styled `<div>` with:
   - A root `<div className="app-layout">` that uses the CSS class
   - Render `<DesignReferencePage />` inside it

3. The component should be minimal -- just the outer layout wrapper rendering the design reference page.

**Important**: The `import` paths use `../theme/` (going up from `src/renderer/src/` to `src/renderer/theme/`). This works because Vite processes CSS imports in JS/TSX files.

**Verification**: `npm run typecheck` passes. `npm run dev` renders the design reference page styled with theme CSS.

---

### Phase E: CSS Variable Injection Pattern -- Document and Stub

**Goal**: Document and create a minimal stub showing how runtime config values will override CSS tokens.

**Steps**:

1. Add a comment block at the top of `tokens.css` documenting the injection pattern:

```css
/*
 * Runtime CSS Variable Injection
 * ================================
 * Config values from ~/.config/log-swim-ui/config.json override these defaults
 * at runtime via document.documentElement.style.setProperty().
 *
 * Example (applied in the renderer when config is loaded):
 *   document.documentElement.style.setProperty('--color-level-error', config.colors.levels.error);
 *   document.documentElement.style.setProperty('--row-height', config.ui.rowHeight + 'px');
 *   document.documentElement.style.setProperty('--text-sm', config.ui.fontSize + 'px');
 *
 * This pattern allows all CSS to reference tokens via var(), and config changes
 * take effect immediately without re-rendering React components.
 *
 * The injection function will be implemented in Phase 04 (Electron Shell & CLI)
 * when the config system is built. The CSS variables defined below serve as defaults.
 */
```

2. Create a small utility stub at `src/renderer/src/applyConfigToCSS.ts`:

```typescript
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
  readonly fontFamily: string
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
```

**Verification**: `npm run typecheck` passes. The stub is importable but not called yet.

---

### Phase F: Visual Verification via Playwright MCP

**Goal**: Use Playwright MCP to screenshot the design reference page and visually verify dark theme cohesion.

**Steps**:

1. Run `npm run dev` to start the dev server
2. Use Playwright MCP to navigate to the Electron dev server URL (typically `http://localhost:5173`)
3. Take a full-page screenshot
4. Verify:
   - Dark background (`#0F172A`) is applied
   - Color swatches render with correct colors
   - Typography samples show in both mono and sans-serif
   - Component sketches are visible and properly styled
   - No visual inconsistencies or contrast issues
   - All log level colors are distinct and readable
5. Save screenshots to `.out/` directory (not source-controlled)

**Note**: The Electron window may not be directly navigable via Playwright MCP. If so, the implementor can use Playwright MCP against the Vite dev server URL directly (the renderer content is served at `http://localhost:5173` when running `npm run dev`). Alternatively, temporarily open the design reference page in a regular browser tab for verification.

---

## Implementation Order Summary

| Order | Phase | Files Created/Modified | Depends On |
|-------|-------|----------------------|------------|
| 1 | A: tokens.css | `src/renderer/theme/tokens.css` (new) | Nothing |
| 2 | B: components.css | `src/renderer/theme/components.css` (new) | A |
| 3 | C: DesignReferencePage | `src/renderer/src/DesignReferencePage.tsx` (new) | A, B |
| 4 | D: Update App.tsx | `src/renderer/src/App.tsx` (modified) | A, B, C |
| 5 | E: CSS Injection Stub | `src/renderer/src/applyConfigToCSS.ts` (new), tokens.css header (modified) | A |
| 6 | F: Visual Verification | Screenshots in `.out/` | A, B, C, D |

Phases A-D are sequential. Phase E is independent of C and D (only needs A). Phase F requires everything.

---

## Technical Considerations

### CSS Architecture Decisions

1. **Flat token namespace**: All tokens live in `:root` with a `--category-name` convention (e.g., `--color-level-error`, `--space-4`, `--text-sm`). No nesting, no BEM-style token names. This keeps tokens simple and grep-able.

2. **BEM-ish component classes**: Component classes use `component__element--modifier` naming (e.g., `.log-row__timestamp`, `.log-row--expanded`, `.lane-header--error`). This provides clear hierarchy without CSS nesting complexity.

3. **No CSS preprocessor**: Raw CSS with custom properties. No Sass, no PostCSS, no CSS Modules. The entire design system is two files. The complexity of adding a preprocessor is not justified.

4. **No `@layer`**: CSS layers are a nice feature but unnecessary when the entire design system is two files imported in a known order. Tokens first, components second.

### Font Loading

The font stacks use web-safe fallbacks. JetBrains Mono and Inter are specified first but will only render if the user has them installed. For Phase 02, this is fine -- we are not adding `@font-face` declarations or loading fonts from a CDN. If fonts need to be bundled, that is a follow-up task for later phases.

### Performance

- All CSS is static (no dynamic styles beyond the runtime injection pattern)
- CSS custom properties cascade efficiently
- No CSS-in-JS overhead
- Component CSS uses simple selectors (no deep nesting, no expensive selectors)

---

## Acceptance Criteria Verification

| Criterion | How to verify |
|-----------|---------------|
| `tokens.css` exists with complete definitions | File exists at `src/renderer/theme/tokens.css` with all sections (colors, spacing, typography, shadows, borders) |
| `components.css` exists referencing only CSS variables | File exists at `src/renderer/theme/components.css`. `grep` for hardcoded color/size values -- there should be none |
| HSL color palette with shade scales | `tokens.css` contains `--color-grey-50` through `--color-grey-950` with HSL values |
| Spacing scale 4-128px | `tokens.css` contains `--space-1` through `--space-32` |
| Typography scale with mono and sans-serif | `tokens.css` contains `--font-mono`, `--font-sans`, `--text-xs` through `--text-2xl` |
| Shadow system (5 levels) | `tokens.css` contains `--shadow-1` through `--shadow-5` |
| Design reference page shows all tokens | `DesignReferencePage.tsx` renders color swatches, typography samples, spacing bars, shadow boxes, component sketches |
| All component states designed | Reference page shows default, hover, active, focus, disabled, error for key components |
| Dark theme cohesion verified | Playwright MCP screenshot shows consistent dark theme, good contrast |
| CSS variable injection pattern documented | `tokens.css` header comment documents the pattern. `applyConfigToCSS.ts` stub exists and typechecks |

### Automated verification

```bash
# 1. Typecheck
npm run typecheck

# 2. Verify files exist
ls src/renderer/theme/tokens.css src/renderer/theme/components.css src/renderer/src/DesignReferencePage.tsx src/renderer/src/applyConfigToCSS.ts

# 3. Verify no hardcoded colors in components.css (should return only comments or zero matches)
grep -n '#[0-9a-fA-F]\{3,8\}' src/renderer/theme/components.css

# 4. Verify tokens coverage
grep -c '^  --' src/renderer/theme/tokens.css  # should be 70+ token definitions

# 5. Dev server launches
npm run dev
```

---

## What NOT to Do

- Do NOT add any business logic, data types, or state management
- Do NOT create functional React components (no hooks, no state, no effects)
- Do NOT add font-face declarations or font file downloads
- Do NOT install any CSS framework (Tailwind, styled-components, etc.)
- Do NOT add CSS modules or CSS-in-JS
- Do NOT create a Storybook setup -- a simple React page is sufficient
- Do NOT use inline styles in the design reference page -- use CSS classes from `components.css`
- Do NOT add tests for this phase -- it is visual CSS work verified by screenshots
- Do NOT create React components for each UI element -- this is CSS only. The `DesignReferencePage` uses raw HTML elements (`div`, `span`, `button`) with CSS classes
