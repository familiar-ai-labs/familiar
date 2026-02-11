(function registerBootstrapStills(global) {
  function bootstrapStills(options = {}) {
    const targetWindow = options.window
    if (!targetWindow || !targetWindow.FamiliarStills || typeof targetWindow.FamiliarStills.createStills !== 'function') {
      return null
    }

    return targetWindow.FamiliarStills.createStills({
      elements: options.elements,
      familiar: options.familiar,
      getState: options.getState
    })
  }

  const registry = global.FamiliarDashboardBootstrap || {}
  registry.bootstrapStills = bootstrapStills
  global.FamiliarDashboardBootstrap = registry

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { bootstrapStills }
  }
})(typeof window !== 'undefined' ? window : global)

