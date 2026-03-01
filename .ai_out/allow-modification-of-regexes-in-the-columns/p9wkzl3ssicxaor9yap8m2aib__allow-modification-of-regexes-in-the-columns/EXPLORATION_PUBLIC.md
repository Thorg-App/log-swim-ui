# Exploration Summary

## Current State

### Lane Headers (LaneHeader.tsx)
- Display regex pattern as read-only text with truncation + tooltip
- Drag handle (⠿) for reorder
- Visual states: error (invalid regex), unmatched, drag-over
- **No edit, no remove, no case sensitivity toggle**

### Lane State Management (App.tsx)
- `lanes: LaneDefinition[]` state with `applyLaneChange` DRY helper
- `handleAddLane(pattern)` — creates lane, appends before unmatched
- `handleReorderLanes(from, to)` — drag-drop reorder
- **No handleEditLane, no handleRemoveLane**
- `applyLaneChange` reclassifies all entries + bumps version

### LaneDefinition (types.ts)
```typescript
interface LaneDefinition {
  readonly pattern: string
  readonly regex: RegExp | null
  readonly isError: boolean
}
```
- No `caseSensitive` field — always default RegExp (case-sensitive)
- Created via `createLaneDefinition(pattern)` factory

### FilterBar/FilterChip (existing filter UI)
- Rich interaction: add, remove, toggle enabled, toggle mode (include/exclude), toggle case sensitivity (Aa/aa)
- FilterChip shows: mode indicator (+/−), label, case indicator (Aa/aa), remove button (×)
- Filter type is `FieldFilter | RawFilter` discriminated union with `mode`, `caseSensitive` fields

### Lane Classification
- `LaneClassifier.classify(rawJson, lanes)` — first-match-wins
- Tests rawJson against each lane's regex
- Returns `lanes.length` for unmatched

## Gap Analysis: What's Missing for the Ticket

| Capability | FilterBar/FilterChip | LaneHeader | Gap |
|-----------|---------------------|------------|-----|
| Add | ✅ inline form | ✅ LaneAddInput | — |
| Remove | ✅ × button | ❌ | Need × button |
| Edit pattern | ❌ (remove+re-add) | ❌ | Need inline edit |
| Case sensitivity | ✅ Aa/aa toggle | ❌ | Need toggle + LaneDefinition field |
| Reorder | N/A | ✅ drag-drop | — |

## Key Files
- `src/core/types.ts` — LaneDefinition, createLaneDefinition
- `src/core/lane-classifier.ts` — LaneClassifier
- `src/renderer/src/App.tsx` — lane state + callbacks
- `src/renderer/src/components/LaneHeader.tsx` — lane header display
- `src/renderer/src/components/SwimLaneGrid.tsx` — grid + lane header wiring
- `src/renderer/src/components/FilterChip.tsx` — reference for chip interaction pattern
- `src/renderer/src/components/LaneAddInput.tsx` — existing lane add UI
- `tests/e2e/app.spec.ts` — 15 existing E2E tests
