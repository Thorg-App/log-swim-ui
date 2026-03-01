# ROOT_CAUSE_REVIEWER -- Private Analysis

## File-by-File Evidence

### 1. `src/main/index.ts` (lines 97-113) -- The Race Starts Here

```typescript
mainWindow.webContents.on('did-finish-load', () => {
    // ...
    if (!isE2eTest) {
      const bridge = new IpcBridge({
        keyLevel: cliArgs.keyLevel,
        keyTimestamp: cliArgs.keyTimestamp,
        sender: mainWindow.webContents
      })
      bridge.start(process.stdin)
    }
  })
```

**Observation:** `did-finish-load` fires when the HTML page has finished loading its resources -- it means the DOM is ready and scripts have executed their synchronous top-level code. At this point:
- `main.tsx` has called `createRoot(document.getElementById('root')!).render(<App />)`
- React has rendered the **initial synchronous output** of `<App />`
- But React `useEffect` hooks have NOT yet fired (they run asynchronously after the paint cycle)

The bridge calls `StdinReader.start(process.stdin)` immediately. With `cat` piping, `process.stdin` already has all 10 lines buffered in the kernel pipe buffer. The `readline` interface will emit them on the next microtick/tick.

### 2. `src/core/stdin-reader.ts` -- Line Emission Timing

```typescript
static start(input: Readable, callbacks: StdinReaderCallbacks): StdinReaderHandle {
    const rl = createInterface({ input })
    rl.on('line', (line: string) => { callbacks.onLine(line) })
    rl.on('close', () => { callbacks.onEnd() })
    // ...
  }
```

**Observation:** `readline.createInterface` reads from the Readable in flowing mode. When `cat` has already finished writing and closed its end of the pipe, all data is already in the kernel buffer. Node.js `readline` will emit `line` events rapidly (in the same event loop drain cycle or across a few microtasks), followed immediately by `close`.

Each `onLine` call hits `IpcBridge.handleLine` which calls `sender.send(IPC_CHANNELS.LOG_LINE, ipcLine)` -- this is `webContents.send()`, which dispatches the IPC message to the renderer immediately.

### 3. `src/main/ipc-bridge.ts` -- No Buffering

```typescript
this.deps.sender.send(IPC_CHANNELS.LOG_LINE, ipcLine)  // line 112
// ...
this.deps.sender.send(IPC_CHANNELS.STREAM_END)          // line 116
```

**Observation:** Messages are sent directly via `webContents.send()`. There is no outbound queue, no "wait for acknowledgment", no retry. Electron's `webContents.send()` dispatches the IPC message to the renderer's IPC message queue. If no listener is registered on `ipcRenderer.on(channel)` when the message arrives, it is silently dropped.

### 4. `src/preload/index.ts` -- No Buffering

```typescript
onLogLine: (callback) => {
    const handler = (_event: IpcRendererEvent, line: IpcLogLine): void => callback(line)
    ipcRenderer.on(IPC_CHANNELS.LOG_LINE, handler)
    return () => { ipcRenderer.removeListener(IPC_CHANNELS.LOG_LINE, handler) }
  },
```

**Observation:** The preload bridge is a thin wrapper. It registers listeners on `ipcRenderer` only when called (i.e., when the renderer component invokes `window.api.onLogLine(callback)`). There is zero message queuing or replay logic. Messages that arrive before `ipcRenderer.on()` is called are lost.

### 5. `src/renderer/src/App.tsx` (lines 22-46) -- The Conditional Gate

```typescript
function App() {
  const init = useAppInit()    // status starts as 'loading'

  if (init.status === 'loading') {
    return <div>Loading...</div>  // <-- THIS is what renders initially
  }
  // ...
  return <AppShell config={init.config} ... />
}
```

**Observation:** On first render, `useAppInit` returns `{ status: 'loading' }`. The `<AppShell>` component (which contains `useLogIngestion`) is NOT mounted. `useLogIngestion`'s `useEffect` -- which registers the IPC listeners -- does NOT run.

### 6. `src/renderer/src/useAppInit.ts` (lines 35-63) -- Two Async Round-Trips

```typescript
useEffect(() => {
    async function init(): Promise<void> {
      const [config, cliArgs] = await Promise.all([
        window.api.getConfig(),     // IPC invoke round-trip #1
        window.api.getCliArgs()     // IPC invoke round-trip #2
      ])
      // ... process ...
      setResult({ status: 'ready', config, lanes, masterList })
    }
    void init()
  }, [])
```

**Observation:** This `useEffect` fires after the first paint. It makes two `ipcRenderer.invoke()` calls (which are async IPC round-trips to the main process and back). Each round-trip involves:
1. Renderer -> Main (via IPC)
2. Main processes the handler
3. Main -> Renderer (response via IPC)

Only after both resolve does `setResult({ status: 'ready' })` fire, which triggers a re-render, which mounts `<AppShell>`, which runs `useLogIngestion`'s `useEffect`, which finally registers `window.api.onLogLine(...)`.

### 7. `src/renderer/src/useLogIngestion.ts` (lines 59-105) -- Listeners Register Too Late

```typescript
useEffect(() => {
    const logBuffer = new LogBuffer(...)
    const unsubLogLine = window.api.onLogLine((ipcLine) => { ... })
    const unsubStreamEnd = window.api.onStreamEnd(() => { ... })
    // ...
  }, [masterList, lanesRef, configRef])
```

**Observation:** This effect registers listeners. By the time it runs, the full sequence is:
1. `did-finish-load` fires
2. React renders `<App>` -> `useAppInit` returns `loading` -> renders "Loading..." div
3. `useAppInit`'s `useEffect` fires, starts 2 async IPC round-trips
4. **Meanwhile**, `IpcBridge.start(process.stdin)` was called in step 1's callback
5. `readline` reads all buffered stdin lines, sends all LOG_LINE + STREAM_END messages
6. **All messages arrive in renderer** -- but no listeners are registered yet -- **messages are dropped**
7. `useAppInit`'s promises resolve, state becomes `ready`
8. React re-renders, mounts `<AppShell>`, mounts `useLogIngestion`
9. `useLogIngestion`'s `useEffect` registers listeners -- **too late, all messages already sent**

### 8. E2E Tests -- Why They Work (Confirming the Race)

In `tests/e2e/helpers/electron-app.ts`:
```typescript
async function launchApp(cliArgs: string[]): Promise<TestApp> {
  // ...
  const page = await electronApp.firstWindow()
  await page.waitForSelector('.swimlane-grid', { timeout: 10_000 })
  return { electronApp, page }
}
```

E2E tests wait for `.swimlane-grid` to be visible (which only renders after `AppShell` mounts, which means `useLogIngestion` listeners are already registered). Only THEN do tests call `injectLogLines()`. This is an implicit handshake that the production path lacks.

---

## Timing Analysis Summary

```
MAIN PROCESS                              RENDERER PROCESS
============                              =================
did-finish-load fires
  |                                       React renders <App>
  |                                       useAppInit returns 'loading'
  |                                       Renders "Loading..." div
  |                                       useAppInit's useEffect fires
  |                                         -> getConfig() IPC invoke ---->  [IPC round-trip]
  |                                         -> getCliArgs() IPC invoke --->  [IPC round-trip]
  |
  +-- IpcBridge.start(process.stdin)
  |     readline reads all buffered lines
  |     sends LOG_LINE x 10  ----------->  NO LISTENER -- DROPPED
  |     sends STREAM_END     ----------->  NO LISTENER -- DROPPED
  |
  |                                       getConfig() response arrives
  |                                       getCliArgs() response arrives
  |                                       setResult({ status: 'ready' })
  |                                       React re-renders -> <AppShell>
  |                                       useLogIngestion's useEffect fires
  |                                         -> window.api.onLogLine(...)  <-- REGISTERED (too late)
  |                                         -> window.api.onStreamEnd(...) <-- REGISTERED (too late)
```

## Confirmation: No Buffering Anywhere

- **IpcBridge**: No outbound queue. Direct `webContents.send()`.
- **Preload**: No message queue. Thin wrapper over `ipcRenderer.on()`.
- **LogBuffer** (`src/core/log-buffer.ts`): This buffers entries AFTER they are received by the renderer, for batching into MasterList. It does NOT buffer IPC messages before listener registration.
- **Electron itself**: `webContents.send()` does not queue messages for later delivery. If no listener is registered for a channel, the message is silently discarded.

## ROOT CAUSE: VALIDATED

The race condition analysis is **correct in every detail**.

---

## Fix Assessment: RENDERER_READY Handshake

### Proposed Fix

> Add a `RENDERER_READY` IPC channel. Main waits for this signal before starting IpcBridge. Renderer signals after `useLogIngestion` registers its listeners.

### Assessment

**Sufficient:** Yes. This directly addresses the race by ensuring no data is sent before the renderer can receive it.

**Simple (KISS/80/20):** Yes. It requires:
1. One new IPC channel constant (`RENDERER_READY`)
2. Renderer sends signal after `useLogIngestion` mounts (1 line)
3. Main waits for signal before starting IpcBridge (change `did-finish-load` handler to also wait for `RENDERER_READY`)

**Edge Cases to Handle:**

1. **Renderer crash/failure to signal**: Main should have a timeout. If `RENDERER_READY` is not received within N seconds, log an error and start the bridge anyway (or show an error). Without this, a renderer init failure would cause the app to hang silently with stdin consumed but no output.

2. **Signal ordering**: The signal must fire AFTER `useLogIngestion`'s `useEffect` registers listeners, not just after `AppShell` mounts. Since React effects fire after paint, the signal should be sent from within the `useLogIngestion` effect body (after `window.api.onLogLine()` is called). This is the correct place.

3. **E2E test mode**: Since E2E tests skip `IpcBridge` entirely and inject data manually, the `RENDERER_READY` signal is not needed for E2E mode. The main process should only wait for `RENDERER_READY` when `!isE2eTest`. However, the renderer should still send the signal unconditionally (harmless no-op if nobody is listening).

4. **IPC invoke vs send**: The signal should use `ipcRenderer.send()` (fire-and-forget from renderer to main), with `ipcMain.once()` on the main side. Using `invoke` would work too but is unnecessary overhead since no response is needed.

### Alternative Fixes Considered

1. **Buffer messages in preload**: The preload script could queue messages received before any listener is registered, then replay when a listener attaches. This is more complex and spreads responsibility across layers. Not preferred.

2. **Pause stdin until ready**: Call `process.stdin.pause()` initially, resume after `RENDERER_READY`. This works but is less explicit than the handshake approach. `readline` in paused mode requires manual `rl.resume()` wiring.

3. **Delay IpcBridge.start with a timer**: Fragile and non-deterministic. Rejected.

### Verdict on Fix: APPROVED with edge case note

The RENDERER_READY handshake is the right fix. The one CRITICAL edge case is: **the signal must be sent from inside `useLogIngestion`'s effect, after listeners are registered** -- not from `useAppInit` or `AppShell` mount.
