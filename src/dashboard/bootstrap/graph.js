(function registerBootstrapGraph(global) {
  function bootstrapGraph(options = {}) {
    const targetWindow = options.window
    if (!targetWindow || !targetWindow.JiminyGraph || typeof targetWindow.JiminyGraph.createGraph !== 'function') {
      return null
    }

    return targetWindow.JiminyGraph.createGraph({
      elements: options.elements,
      jiminy: options.jiminy,
      getState: options.getState,
      setGraphState: options.setGraphState,
      setMessage: options.setMessage,
      updateWizardUI: options.updateWizardUI
    })
  }

  const registry = global.JiminyDashboardBootstrap || {}
  registry.bootstrapGraph = bootstrapGraph
  global.JiminyDashboardBootstrap = registry

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { bootstrapGraph }
  }
})(typeof window !== 'undefined' ? window : global)
