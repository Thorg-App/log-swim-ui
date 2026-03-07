import { useState, useEffect } from 'react'
import type { AppConfig, LaneDefinition, AppErrorType } from '@core/types'
import { createLaneDefinition } from '@core/types'
import { MasterList } from '@core/master-list'
import { applyConfigToCSS } from './applyConfigToCSS'

// --- Init Result Discriminated Union ---

interface InitLoading {
  readonly status: 'loading'
}

interface InitReady {
  readonly status: 'ready'
  readonly config: AppConfig
  readonly lanes: LaneDefinition[]
  readonly masterList: MasterList
}

interface InitError {
  readonly status: 'error'
  readonly errorType: AppErrorType
  readonly message: string
}

type InitResult = InitLoading | InitReady | InitError

/**
 * Hook that loads config and CLI args from the preload API on mount.
 * Applies config to CSS custom properties and builds lane definitions.
 */
function useAppInit(): InitResult {
  const [result, setResult] = useState<InitResult>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    async function init(): Promise<void> {
      try {
        const [config, cliArgs] = await Promise.all([
          window.api.getConfig(),
          window.api.getCliArgs()
        ])

        if (cancelled) return

        applyConfigToCSS(config)

        const lanes = cliArgs.filterColumnPatterns.map((pattern) => createLaneDefinition(pattern))
        const masterList = new MasterList(config.performance.maxLogEntries)

        setResult({ status: 'ready', config, lanes, masterList })
      } catch (e: unknown) {
        if (cancelled) return
        const message = e instanceof Error ? e.message : 'Unknown initialization error'
        setResult({ status: 'error', errorType: 'config-error', message })
      }
    }

    void init()

    return () => { cancelled = true }
  }, [])

  return result
}

export { useAppInit }
export type { InitResult, InitReady, InitError, InitLoading }
