(function registerBootstrapWizard(global) {
  function bootstrapWizard(options = {}) {
    const targetWindow = options.window
    if (!targetWindow || !targetWindow.JiminyWizard || typeof targetWindow.JiminyWizard.createWizard !== 'function') {
      return null
    }

    return targetWindow.JiminyWizard.createWizard({
      elements: options.elements,
      getState: options.getState,
      onDone: options.onDone
    })
  }

  const registry = global.JiminyDashboardBootstrap || {}
  registry.bootstrapWizard = bootstrapWizard
  global.JiminyDashboardBootstrap = registry

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { bootstrapWizard }
  }
})(typeof window !== 'undefined' ? window : global)
