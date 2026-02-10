(function registerBootstrapProcessingEngine(global) {
  function bootstrapProcessingEngine(options = {}) {
    const targetWindow = options.window
    if (
      !targetWindow ||
      !targetWindow.JiminyProcessingEngine ||
      typeof targetWindow.JiminyProcessingEngine.createProcessingEngine !== 'function'
    ) {
      return null
    }

    return targetWindow.JiminyProcessingEngine.createProcessingEngine({
      elements: options.elements
    })
  }

  const registry = global.JiminyDashboardBootstrap || {}
  registry.bootstrapProcessingEngine = bootstrapProcessingEngine
  global.JiminyDashboardBootstrap = registry

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { bootstrapProcessingEngine }
  }
})(typeof window !== 'undefined' ? window : global)

