(function (global) {
  const createRecording = (options = {}) => {
    const elements = options.elements || {}
    const jiminy = options.jiminy || {}
    const getState = typeof options.getState === 'function' ? options.getState : () => ({})

    const {
      recordingDetails,
      recordingPath,
      recordingStatus,
      recordingActionButton,
      recordingPermission
    } = elements

    let currentScreenRecordingState = 'disabled'
    let currentScreenRecordingPermissionStatus = ''
    let recordingStatusPoller = null

    const isRecordingActive = () =>
      currentScreenRecordingState === 'recording' || currentScreenRecordingState === 'idleGrace'

    const updateRecordingUI = () => {
      const state = getState()
      const currentContextFolderPath = state.currentContextFolderPath || ''
      const currentAlwaysRecordWhenActive = Boolean(state.currentAlwaysRecordWhenActive)

      if (recordingDetails) {
        recordingDetails.classList.toggle('hidden', !currentAlwaysRecordWhenActive)
      }

      if (recordingPath) {
        if (currentContextFolderPath) {
          recordingPath.textContent = `${currentContextFolderPath}/jiminy/recordings`
        } else {
          recordingPath.textContent = 'Set a context folder to enable recordings.'
        }
      }

      if (recordingStatus) {
        recordingStatus.textContent = isRecordingActive() ? 'Recording' : 'Not recording'
      }

      if (recordingActionButton) {
        const isRecording = isRecordingActive()
        recordingActionButton.textContent = isRecording ? 'Stop recording' : 'Start recording'
        recordingActionButton.disabled = !currentAlwaysRecordWhenActive || !currentContextFolderPath
      }

      if (recordingPermission) {
        const permissionStatus = currentScreenRecordingPermissionStatus || ''
        const needsPermission = permissionStatus && permissionStatus !== 'granted'
        if (needsPermission) {
          recordingPermission.textContent =
            'Screen Recording permission required. Open System Settings → Privacy & Security → Screen Recording.'
        } else {
          recordingPermission.textContent = ''
        }
        recordingPermission.classList.toggle('hidden', !recordingPermission.textContent)
      }
    }

    const refreshRecordingStatus = async () => {
      if (!jiminy.getScreenRecordingStatus) {
        return
      }
      try {
        const result = await jiminy.getScreenRecordingStatus()
        if (result && result.state) {
          currentScreenRecordingState = result.state
        }
      } catch (error) {
        console.error('Failed to load recording status', error)
      }
      updateRecordingUI()
    }

    const startRecordingPoller = () => {
      if (recordingStatusPoller) {
        return
      }
      recordingStatusPoller = setInterval(refreshRecordingStatus, 2000)
      if (typeof recordingStatusPoller.unref === 'function') {
        recordingStatusPoller.unref()
      }
    }

    const stopRecordingPoller = () => {
      if (recordingStatusPoller) {
        clearInterval(recordingStatusPoller)
        recordingStatusPoller = null
      }
    }

    const handleSectionChange = (nextSection) => {
      if (nextSection === 'recording') {
        void refreshRecordingStatus()
        startRecordingPoller()
        return
      }
      stopRecordingPoller()
    }

    const setPermissionStatus = (status) => {
      currentScreenRecordingPermissionStatus = status || ''
      updateRecordingUI()
    }

    if (recordingActionButton) {
      recordingActionButton.addEventListener('click', async () => {
        if (!jiminy.startScreenRecording || !jiminy.stopScreenRecording) {
          return
        }
        try {
          if (isRecordingActive()) {
            await jiminy.stopScreenRecording()
          } else {
            await jiminy.startScreenRecording()
          }
          await refreshRecordingStatus()
        } catch (error) {
          console.error('Failed to toggle recording', error)
        }
      })
    }

    return {
      handleSectionChange,
      refreshRecordingStatus,
      setPermissionStatus,
      updateRecordingUI
    }
  }

  const registry = global.JiminyRecording || {}
  registry.createRecording = createRecording
  global.JiminyRecording = registry

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = registry
  }
})(window)
