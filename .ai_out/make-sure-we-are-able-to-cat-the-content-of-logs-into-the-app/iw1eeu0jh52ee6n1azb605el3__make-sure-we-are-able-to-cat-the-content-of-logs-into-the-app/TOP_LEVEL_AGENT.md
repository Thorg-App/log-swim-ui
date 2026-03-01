# TOP_LEVEL_AGENT Coordination Log

## Ticket
`iw1eeu0jh52ee6n1azb605el3` — Make sure we are able to cat the content of logs into the app

## Status: IN_PROGRESS

## Phases Completed
- [x] EXPLORATION — Root cause identified: IPC race condition (data sent before listeners registered)
- [x] CLARIFICATION — Skipped (requirements clear from ticket + code analysis)
- [ ] REPRODUCE — Code analysis confirms the race; no runtime reproduction possible (requires display)
- [ ] FIND_ROOT_CAUSE — Root cause identified during exploration
- [ ] ROOT_CAUSE_REVIEW
- [ ] IMPLEMENTATION
- [ ] IMPLEMENTATION_REVIEW
- [ ] IMPLEMENTATION_ITERATION

## Root Cause Summary
When `cat file.jsonl | log-swim-ui` is run, all stdin data arrives before the renderer registers IPC listeners. The `did-finish-load` handler starts reading stdin immediately, but React needs 2 async IPC round-trips (`getConfig`, `getCliArgs`) before `useLogIngestion` registers its listeners. All LOG_LINE and STREAM_END messages are lost.

## Fix Strategy
RENDERER_READY handshake: main waits for renderer signal before starting IpcBridge.
