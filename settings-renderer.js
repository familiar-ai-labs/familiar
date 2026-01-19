document.addEventListener('DOMContentLoaded', () => {
  const jiminy = window.jiminy || {}
  const contextFolderInput = document.getElementById('context-folder-path')
  const chooseButton = document.getElementById('context-folder-choose')
  const saveButton = document.getElementById('context-folder-save')
  const errorMessage = document.getElementById('context-folder-error')
  const statusMessage = document.getElementById('context-folder-status')
  const syncButton = document.getElementById('context-graph-sync')
  const syncStatus = document.getElementById('context-graph-status')
  const syncProgress = document.getElementById('context-graph-progress')
  const syncWarning = document.getElementById('context-graph-warning')
  const syncError = document.getElementById('context-graph-error')

  const setMessage = (element, message) => {
    if (!element) {
      return
    }

    element.textContent = message || ''
    element.style.display = message ? 'block' : 'none'
  }

  const updateSaveState = () => {
    if (!saveButton || !contextFolderInput) {
      return
    }
    saveButton.disabled = !contextFolderInput.value
  }

  const setSyncState = (isSyncing) => {
    if (syncButton) {
      syncButton.disabled = isSyncing
    }
  }

  const loadSettings = async () => {
    if (!jiminy.getSettings || !contextFolderInput) {
      return
    }

    try {
      const result = await jiminy.getSettings()
      contextFolderInput.value = result.contextFolderPath || ''
      setMessage(errorMessage, result.validationMessage || '')
      setMessage(statusMessage, '')
      updateSaveState()
    } catch (error) {
      console.error('Failed to load settings', error)
      setMessage(errorMessage, 'Failed to load settings.')
    }
  }

  if (!jiminy.pickContextFolder || !jiminy.saveSettings || !jiminy.getSettings) {
    setMessage(errorMessage, 'Settings bridge unavailable. Restart the app.')
    updateSaveState()
    return
  }

  if (jiminy.onContextGraphProgress && syncProgress) {
    jiminy.onContextGraphProgress((payload) => {
      if (!payload) {
        return
      }

      const progressText = `${payload.completed}/${payload.total}` +
        (payload.relativePath ? ` • ${payload.relativePath}` : '')
      setMessage(syncProgress, progressText)
    })
  }

  if (chooseButton) {
    chooseButton.addEventListener('click', async () => {
      try {
        setMessage(statusMessage, 'Opening folder picker...')
        const result = await jiminy.pickContextFolder()
        if (result && !result.canceled && result.path && contextFolderInput) {
          contextFolderInput.value = result.path
          setMessage(errorMessage, '')
          setMessage(statusMessage, '')
          updateSaveState()
        } else if (result && result.error) {
          setMessage(statusMessage, '')
          setMessage(errorMessage, result.error)
        } else {
          setMessage(statusMessage, '')
        }
      } catch (error) {
        console.error('Failed to pick context folder', error)
        setMessage(statusMessage, '')
        setMessage(errorMessage, 'Failed to open folder picker.')
      }
    })
  }

  if (saveButton) {
    saveButton.addEventListener('click', async () => {
      if (!contextFolderInput) {
        return
      }

      setMessage(statusMessage, 'Saving...')
      setMessage(errorMessage, '')

      try {
        const result = await jiminy.saveSettings(contextFolderInput.value)
        if (result && result.ok) {
          setMessage(statusMessage, 'Saved.')
        } else {
          setMessage(statusMessage, '')
          setMessage(errorMessage, result?.message || 'Failed to save settings.')
        }
      } catch (error) {
        console.error('Failed to save settings', error)
        setMessage(statusMessage, '')
        setMessage(errorMessage, 'Failed to save settings.')
      }
    })
  }

  if (syncButton) {
    syncButton.addEventListener('click', async () => {
      if (!jiminy.syncContextGraph) {
        setMessage(syncError, 'Sync bridge unavailable. Restart the app.')
        return
      }

      setMessage(syncError, '')
      setMessage(syncStatus, 'Syncing...')
      setMessage(syncWarning, '')
      setMessage(syncProgress, '0/0')
      setSyncState(true)

      try {
        const result = await jiminy.syncContextGraph()
        if (result && result.ok) {
          const warnings = Array.isArray(result.warnings) ? result.warnings : []
          const errorCount = Array.isArray(result.errors) ? result.errors.length : 0
          const message = errorCount > 0
            ? `Sync completed with ${errorCount} error${errorCount === 1 ? '' : 's'}.`
            : warnings.length > 0
              ? 'Sync completed with warnings.'
              : 'Sync complete.'
          setMessage(syncStatus, message)
          if (warnings.length > 0) {
            const warningText = warnings[0]?.path
              ? `Warning: cycle detected at ${warnings[0].path}.`
              : 'Warning: cycle detected in context folder.'
            setMessage(syncWarning, warningText)
          }
        } else {
          setMessage(syncStatus, '')
          setMessage(syncWarning, '')
          setMessage(syncError, result?.message || 'Failed to sync context graph.')
        }
      } catch (error) {
        console.error('Failed to sync context graph', error)
        setMessage(syncStatus, '')
        setMessage(syncWarning, '')
        setMessage(syncError, 'Failed to sync context graph.')
      } finally {
        setSyncState(false)
      }
    })
  }

  void loadSettings()
})
