# Exploration: Case Sensitivity Defaults

## Current State

### Lanes (LaneDefinition)
- **Default:** `caseSensitive: true` (case-sensitive)
- **Location:** `src/core/types.ts` line 54 in `createLaneDefinition()`
- **UI Toggle:** Exists in `LaneHeader.tsx` (lines 171-182) - shows "Aa"/"aa"
- **Creation UI:** `LaneAddInput.tsx` - no case sensitivity option at creation

### Filters
- **Default:** `caseSensitive: false` (case-insensitive)
- **Location:** `src/core/filter.ts` lines 68, 89 in `FilterEngine.createFieldFilter/createRawFilter()`
- **UI Toggle:** Exists in `FilterChip.tsx` (lines 53-65) - shows "Aa"/"aa"
- **Creation UI:** `FilterBar.tsx` includes case sensitivity toggle in add form

## Inconsistency Identified

- **Lanes** default to case-sensitive (`true`)
- **Filters** default to case-insensitive (`false`)

## Task Requirement

Make case-insensitive the default for lanes to match filters. The UI already supports toggling case sensitivity post-creation.

## Key Files to Modify

1. `src/core/types.ts` - Change default in `createLaneDefinition()` from `true` to `false`
2. Update any tests that expect case-sensitive default
