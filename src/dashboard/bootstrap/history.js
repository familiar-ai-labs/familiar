(function registerBootstrapHistory(global) {
  function bootstrapHistory(options = {}) {
    const targetWindow = options.window
    if (!targetWindow || !targetWindow.JiminyHistory || typeof targetWindow.JiminyHistory.createHistory !== 'function') {
      return null
    }

    return targetWindow.JiminyHistory.createHistory({
      elements: options.elements,
      jiminy: options.jiminy,
      setMessage: options.setMessage
    })
  }

  const registry = global.JiminyDashboardBootstrap || {}
  registry.bootstrapHistory = bootstrapHistory
  global.JiminyDashboardBootstrap = registry

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { bootstrapHistory }
  }
})(typeof window !== 'undefined' ? window : global)
