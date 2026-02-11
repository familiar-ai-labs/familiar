(function registerBootstrapUpdates(global) {
  function bootstrapUpdates(options = {}) {
    const targetWindow = options.window
    if (!targetWindow || !targetWindow.FamiliarUpdates || typeof targetWindow.FamiliarUpdates.createUpdates !== 'function') {
      return null
    }

    return targetWindow.FamiliarUpdates.createUpdates({
      elements: options.elements,
      familiar: options.familiar,
      setMessage: options.setMessage
    })
  }

  const registry = global.FamiliarDashboardBootstrap || {}
  registry.bootstrapUpdates = bootstrapUpdates
  global.FamiliarDashboardBootstrap = registry

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { bootstrapUpdates }
  }
})(typeof window !== 'undefined' ? window : global)
