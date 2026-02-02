(function registerDashboardState(global) {
  function createDashboardState(options = {}) {
    const defaults = options.defaults || {}
    const elements = options.elements || {}
    const apis = options.apis || {}

    const contextFolderInputs = elements.contextFolderInputs || []
    const llmProviderSelects = elements.llmProviderSelects || []
    const llmKeyInputs = elements.llmKeyInputs || []
    const alwaysRecordWhenActiveInputs = elements.alwaysRecordWhenActiveInputs || []

    const state = {
      currentContextFolderPath: '',
      currentLlmProviderName: '',
      currentLlmApiKey: '',
      pendingLlmApiKey: '',
      currentAlwaysRecordWhenActive: false,
      isLlmApiKeySaved: false,
      currentCaptureHotkey: defaults.capture || '',
      currentClipboardHotkey: defaults.clipboard || '',
      currentRecordingHotkey: defaults.recording || '',
      currentExclusions: [],
      isContextGraphSynced: false,
      hasCompletedSync: false,
      isFirstRun: false
    }

    function callIfAvailable(target, method, ...args) {
      if (target && typeof target[method] === 'function') {
        return target[method](...args)
      }
      return undefined
    }

    function updateWizardUI() {
      callIfAvailable(apis.wizardApi, 'updateWizardUI')
    }

    function setHotkeyValue(role, value) {
      const nextValue = value || ''
      switch (role) {
        case 'capture':
          state.currentCaptureHotkey = nextValue
          return
        case 'recording':
          state.currentRecordingHotkey = nextValue
          return
        default:
          state.currentClipboardHotkey = nextValue
      }
    }

    function setExclusionsState(exclusions) {
      state.currentExclusions = Array.isArray(exclusions) ? [...exclusions] : []
    }

    function setExclusionsValue(exclusions) {
      if (apis.exclusionsApi && typeof apis.exclusionsApi.setExclusions === 'function') {
        apis.exclusionsApi.setExclusions(exclusions)
        return
      }
      setExclusionsState(exclusions)
    }

    function setInputValues(targets, value) {
      for (const element of targets) {
        if (element.value !== value) {
          element.value = value
        }
      }
    }

    function setContextFolderValue(value) {
      const nextValue = value || ''
      if (state.currentContextFolderPath !== nextValue) {
        state.hasCompletedSync = false
        state.isContextGraphSynced = false
      }
      state.currentContextFolderPath = nextValue
      setInputValues(contextFolderInputs, state.currentContextFolderPath)
      callIfAvailable(apis.recordingApi, 'updateRecordingUI')
      callIfAvailable(apis.graphApi, 'updatePruneButtonState')
      updateWizardUI()
    }

    function setLlmProviderValue(value) {
      state.currentLlmProviderName = value || ''
      for (const select of llmProviderSelects) {
        if (select.value !== state.currentLlmProviderName) {
          select.value = state.currentLlmProviderName
        }
      }
      callIfAvailable(apis.recordingApi, 'updateRecordingUI')
      updateWizardUI()
    }

    function setLlmApiKeyPending(value) {
      state.pendingLlmApiKey = value || ''
      setInputValues(llmKeyInputs, state.pendingLlmApiKey)
      state.isLlmApiKeySaved =
        state.pendingLlmApiKey.length > 0 && state.pendingLlmApiKey === state.currentLlmApiKey
      updateWizardUI()
    }

    function setLlmApiKeySaved(value) {
      state.currentLlmApiKey = value || ''
      setLlmApiKeyPending(state.currentLlmApiKey)
      state.isLlmApiKeySaved = Boolean(state.currentLlmApiKey)
      callIfAvailable(apis.recordingApi, 'updateRecordingUI')
      updateWizardUI()
    }

    function setAlwaysRecordWhenActiveValue(value) {
      state.currentAlwaysRecordWhenActive = Boolean(value)
      for (const input of alwaysRecordWhenActiveInputs) {
        if (input.checked !== state.currentAlwaysRecordWhenActive) {
          input.checked = state.currentAlwaysRecordWhenActive
        }
      }
      callIfAvailable(apis.recordingApi, 'updateRecordingUI')
    }

    function setHotkeysFromSettings(hotkeys) {
      if (apis.hotkeysApi && typeof apis.hotkeysApi.setHotkeys === 'function') {
        apis.hotkeysApi.setHotkeys(hotkeys)
        return
      }
      setHotkeyValue('capture', hotkeys.capture)
      setHotkeyValue('clipboard', hotkeys.clipboard)
      setHotkeyValue('recording', hotkeys.recording)
      updateWizardUI()
    }

    function setGraphState(updates = {}) {
      if ('isContextGraphSynced' in updates) {
        state.isContextGraphSynced = updates.isContextGraphSynced
      }
      if ('hasCompletedSync' in updates && updates.hasCompletedSync !== undefined) {
        state.hasCompletedSync = updates.hasCompletedSync
      }
      updateWizardUI()
    }

    function setIsFirstRun(value) {
      state.isFirstRun = Boolean(value)
    }

    function getIsFirstRun() {
      return state.isFirstRun
    }

    function getWizardState() {
      return {
        currentContextFolderPath: state.currentContextFolderPath,
        currentLlmProviderName: state.currentLlmProviderName,
        currentLlmApiKey: state.currentLlmApiKey,
        isLlmApiKeySaved: state.isLlmApiKeySaved,
        hasCompletedSync: state.hasCompletedSync,
        isContextGraphSynced: state.isContextGraphSynced,
        currentCaptureHotkey: state.currentCaptureHotkey,
        currentClipboardHotkey: state.currentClipboardHotkey,
        currentRecordingHotkey: state.currentRecordingHotkey
      }
    }

    function getGraphState() {
      return {
        currentContextFolderPath: state.currentContextFolderPath,
        currentExclusions: state.currentExclusions,
        isContextGraphSynced: state.isContextGraphSynced,
        hasCompletedSync: state.hasCompletedSync
      }
    }

    function getRecordingState() {
      return {
        currentContextFolderPath: state.currentContextFolderPath,
        currentAlwaysRecordWhenActive: state.currentAlwaysRecordWhenActive,
        currentLlmProviderName: state.currentLlmProviderName,
        currentLlmApiKey: state.currentLlmApiKey
      }
    }

    function getSettingsState() {
      return {
        currentContextFolderPath: state.currentContextFolderPath,
        currentLlmProviderName: state.currentLlmProviderName,
        currentLlmApiKey: state.currentLlmApiKey,
        pendingLlmApiKey: state.pendingLlmApiKey,
        currentExclusions: state.currentExclusions,
        currentAlwaysRecordWhenActive: state.currentAlwaysRecordWhenActive
      }
    }

    function getExclusionsState() {
      return {
        currentContextFolderPath: state.currentContextFolderPath,
        currentExclusions: state.currentExclusions
      }
    }

    function getHotkeysState() {
      return {
        currentCaptureHotkey: state.currentCaptureHotkey,
        currentClipboardHotkey: state.currentClipboardHotkey,
        currentRecordingHotkey: state.currentRecordingHotkey
      }
    }

    return {
      updateWizardUI,
      setHotkeyValue,
      setExclusionsState,
      setExclusionsValue,
      setContextFolderValue,
      setLlmProviderValue,
      setLlmApiKeyPending,
      setLlmApiKeySaved,
      setAlwaysRecordWhenActiveValue,
      setHotkeysFromSettings,
      setGraphState,
      setIsFirstRun,
      getIsFirstRun,
      getWizardState,
      getGraphState,
      getRecordingState,
      getSettingsState,
      getExclusionsState,
      getHotkeysState
    }
  }

  const registry = global.JiminyDashboardState || {}
  registry.createDashboardState = createDashboardState
  global.JiminyDashboardState = registry

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = registry
  }
})(typeof window !== 'undefined' ? window : global)
