(function registerBootstrapStills(global) {
  function bootstrapStills(options = {}) {
    const targetWindow = options.window
    if (!targetWindow || !targetWindow.JiminyStills || typeof targetWindow.JiminyStills.createStills !== 'function') {
      return null
    }

    return targetWindow.JiminyStills.createStills({
      elements: options.elements,
      jiminy: options.jiminy,
      getState: options.getState
    })
  }

  const registry = global.JiminyDashboardBootstrap || {}
  registry.bootstrapStills = bootstrapStills
  global.JiminyDashboardBootstrap = registry

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { bootstrapStills }
  }
})(typeof window !== 'undefined' ? window : global)

