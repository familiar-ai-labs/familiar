(function registerBootstrapSettings(global) {
  function bootstrapSettings(options = {}) {
    const targetWindow = options.window
    if (!targetWindow || !targetWindow.JiminySettings || typeof targetWindow.JiminySettings.createSettings !== 'function') {
      return null
    }

    return targetWindow.JiminySettings.createSettings({
      elements: options.elements,
      jiminy: options.jiminy,
      defaults: options.defaults,
      getState: options.getState,
      setContextFolderValue: options.setContextFolderValue,
      setSkillHarness: options.setSkillHarness,
      setLlmProviderValue: options.setLlmProviderValue,
      setLlmApiKeyPending: options.setLlmApiKeyPending,
      setLlmApiKeySaved: options.setLlmApiKeySaved,
      setStillsMarkdownExtractorType: options.setStillsMarkdownExtractorType,
      setAlwaysRecordWhenActiveValue: options.setAlwaysRecordWhenActiveValue,
      setHotkeys: options.setHotkeys,
      setExclusions: options.setExclusions,
      setMessage: options.setMessage,
      refreshContextGraphStatus: options.refreshContextGraphStatus,
      updatePruneButtonState: options.updatePruneButtonState,
      updateWizardUI: options.updateWizardUI
    })
  }

  const registry = global.JiminyDashboardBootstrap || {}
  registry.bootstrapSettings = bootstrapSettings
  global.JiminyDashboardBootstrap = registry

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { bootstrapSettings }
  }
})(typeof window !== 'undefined' ? window : global)
