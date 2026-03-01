---
id: ldsevx0g3koesmf4fpgikzh4o
title: "Make it more obvious that there is a global filter"
status: in_progress
deps: []
links: []
created_iso: 2026-03-01T14:39:18Z
status_updated_iso: 2026-03-01T14:56:27Z
type: task
priority: 0
assignee: nickolaykondratyev
---

We should make it more obvious how the global filter works and extend the global filter.

The global filtering group should be the topmost line. While the addition of column filtering should be closer the columns themselves.

The global filter should have ability to FILTER to match and to FILTER to NOT match (exclusion filter).

We should also CLARIFY the naming of "Filter" to something like "Global Include/Exclude Filter"

WITH filtering we should allow case-sensitive or case-insensitive filtering. That should be a flag. The default should be case-insensitive filtering for the global filter (users should be able to toggle.)