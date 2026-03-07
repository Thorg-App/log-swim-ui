---
id: wmtjnten6eiw5repedjlu2tig
title: "change input key names"
status: done
deps: []
links: []
created_iso: 2026-03-01T14:28:47Z
status_updated_iso: 2026-03-06T23:55:00Z
type: task
priority: 0
assignee: nickolaykondratyev
resolution: "Completed - CLI flags renamed with all tests passing"
---

TASK: Change the input key fields

FROM:
```sh file=[/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/test_manual.sh] Lines=[8-8]
  cat ./test_data/sample-logs/sample-logs-10-lines.jsonl | log-swim-ui --key-level "level" --key-timestamp "timestamp"
```

TO:
```sh file=[/home/nickolaykondratyev/git_repos/Thorg-App_log-swim-ui/test_manual.sh] Lines=[8-8]
  cat ./test_data/sample-logs/sample-logs-10-lines.jsonl | log-swim-ui --input_key.level "level" --input_key.timestamp "timestamp"
```

--------------------------------------------------------------------------------
Also let's change '--lanes' key to be more explicit. From '--lanes' to something like '--regexes_for_filter_columns'

---

## Resolution

**Status**: COMPLETED

**Commit**: `f695415`

### Changes Made

**CLI Flag Changes:**
- `--key-level` → `--input_key.level`
- `--key-timestamp` → `--input_key.timestamp`
- `--lanes` → `--regexes_for_filter_columns`

**Internal Property Changes:**
- `keyLevel` → `inputKeyLevel`
- `keyTimestamp` → `inputKeyTimestamp`
- `lanePatterns` → `filterColumnPatterns`

### Files Modified (14 total)

**Core Logic (4):**
- `src/core/types.ts` - Updated `CliArgsResult` interface
- `src/main/cli-parser.ts` - Updated flag names and property names
- `src/main/index.ts` - Updated `APP_FLAGS` array and IPC handlers
- `src/main/ipc-bridge.ts` - Updated `IpcBridgeDeps` interface

**Renderer (1):**
- `src/renderer/src/useAppInit.ts` - Updated property access

**Tests (3):**
- `tests/unit/main/cli-parser.test.ts` - 33 tests updated
- `tests/unit/main/ipc-bridge.test.ts` - 12 tests updated
- `tests/e2e/app.spec.ts` - E2E test constants updated

**Documentation (6):**
- `README.md` - Usage examples updated
- `test_manual.sh` - Test script updated
- `CLAUDE.md` - Project structure comments updated
- `doc/starting_spec/start_spec.md` - Spec documentation updated
- `doc/ralph/log-swim-ui/log-swim-ui-high-level.md` - Type reference updated
- `doc/ralph/log-swim-ui/tasks/done/04_electron_shell_cli.md` - Interface examples updated

### Verification

- **Unit Tests**: 326 passed (17 test files)
- **TypeScript**: 0 errors
- **Build**: Success
