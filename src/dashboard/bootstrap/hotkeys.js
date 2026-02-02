(function registerBootstrapHotkeys(global) {
  function bootstrapHotkeys(options = {}) {
    const targetWindow = options.window
    if (!targetWindow || !targetWindow.JiminyHotkeys || typeof targetWindow.JiminyHotkeys.createHotkeys !== 'function') {
      return null
    }

    return targetWindow.JiminyHotkeys.createHotkeys({
      elements: options.elements,
      jiminy: options.jiminy,
      setMessage: options.setMessage,
      updateWizardUI: options.updateWizardUI,
      getState: options.getState,
      setHotkeyValue: options.setHotkeyValue,
      defaults: options.defaults
    })
  }

  const registry = global.JiminyDashboardBootstrap || {}
  registry.bootstrapHotkeys = bootstrapHotkeys
  global.JiminyDashboardBootstrap = registry

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { bootstrapHotkeys }
  }
})(typeof window !== 'undefined' ? window : global)
