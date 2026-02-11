(function registerBootstrapHotkeys(global) {
  function bootstrapHotkeys(options = {}) {
    const targetWindow = options.window
    if (!targetWindow || !targetWindow.FamiliarHotkeys || typeof targetWindow.FamiliarHotkeys.createHotkeys !== 'function') {
      return null
    }

    return targetWindow.FamiliarHotkeys.createHotkeys({
      elements: options.elements,
      familiar: options.familiar,
      setMessage: options.setMessage,
      updateWizardUI: options.updateWizardUI,
      getState: options.getState,
      setHotkeyValue: options.setHotkeyValue,
      defaults: options.defaults
    })
  }

  const registry = global.FamiliarDashboardBootstrap || {}
  registry.bootstrapHotkeys = bootstrapHotkeys
  global.FamiliarDashboardBootstrap = registry

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { bootstrapHotkeys }
  }
})(typeof window !== 'undefined' ? window : global)
