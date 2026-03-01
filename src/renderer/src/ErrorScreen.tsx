import type { AppErrorType, AppConfig } from '@core/types'
import { DEFAULT_APP_CONFIG } from '@core/types'

interface ErrorScreenProps {
  readonly errorType: AppErrorType
  readonly message: string
}

const ERROR_TITLES: Readonly<Record<AppErrorType, string>> = {
  'no-stdin': 'No Input Stream',
  'stream-error': 'Stream Error',
  'config-error': 'Configuration Error'
}

/**
 * Full-screen error display for fatal app states.
 * For config errors, includes a "Revert to Defaults" button that
 * saves DEFAULT_APP_CONFIG and reloads the window.
 */
function ErrorScreen({ errorType, message }: ErrorScreenProps) {
  const title = ERROR_TITLES[errorType]

  function handleRevertConfig(): void {
    void window.api
      .saveConfig(DEFAULT_APP_CONFIG as AppConfig)
      .then(() => { window.location.reload() })
  }

  return (
    <div className="error-screen">
      <div className="error-screen__icon">!</div>
      <h1 className="error-screen__title">{title}</h1>
      <p className="error-screen__message">{message}</p>
      {errorType === 'config-error' && (
        <div>
          <button
            className="error-screen__action-btn"
            onClick={handleRevertConfig}
            type="button"
          >
            Revert to Defaults
          </button>
        </div>
      )}
    </div>
  )
}

export { ErrorScreen }
export type { ErrorScreenProps }
