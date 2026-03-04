---
id: ydbteeh39lamd1qjuwns985kf
title: "case insensitive should be the default of when we add regexes, or from the columns we can tweak ui to add case sensitivity"
status: closed
deps: []
links: []
created_iso: 2026-03-04T19:04:18Z
status_updated_iso: 2026-03-04T19:30:00Z
type: task
priority: 0
assignee: nickolaykondratyev
---

## Resolution

**Completed on:** 2026-03-04

### Summary
Changed the default case sensitivity for lane regex patterns from `true` (case-sensitive) to `false` (case-insensitive), aligning lane behavior with filter behavior.

### Changes Made
1. **`src/core/types.ts`** - Changed default in `createLaneDefinition()` from `caseSensitive ?? true` to `caseSensitive ?? false`
2. **`tests/unit/core/types.test.ts`** - Updated tests to expect `caseSensitive: false` and `regex.flags === 'i'` by default
3. **`tests/e2e/app.spec.ts`** - Updated case sensitivity toggle tests to expect `"aa"` initially (case-insensitive)

### Test Results
- 300 unit tests - all pass
- 22 E2E tests - all pass

### User Impact
New lanes created via CLI args or UI will now be case-insensitive by default. Users can still toggle to case-sensitive via the "Aa"/"aa" button in the lane header.

### Commit
`b9faaf0` - feat: make case-insensitive the default for lane regex patterns
