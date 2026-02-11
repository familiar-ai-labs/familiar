(function registerBootstrapProcessingEngine(global) {
  function bootstrapProcessingEngine(options = {}) {
    const targetWindow = options.window
    if (
      !targetWindow ||
      !targetWindow.FamiliarProcessingEngine ||
      typeof targetWindow.FamiliarProcessingEngine.createProcessingEngine !== 'function'
    ) {
      return null
    }

    return targetWindow.FamiliarProcessingEngine.createProcessingEngine({
      elements: options.elements
    })
  }

  const registry = global.FamiliarDashboardBootstrap || {}
  registry.bootstrapProcessingEngine = bootstrapProcessingEngine
  global.FamiliarDashboardBootstrap = registry

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { bootstrapProcessingEngine }
  }
})(typeof window !== 'undefined' ? window : global)

