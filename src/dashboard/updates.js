(function (global) {
  const createUpdates = (options = {}) => {
    const elements = options.elements || {}
    const jiminy = options.jiminy || {}
    const setMessage = typeof options.setMessage === 'function' ? options.setMessage : () => {}

    const {
      updateButtons = [],
      updateStatuses = [],
      updateErrors = []
    } = elements

    let isCheckingUpdates = false

    const setUpdateCheckState = (nextIsChecking) => {
      isCheckingUpdates = Boolean(nextIsChecking)
      updateButtons.forEach((button) => {
        button.disabled = isCheckingUpdates
      })
    }

    const handleCheck = async () => {
      if (!jiminy.checkForUpdates) {
        setMessage(updateErrors, 'Update bridge unavailable. Restart the app.')
        return
      }

      setMessage(updateErrors, '')
      setMessage(updateStatuses, 'Checking for updates...')
      setUpdateCheckState(true)

      try {
        const result = await jiminy.checkForUpdates({ reason: 'manual' })
        if (result && result.ok) {
          const version = result.updateInfo && result.updateInfo.version
            ? result.updateInfo.version
            : ''
          const message = version
            ? `Update ${version} is available. Check the download prompt.`
            : 'No updates found.'
          setMessage(updateStatuses, message)
        } else if (result && result.reason === 'checking') {
          setMessage(updateStatuses, 'Already checking for updates...')
        } else if (result && result.reason === 'disabled') {
          setMessage(updateStatuses, '')
          setMessage(updateErrors, 'Auto-updates are disabled in this build.')
        } else {
          setMessage(updateStatuses, '')
          setMessage(updateErrors, result?.message || 'Failed to check for updates.')
        }
      } catch (error) {
        console.error('Failed to check for updates', error)
        setMessage(updateStatuses, '')
        setMessage(updateErrors, 'Failed to check for updates.')
      } finally {
        setUpdateCheckState(false)
      }
    }

    if (updateButtons.length > 0) {
      updateButtons.forEach((button) => {
        button.addEventListener('click', () => {
          void handleCheck()
        })
      })
    }

    return {
      isReady: Boolean(jiminy.checkForUpdates)
    }
  }

  const registry = global.JiminyUpdates || {}
  registry.createUpdates = createUpdates
  global.JiminyUpdates = registry

  // Export for Node/CommonJS so tests can require this module; browsers ignore this.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = registry
  }
})(window)
