# Exploration Results — Phase 02: UI Design Direction

## Codebase State

### Current Structure
```
src/
├── core/                    # Empty (.gitkeep only)
├── main/
│   └── index.ts            # Electron main process stub
├── preload/
│   └── index.ts            # Preload bridge stub
└── renderer/
    ├── index.html          # HTML entry point
    └── src/
        ├── App.tsx         # Minimal stub with inline styles
        └── main.tsx        # React DOM entry point
```

### Key Observations
- **No CSS infrastructure yet** — All styling is inline in App.tsx
- **No theme/tokens files** — Phase 02 creates these from scratch
- App.tsx is a minimal placeholder: dark bg `#0F172A`, text `#E2E8F0`
- electron.vite.config.ts has path aliases: `@renderer` → `src/renderer/src`, `@core` → `src/core`
- TypeScript strict mode enforced in both tsconfigs
- vitest configured with `@core` alias, node environment, no test files exist yet

### Dependencies
- React 19, Electron 40, Vite 7, electron-vite 5
- vitest 4, @playwright/test 1.58
- No CSS framework or preprocessor

## Design Principles (from task + high-level spec)

### Audience & Tone
- Technical users (software engineers)
- Utilitarian, clean, information-dense — developer tool, not consumer product

### Color System
- HSL-based palette
- 8-10 grey shades
- Primary + accent colors for states
- Boost saturation at lightness extremes
- Dark background: `#0F172A`
- Log level colors defined in high-level spec config

### Typography
- Monospace for log content: JetBrains Mono / Fira Code / SF Mono
- Sans-serif for UI chrome: Inter / system font stack
- Hand-picked scale, no ratio-based

### Spacing
- Scale: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128px
- Start generous, tighten
- Spacing = grouping

### Depth
- Light from above
- Shadow = elevation
- Two-part shadows
- 5 levels

### Borders
- 2px muted preferred over 1px strong

### Color Values (from config.json spec)
```json
{
  "levels": {
    "trace":    "#6B7280",
    "debug":    "#94A3B8",
    "info":     "#3B82F6",
    "notice":   "#06B6D4",
    "warn":     "#F59E0B",
    "warning":  "#F59E0B",
    "error":    "#EF4444",
    "fatal":    "#991B1B",
    "critical": "#991B1B"
  },
  "unrecognizedLevel": "#F97316",
  "swimlaneHeaders":   "#1E293B",
  "background":        "#0F172A",
  "rowHover":          "#1E293B",
  "expandedRow":       "#334155"
}
```

## Design Memory Status
- The referenced design memory files (`my-frontend-design.md`, `part_2` through `part_8`) are NOT available on this system (they exist on a macOS machine via `$MY_DEEP_MEM`)
- All essential design guidance is already embedded in the task document and high-level spec

## Output Target
```
src/renderer/theme/
  tokens.css        — CSS custom properties (all visual values)
  components.css    — Structural styles referencing only CSS variables
```
Plus a design reference page to verify visual coherence.
