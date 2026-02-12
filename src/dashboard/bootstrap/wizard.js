(function registerBootstrapWizard(global) {
  function bootstrapWizard(options = {}) {
    const targetWindow = options.window
    if (!targetWindow || !targetWindow.FamiliarWizard || typeof targetWindow.FamiliarWizard.createWizard !== 'function') {
      return null
    }

    return targetWindow.FamiliarWizard.createWizard({
      elements: options.elements,
      getState: options.getState,
      onDone: options.onDone,
      onStepChange: options.onStepChange
    })
  }

  const registry = global.FamiliarDashboardBootstrap || {}
  registry.bootstrapWizard = bootstrapWizard
  global.FamiliarDashboardBootstrap = registry

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { bootstrapWizard }
  }
})(typeof window !== 'undefined' ? window : global)
